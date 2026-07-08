/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParsePhonebookCSV_GroupTypeAccepted(t *testing.T) {
	csvContent := strings.NewReader("name,type,workphone\nAlice,\"group: Sales,Support,Sales \",+39123\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, "group:Sales,Support", entries[0].Type)
	assert.Equal(t, 1, response.TotalRows)
	assert.Equal(t, 0, response.SkippedRows)
	assert.Empty(t, response.ErrorMessages)
}

func TestParsePhonebookCSV_InvalidGroupTypeRejected(t *testing.T) {
	csvContent := strings.NewReader("name,type\nAlice,group:public\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	assert.Empty(t, entries)
	assert.Equal(t, 1, response.TotalRows)
	assert.Equal(t, 1, response.SkippedRows)
	require.Len(t, response.ErrorMessages, 1)
	assert.Contains(t, response.ErrorMessages[0], "invalid type")
}

func TestParsePhonebookCSV_TraditionalTypesStillAccepted(t *testing.T) {
	csvContent := strings.NewReader("name,type\nAlice,Public\nBob,private\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 2)
	assert.Equal(t, "public", entries[0].Type)
	assert.Equal(t, "private", entries[1].Type)
	assert.Equal(t, 2, response.TotalRows)
	assert.Equal(t, 0, response.SkippedRows)
}