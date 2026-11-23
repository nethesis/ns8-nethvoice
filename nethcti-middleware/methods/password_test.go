/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/nethesis/nethcti-middleware/configuration"
)

func TestIsExpired(t *testing.T) {
	past := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	invalid := "not a date"

	assert.False(t, isExpired(nil))
	assert.True(t, isExpired(&past))
	assert.False(t, isExpired(&future))
	assert.False(t, isExpired(&invalid))
}

func TestValidUsername(t *testing.T) {
	assert.True(t, validUsername("mario"))
	assert.True(t, validUsername("mario.rossi"))
	assert.False(t, validUsername(""))
	assert.False(t, validUsername("."))
	assert.False(t, validUsername(".."))
	assert.False(t, validUsername("../mario"))
	assert.False(t, validUsername("a\\b"))
	assert.False(t, validUsername("mario\n[INFO] forged"))
}

func TestPasswordInfoStorage(t *testing.T) {
	configuration.Config.SecretsDir = t.TempDir()
	expiration := "2026-12-21T07:51:25Z"

	_, err := readPasswordInfo("mario")
	assert.Error(t, err)

	configuration.Config.UserPortalURL = "http://portal-a"
	assert.NoError(t, writePasswordInfo("mario", passwordInfo{Expiration: &expiration, PortalURL: "http://portal-a"}))
	info, err := readPasswordInfo("mario")
	assert.NoError(t, err)
	assert.Equal(t, expiration, *info.Expiration)
	assert.Nil(t, info.Policy)

	// the info of the previous provider is ignored
	configuration.Config.UserPortalURL = "http://portal-b"
	_, err = readPasswordInfo("mario")
	assert.Error(t, err)
}

func TestPortalDisabled(t *testing.T) {
	configuration.Config.UserPortalURL = ""
	expired, policy := IsPasswordExpired(context.Background(), "mario", "secret")
	assert.False(t, expired)
	assert.Nil(t, policy)
}

func TestRefreshing(t *testing.T) {
	assert.False(t, isRefreshing("alice"))

	// overlapping logins: refreshing until the last one is done
	setRefreshing("alice", 1)
	setRefreshing("alice", 1)
	assert.True(t, isRefreshing("alice"))
	assert.False(t, isRefreshing("bob"))
	setRefreshing("alice", -1)
	assert.True(t, isRefreshing("alice"))
	setRefreshing("alice", -1)
	assert.False(t, isRefreshing("alice"))
}
