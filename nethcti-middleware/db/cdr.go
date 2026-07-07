/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
)

var (
	// Access the CDR database with GetCDRDB() to ensure proper initialization and reconnection.
	CDRDB          *sql.DB
	cdrSqlOpenFunc = sql.Open
)

// InitCDR initializes the CDR database connection pool with the configured MariaDB settings.
func InitCDR() error {
	if strings.TrimSpace(configuration.Config.MiddlewareMariaDBHost) == "" ||
		strings.TrimSpace(configuration.Config.MiddlewareMariaDBPort) == "" {
		err := fmt.Errorf("missing CDR database configuration: host/port must be set")
		logs.Log("[CRITICAL][CDR-DB] " + err.Error())
		return err
	}

	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true",
		configuration.Config.MiddlewareMariaDBUser,
		configuration.Config.MiddlewareMariaDBPassword,
		configuration.Config.MiddlewareMariaDBHost,
		configuration.Config.MiddlewareMariaDBPort,
		configuration.Config.MiddlewareMariaDBCDRDatabase,
	)

	var err error
	CDRDB, err = cdrSqlOpenFunc("mysql", dsn)
	if err != nil {
		logs.Log("[CRITICAL][CDR-DB] Failed to open database connection: " + err.Error())
		return err
	}

	// Configure connection pool
	CDRDB.SetMaxOpenConns(10)
	CDRDB.SetMaxIdleConns(2)
	CDRDB.SetConnMaxLifetime(5 * time.Minute)

	// Test the connection with a few retries to tolerate transient DB startup
	var pingErr error
	maxAttempts := 5
	for i := 0; i < maxAttempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		pingErr = CDRDB.PingContext(ctx)
		cancel()
		if pingErr == nil {
			break
		}
		time.Sleep(250 * time.Millisecond)
	}
	if pingErr != nil {
		logs.Log("[CRITICAL][CDR-DB] Failed to ping database: " + pingErr.Error())
		_ = CDRDB.Close()
		CDRDB = nil
		return pingErr
	}

	logs.Log("[INFO][CDR-DB] CDR database connection established successfully")
	return nil
}

// CloseCDR gracefully closes the CDR database connection pool.
func CloseCDR() error {
	if CDRDB != nil {
		return CDRDB.Close()
	}
	return nil
}

// GetCDRDB returns a ready-to-use CDR DB connection, initializing it on demand.
func GetCDRDB() *sql.DB {
	if CDRDB == nil {
		if err := InitCDR(); err != nil {
			logs.Log("[CRITICAL][CDR-DB] Failed to initialize database: " + err.Error())
			return CDRDB
		}
		return CDRDB
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := CDRDB.PingContext(ctx); err != nil {
		logs.Log("[WARNING][CDR-DB] Lost DB connection, attempting reconnect: " + err.Error())
		if err := InitCDR(); err != nil {
			logs.Log("[CRITICAL][CDR-DB] Failed to reconnect database: " + err.Error())
			return CDRDB
		}
	}

	return CDRDB
}
