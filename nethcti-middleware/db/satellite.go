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
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
)

var (
	SatelliteDB          *sql.DB
	satelliteSqlOpenFunc = sql.Open

	satelliteMutex sync.Mutex
	// satelliteDown is set once the unreachable database has been logged, so a
	// stopped satellite-pgsql (transcriptions never enabled) does not flood the
	// logs on every request.
	satelliteDown bool
	// satelliteRetryAt delays the next connection attempt after a failed one,
	// so requests do not queue up on the mutex waiting for the ping timeout.
	satelliteRetryAt time.Time
)

const satelliteRetryDelay = 5 * time.Second

// initSatellite initializes the satellite database connection pool.
// The caller must hold satelliteMutex.
func initSatellite() error {
	if strings.TrimSpace(configuration.Config.SatellitePgSQLHost) == "" ||
		strings.TrimSpace(configuration.Config.SatellitePgSQLPort) == "" ||
		strings.TrimSpace(configuration.Config.SatellitePgSQLDB) == "" ||
		strings.TrimSpace(configuration.Config.SatellitePgSQLUser) == "" {
		return fmt.Errorf("missing satellite database configuration")
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

	// Open and ping a local pool: SatelliteDB is set only once the pool works,
	// so concurrent readers never get a closed handle.
	database, err := satelliteSqlOpenFunc("pgx", dsn)
	if err != nil {
		return err
	}

	database.SetMaxOpenConns(10)
	database.SetMaxIdleConns(2)
	database.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := database.PingContext(ctx); err != nil {
		_ = database.Close()
		return err
	}

	SatelliteDB = database
	logs.Log("[INFO][SATELLITE-DB] Database connection established successfully")
	return nil
}

// CloseSatellite gracefully closes the satellite database connection pool.
func CloseSatellite() error {
	satelliteMutex.Lock()
	defer satelliteMutex.Unlock()
	if SatelliteDB != nil {
		return SatelliteDB.Close()
	}
	return nil
}

// GetSatelliteDB returns a ready-to-use satellite DB connection, initializing it
// on demand. It returns nil when the database is not reachable: satellite-pgsql
// runs only once call or voicemail transcription has been enabled.
func GetSatelliteDB() *sql.DB {
	satelliteMutex.Lock()
	database := SatelliteDB
	var err error
	opened := database == nil
	if opened {
		if time.Now().Before(satelliteRetryAt) {
			satelliteMutex.Unlock()
			return nil
		}
		err = initSatellite()
		database = SatelliteDB
		if err != nil {
			satelliteRetryAt = time.Now().Add(satelliteRetryDelay)
		}
	}
	satelliteMutex.Unlock()

	if !opened {
		// The pool reconnects by itself once the database is back: it is
		// never replaced, only reported as unavailable meanwhile.
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		err = database.PingContext(ctx)
	}

	satelliteMutex.Lock()
	defer satelliteMutex.Unlock()
	if err != nil {
		if !satelliteDown {
			satelliteDown = true
			logs.Log("[WARNING][SATELLITE-DB] Database unavailable: " + err.Error())
		}
		return nil
	}
	if satelliteDown {
		satelliteDown = false
		logs.Log("[INFO][SATELLITE-DB] Database available again")
	}
	return database
}
