/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	// Handler tests stub the satellite queries: report the database as reachable.
	satelliteDBAvailableFunc = func() bool { return true }
	os.Exit(m.Run())
}
