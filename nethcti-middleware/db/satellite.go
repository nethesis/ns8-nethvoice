/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package db

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
)

var (
	SatelliteDB          *sql.DB
	satelliteSqlOpenFunc = sql.Open
)

// InitSatellite initializes the satellite database connection pool.
func InitSatellite() error {
	if strings.TrimSpace(configuration.Config.SatellitePgSQLHost) == "" ||
		strings.TrimSpace(configuration.Config.SatellitePgSQLPort) == "" ||
		strings.TrimSpace(configuration.Config.SatellitePgSQLDB) == "" ||
		strings.TrimSpace(configuration.Config.SatellitePgSQLUser) == "" {
		err := fmt.Errorf("missing satellite database configuration")
		logs.Log("[ERROR][SATELLITE-DB] " + err.Error())
		return err
	}

	pgURL := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(configuration.Config.SatellitePgSQLUser, configuration.Config.SatellitePgSQLPassword),
		Host:   fmt.Sprintf("%s:%s", configuration.Config.SatellitePgSQLHost, configuration.Config.SatellitePgSQLPort),
		Path:   configuration.Config.SatellitePgSQLDB,
	}
	query := pgURL.Query()
	pgURL.RawQuery = query.Encode()

	dsn := pgURL.String()

	var err error
	SatelliteDB, err = satelliteSqlOpenFunc("pgx", dsn)
	if err != nil {
		logs.Log("[CRITICAL][SATELLITE-DB] Failed to open database connection: " + err.Error())
		return err
	}

	SatelliteDB.SetMaxOpenConns(10)
	SatelliteDB.SetMaxIdleConns(2)
	SatelliteDB.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := SatelliteDB.PingContext(ctx); err != nil {
		logs.Log("[CRITICAL][SATELLITE-DB] Failed to ping database: " + err.Error())
		_ = SatelliteDB.Close()
		SatelliteDB = nil
		return err
	}

	logs.Log("[INFO][SATELLITE-DB] Database connection established successfully")
	return nil
}

// CloseSatellite gracefully closes the satellite database connection pool.
func CloseSatellite() error {
	if SatelliteDB != nil {
		return SatelliteDB.Close()
	}
	return nil
}

// GetSatelliteDB returns a ready-to-use satellite DB connection, initializing it on demand.
func GetSatelliteDB() *sql.DB {
	if SatelliteDB == nil {
		if err := InitSatellite(); err != nil {
			logs.Log("[CRITICAL][SATELLITE-DB] Failed to initialize database: " + err.Error())
			return SatelliteDB
		}
		return SatelliteDB
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := SatelliteDB.PingContext(ctx); err != nil {
		logs.Log("[WARNING][SATELLITE-DB] Lost DB connection, attempting reconnect: " + err.Error())
		if err := InitSatellite(); err != nil {
			logs.Log("[CRITICAL][SATELLITE-DB] Failed to reconnect database: " + err.Error())
			return SatelliteDB
		}
	}

	return SatelliteDB
}
