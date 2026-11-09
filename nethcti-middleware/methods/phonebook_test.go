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

func TestParsePhonebookCSV_NewFieldsImported(t *testing.T) {
	csvContent := strings.NewReader(
		"name,firstname,lastname,job,facebook,instagram,linkedin,workphone2,cellphone2,otherphone,otheremail\n" +
			"Alice Rossi,Alice,Rossi,Engineer,fb.me/alice,@alice,in/alice,+390111,+390222,+390333,alice.other@example.com\n",
	)

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 1)
	entry := entries[0]
	assert.Equal(t, "Alice", entry.FirstName)
	assert.Equal(t, "Rossi", entry.LastName)
	assert.Equal(t, "Engineer", entry.Job)
	assert.Equal(t, "fb.me/alice", entry.Facebook)
	assert.Equal(t, "@alice", entry.Instagram)
	assert.Equal(t, "in/alice", entry.LinkedIn)
	assert.Equal(t, "+390111", entry.WorkPhone2)
	assert.Equal(t, "+390222", entry.CellPhone2)
	assert.Equal(t, "+390333", entry.OtherPhone)
	assert.Equal(t, "alice.other@example.com", entry.OtherEmail)
	assert.Equal(t, 0, response.SkippedRows)
	assert.Empty(t, response.ErrorMessages)
}

func TestParsePhonebookCSV_MissingNameColumn(t *testing.T) {
	csvContent := strings.NewReader("workphone,company\n+39123,ACME\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	assert.Empty(t, entries)
	require.NotNil(t, response)
	require.Len(t, response.ErrorMessages, 1)
	assert.Contains(t, response.ErrorMessages[0], "'name'")
}

func TestParsePhonebookCSV_NameComposedFromFirstAndLastName(t *testing.T) {
	csvContent := strings.NewReader("firstname,lastname,workphone\nAlice,Smith,+39123\n,Rossi,+39456\nMario,,+39789\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 3)
	assert.Equal(t, "Alice Smith", entries[0].Name)
	assert.Equal(t, "Alice", entries[0].FirstName)
	assert.Equal(t, "Smith", entries[0].LastName)
	assert.Equal(t, "Rossi", entries[1].Name)
	assert.Equal(t, "Mario", entries[2].Name)
	assert.Equal(t, 0, response.SkippedRows)
	assert.Empty(t, response.ErrorMessages)
}

func TestParsePhonebookCSV_EmptyNameFallsBackToFirstAndLastName(t *testing.T) {
	csvContent := strings.NewReader("name,firstname,lastname\nACME Support,Alice,Smith\n,Bob,Brown\n,,\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 2)
	assert.Equal(t, "ACME Support", entries[0].Name)
	assert.Equal(t, "Bob Brown", entries[1].Name)
	assert.Equal(t, 1, response.SkippedRows)
	require.Len(t, response.ErrorMessages, 1)
	assert.Contains(t, response.ErrorMessages[0], "Row 4")
	assert.Contains(t, response.ErrorMessages[0], "name is empty")
}

func TestParsePhonebookCSV_OnlyHeaderNoRows(t *testing.T) {
	csvContent := strings.NewReader("name,workphone\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	assert.Empty(t, entries)
	assert.Equal(t, 0, response.TotalRows)
	assert.Equal(t, 0, response.SkippedRows)
	assert.Empty(t, response.ErrorMessages)
}

func TestParsePhonebookCSV_EmptyNameRowSkippedWithLineNumber(t *testing.T) {
	// header (line 1), empty-name row (line 2), valid row (line 3).
	csvContent := strings.NewReader("name,workphone\n,+39123\nBob,+39456\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, "Bob", entries[0].Name)
	assert.Equal(t, 1, response.SkippedRows)
	require.Len(t, response.ErrorMessages, 1)
	assert.Contains(t, response.ErrorMessages[0], "Row 2")
	assert.Contains(t, response.ErrorMessages[0], "name is empty")
}

func TestParsePhonebookCSV_MalformedRowSkippedNotFatal(t *testing.T) {
	// Row 2 has the wrong field count (csv.ErrFieldCount): it must be skipped,
	// reported at its own line, and parsing must continue to the valid row 3.
	csvContent := strings.NewReader("name,workphone\nAlice,+39123,extra\nBob,+39456\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, "Bob", entries[0].Name)
	assert.Equal(t, 1, response.SkippedRows)
	require.Len(t, response.ErrorMessages, 1)
	assert.Contains(t, response.ErrorMessages[0], "Row 2")
}

func TestParsePhonebookCSV_BareQuoteRowSkippedNotFatal(t *testing.T) {
	// A bare/unescaped quote yields csv.ErrBareQuote (a *csv.ParseError, not
	// ErrFieldCount). encoding/csv recovers on the next Read, so the offending
	// row must be skipped while every following valid row is still imported —
	// it must NOT abort the whole import.
	csvContent := strings.NewReader("name,workphone\nAli\"ce,123\nBob,456\nCarol,789\n")

	entries, response, err := parsePhonebookCSV(csvContent)

	require.NoError(t, err)
	require.Len(t, entries, 2)
	assert.Equal(t, "Bob", entries[0].Name)
	assert.Equal(t, "Carol", entries[1].Name)
	assert.Equal(t, 1, response.SkippedRows)
	require.Len(t, response.ErrorMessages, 1)
	assert.Contains(t, response.ErrorMessages[0], "Row 2")
}