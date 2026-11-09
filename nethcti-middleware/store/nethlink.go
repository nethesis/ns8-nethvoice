/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"context"
	"errors"

	"github.com/nethesis/nethcti-middleware/db"
)

// NethlinkHeartbeat carries the client info persisted on each NethLink heartbeat.
// Extension is provided by the client (the JWT does not carry it); the timestamp is
// generated server-side. Version/OS fields are optional and may be empty for older clients.
type NethlinkHeartbeat struct {
	Username        string
	Extension       string
	NethlinkVersion string
	OsType          string
	OsRelease       string
	Arch            string
}

// SetNethlinkHeartbeat upserts the NethLink last-seen row for a user. It mirrors the legacy
// nethcti-server behaviour (REPLACE INTO user_nethlink, one row per user, server-side
// timestamp) and additionally persists the client version and OS details.
func SetNethlinkHeartbeat(ctx context.Context, hb NethlinkHeartbeat) error {
	database := db.GetDB()
	if database == nil {
		return errors.New("database not initialized")
	}

	query := "REPLACE INTO `user_nethlink` (`user`, `extension`, `timestamp`, `nethlink_version`, `os_type`, `os_release`, `arch`) VALUES (?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, ?, ?, ?)"
	_, err := database.ExecContext(ctx, query,
		hb.Username,
		hb.Extension,
		hb.NethlinkVersion,
		hb.OsType,
		hb.OsRelease,
		hb.Arch,
	)
	return err
}
