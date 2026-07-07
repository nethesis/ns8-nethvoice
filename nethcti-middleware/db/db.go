/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package db

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
)

var (
	// Access the database with GetDB() to ensure proper initialization and reconnection.
	DB          *sql.DB
	sqlOpenFunc = sql.Open
)

//go:embed create.sql
var createSchema string

//go:embed upgrade.sql
var upgradeSchema string

// Init initializes the database connection pool with the configured MariaDB settings.
// It performs health checks and creates necessary schema.
func Init() error {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&multiStatements=true",
		configuration.Config.MiddlewareMariaDBUser,
		configuration.Config.MiddlewareMariaDBPassword,
		configuration.Config.MiddlewareMariaDBHost,
		configuration.Config.MiddlewareMariaDBPort,
		configuration.Config.MiddlewareMariaDBDatabase,
	)
	// Defensive checks: ensure we have the minimal config values to build a DSN
	if strings.TrimSpace(configuration.Config.MiddlewareMariaDBHost) == "" ||
		strings.TrimSpace(configuration.Config.MiddlewareMariaDBPort) == "" ||
		strings.TrimSpace(configuration.Config.MiddlewareMariaDBDatabase) == "" {
		err := fmt.Errorf("missing database configuration: host/port/database must be set")
		logs.Log("[CRITICAL][DB] " + err.Error())
		return err
	}

	var err error
	DB, err = sqlOpenFunc("mysql", dsn)
	if err != nil {
		logs.Log("[CRITICAL][DB] Failed to open database connection: " + err.Error())
		return err
	}

	// Configure connection pool
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Test the connection with a few retries to tolerate transient DB startup
	var pingErr error
	maxAttempts := 5
	for i := 0; i < maxAttempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		pingErr = DB.PingContext(ctx)
		cancel()
		if pingErr == nil {
			break
		}
		// Wait a bit before retrying (avoid busy loop)
		time.Sleep(250 * time.Millisecond)
	}
	if pingErr != nil {
		logs.Log("[CRITICAL][DB] Failed to ping database: " + pingErr.Error())
		// Close the opened DB to avoid leaking resources
		_ = DB.Close()
		DB = nil
		return pingErr
	}

	logs.Log("[INFO][DB] Database connection established successfully")

	// Detect whether the database/schema already existed before we ran createSchema.
	existed, detectErr := databaseExists()
	if detectErr != nil {
		logs.Log("[WARNING][DB] Could not determine if database existed: " + detectErr.Error())
		// proceed with create schema anyway
	}

	// Create schema if it doesn't exist (idempotent)
	err = loadCreateSchema()
	if err != nil {
		logs.Log("[CRITICAL][DB] Failed to create schema: " + err.Error())
		return err
	}

	// If the database already existed before init, apply upgrade.sql (embedded)
	if existed {
		logs.Log("[INFO][DB] Existing database detected; applying embedded upgrade.sql")
		if lerr := loadUpgradeSchema(); lerr != nil {
			logs.Log("[CRITICAL][DB] Failed to apply upgrade.sql: " + lerr.Error())
			return lerr
		}
	}

	logs.Log("[INFO][DB] Schema initialization complete")
	return nil
}

// Close gracefully closes the database connection pool.
func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

// loadCreateSchema creates the necessary database schema for the middleware.
func loadCreateSchema() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := DB.ExecContext(ctx, createSchema)
	if err != nil {
		return err
	}

	logs.Log("[INFO][DB] Schema created/verified successfully")
	return nil
}

// databaseExists returns true if the configured database/schema already exists
// in the server. It queries information_schema.SCHEMATA for the configured
// database name. If it cannot determine existence it returns false and an error.
func databaseExists() (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1;`
	var name string
	err := DB.QueryRowContext(ctx, query, configuration.Config.MiddlewareMariaDBDatabase).Scan(&name)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// loadUpgradeSchema applies the embedded upgrade SQL. The SQL must be
// idempotent; this function executes it with a timeout and returns any error.
func loadUpgradeSchema() error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_, err := DB.ExecContext(ctx, upgradeSchema)
	if err != nil {
		return err
	}

	logs.Log("[INFO][DB] Embedded upgrade.sql applied successfully")
	return nil
}

func GetDB() *sql.DB {
	// If DB is not initialized, try to initialize it.
	if DB == nil {
		logs.Log("[WARNING][DB] DB is nil, attempting to initialize connection")
		if err := Init(); err != nil {
			logs.Log("[CRITICAL][DB] Failed to initialize database in GetDB: " + err.Error())
			return DB
		}
		return DB
	}

	// Ensure the connection is alive; if not, try to reconnect.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := DB.PingContext(ctx); err != nil {
		logs.Log("[WARNING][DB] Lost DB connection, attempting reconnect: " + err.Error())
		if err := Init(); err != nil {
			logs.Log("[CRITICAL][DB] Failed to reconnect database in GetDB: " + err.Error())
			return DB
		}
	}

	return DB
}
