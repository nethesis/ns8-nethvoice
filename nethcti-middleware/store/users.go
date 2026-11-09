/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"github.com/nethesis/nethcti-middleware/models"
)

var UserSessions map[string]*models.UserSession

func UserSessionInit() map[string]*models.UserSession {
	UserSessions = make(map[string]*models.UserSession)
	return UserSessions
}
