/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package logs

import (
	"bytes"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// captureLog redirects the package logger to a buffer, keeping the flags and
// prefix Init sets up.
func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()

	previous := Logs
	t.Cleanup(func() { Logs = previous })

	Init("nethcti-middleware")

	var buf bytes.Buffer
	Logs.SetOutput(&buf)
	return &buf
}

func TestLogReportsTheCallerFileNotTheLogsWrapper(t *testing.T) {
	buf := captureLog(t)

	Log("[INFO][TEST] hello")
	line := buf.String()

	assert.Contains(t, line, "logs_test.go:",
		"Lshortfile must resolve the caller of Log, not the wrapper")
	assert.NotContains(t, line, "logs.go:",
		"every entry used to be labelled with this file and line")
}

func TestLogDoesNotPrintItsOwnTimestamp(t *testing.T) {
	buf := captureLog(t)

	Log("[INFO][TEST] hello")
	line := buf.String()

	// journald stamps every entry already; a second date and time would only
	// repeat it, in the container timezone.
	assert.NotRegexp(t, regexp.MustCompile(`\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}`), line)
}

func TestLogKeepsPrefixAndMessage(t *testing.T) {
	buf := captureLog(t)

	Log("[WARNING][TEST] something happened")
	line := strings.TrimSuffix(buf.String(), "\n")

	assert.True(t, strings.HasPrefix(line, "nethcti-middleware "), "got %q", line)
	assert.True(t, strings.HasSuffix(line, "[WARNING][TEST] something happened"), "got %q", line)
}

func TestLogIsANoOpBeforeInit(t *testing.T) {
	previous := Logs
	t.Cleanup(func() { Logs = previous })

	Logs = nil
	assert.NotPanics(t, func() { Log("[INFO][TEST] dropped") })
}
