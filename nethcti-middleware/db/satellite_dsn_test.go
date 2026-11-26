/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package db

import (
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nethesis/nethcti-middleware/configuration"
)

func TestSatelliteDSN(t *testing.T) {
	saved := configuration.Config
	t.Cleanup(func() { configuration.Config = saved })
	configuration.Config.SatellitePgSQLUser = "satellite"
	configuration.Config.SatellitePgSQLPassword = "p@ss:w/rd"
	configuration.Config.SatellitePgSQLDB = "satellite"
	configuration.Config.SatellitePgSQLPort = "20042"

	cases := []struct {
		host     string
		wantHost string
	}{
		{"/var/run/postgresql", "/var/run/postgresql"},
		{"127.0.0.1", "127.0.0.1"},
	}
	for _, c := range cases {
		configuration.Config.SatellitePgSQLHost = c.host
		cfg, err := pgconn.ParseConfig(satelliteDSN())
		if err != nil {
			t.Fatalf("host %s: %v", c.host, err)
		}
		if cfg.Host != c.wantHost || cfg.Port != 20042 || cfg.User != "satellite" ||
			cfg.Password != "p@ss:w/rd" || cfg.Database != "satellite" {
			t.Errorf("host %s: got host=%q port=%d user=%q db=%q", c.host, cfg.Host, cfg.Port, cfg.User, cfg.Database)
		}
	}
}
