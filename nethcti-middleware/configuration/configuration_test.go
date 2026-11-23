/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package configuration

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

// setRequiredEnv sets the environment variables Init() requires to avoid
// calling os.Exit(1), leaving global-rate-limit vars untouched.
func setRequiredEnv(t *testing.T) {
	t.Helper()
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_API_ENDPOINT", "127.0.0.1:9999")
	os.Setenv("NETHVOICE_MIDDLEWARE_V1_WS_ENDPOINT", "127.0.0.1:9999")
	os.Setenv("NETHVOICE_MIDDLEWARE_SECRETS_DIR", t.TempDir())
}

func TestInitGlobalRateLimitDefaults(t *testing.T) {
	setRequiredEnv(t)
	os.Unsetenv("NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_AVERAGE")
	os.Unsetenv("NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_BURST")

	Init()

	assert.Equal(t, 25, Config.GlobalRateLimitAverage)
	assert.Equal(t, 100, Config.GlobalRateLimitBurst)
}

func TestInitGlobalRateLimitFromEnv(t *testing.T) {
	setRequiredEnv(t)
	os.Setenv("NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_AVERAGE", "50")
	os.Setenv("NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_BURST", "150")
	defer os.Unsetenv("NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_AVERAGE")
	defer os.Unsetenv("NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_BURST")

	Init()

	assert.Equal(t, 50, Config.GlobalRateLimitAverage)
	assert.Equal(t, 150, Config.GlobalRateLimitBurst)
}
