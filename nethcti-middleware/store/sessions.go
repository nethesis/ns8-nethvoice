/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"sync"

	"github.com/nethesis/nethcti-middleware/models"
)

// sessionsMu guards UserSessions and the fields of every session in it:
// concurrent map writes are a fatal error that gin's recovery cannot catch.
// Outside this package, read sessions with GetSession and change them with
// ModifySessions.
var sessionsMu sync.RWMutex

// copySession returns a copy of the session that does not share the token slice.
func copySession(s *models.UserSession) models.UserSession {
	cp := *s
	cp.JWTTokens = append([]string(nil), s.JWTTokens...)
	return cp
}

// GetSession returns a copy of the user session.
func GetSession(username string) (models.UserSession, bool) {
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()

	s := UserSessions[username]
	if s == nil {
		return models.UserSession{}, false
	}
	return copySession(s), true
}

// SessionHasToken reports whether the JWT belongs to the user session.
func SessionHasToken(username, token string) bool {
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()

	s := UserSessions[username]
	if s == nil {
		return false
	}
	for _, t := range s.JWTTokens {
		if t == token {
			return true
		}
	}
	return false
}

// SessionsSnapshot returns a copy of every session.
func SessionsSnapshot() map[string]models.UserSession {
	sessionsMu.RLock()
	defer sessionsMu.RUnlock()

	snapshot := make(map[string]models.UserSession, len(UserSessions))
	for username, s := range UserSessions {
		if s != nil {
			snapshot[username] = copySession(s)
		}
	}
	return snapshot
}

// ModifySessions runs fn with the sessions write lock held. fn may read and
// change the map and its sessions, but must not call the other session
// functions of this package (SaveSessions included): call them after.
func ModifySessions(fn func(sessions map[string]*models.UserSession)) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	fn(UserSessions)
}
