/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"fmt"
	"strings"

	"github.com/nethesis/nethcti-middleware/store"
)

// UserInfo contains the user data needed by transcript authorization checks.
type UserInfo struct {
	DisplayName  string   `json:"-"`
	PhoneNumbers []string `json:"-"`
}

// GetUserInfo keeps compatibility with existing transcript checks by resolving
// the in-memory session token back to the local user/profile store.
func GetUserInfo(nethCTIToken string) (*UserInfo, error) {
	token := strings.TrimSpace(nethCTIToken)
	if token == "" {
		return nil, fmt.Errorf("missing nethcti token")
	}

	for username, session := range store.UserSessions {
		if session == nil || strings.TrimSpace(session.NethCTIToken) != token {
			continue
		}

		displayName, phoneNumbers, err := store.GetUserDisplayInfo(username)
		if err != nil {
			return nil, err
		}

		return &UserInfo{
			DisplayName:  displayName,
			PhoneNumbers: phoneNumbers,
		}, nil
	}

	return nil, fmt.Errorf("user session not found for provided token")
}
