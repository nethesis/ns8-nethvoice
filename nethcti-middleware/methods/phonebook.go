/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
)

// PhonebookImportResponse represents the response from a CSV import
type PhonebookImportResponse struct {
	Message       string   `json:"message"`
	TotalRows     int      `json:"total_rows"`
	ImportedRows  int      `json:"imported_rows"`
	FailedRows    int      `json:"failed_rows"`
	SkippedRows   int      `json:"skipped_rows"`
	ErrorMessages []string `json:"error_messages,omitempty"`
}

// parsePhonebookCSV parses and validates a CSV file, returning parsed phonebook entries without OwnerID set.
// Caller is responsible for setting OwnerID on returned entries before persistence.
func parsePhonebookCSV(file io.Reader) ([]*store.PhonebookEntry, *PhonebookImportResponse, error) {
	// Parse CSV
	reader := csv.NewReader(file)

	// Read header
	header, err := reader.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("CSV header read error: %w", err)
	}

	// Validate header format: must have at least "name"
	if len(header) < 1 {
		return nil, &PhonebookImportResponse{
			Message:       "phonebook import failed",
			ErrorMessages: []string{"CSV must have at least 'name' column"},
		}, nil
	}

	// Build column index map (case-insensitive)
	columnIndices := make(map[string]int)
	for i, col := range header {
		colLower := strings.ToLower(strings.TrimSpace(col))
		columnIndices[colLower] = i
	}

	// Validate required "name" column
	if _, hasName := columnIndices["name"]; !hasName {
		return nil, &PhonebookImportResponse{
			Message:       "phonebook import failed",
			ErrorMessages: []string{"CSV must have 'name' column"},
		}, nil
	}

	// Parse and import records
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var entries []*store.PhonebookEntry
	var errorMessages []string
	totalRows := 0
	skippedRows := 0

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			logs.Log("[ERROR][PHONEBOOK] CSV read error: " + err.Error())
			errorMessages = append(errorMessages, fmt.Sprintf("Row %d: %s", totalRows+2, err.Error()))
			continue
		}

		totalRows++

		// Helper function to safely extract field value from record
		getField := func(fieldName string) string {
			if idx, ok := columnIndices[fieldName]; ok && idx < len(record) {
				return strings.TrimSpace(record[idx])
			}
			return ""
		}

		// Extract and validate name (required)
		name := getField("name")
		if name == "" {
			skippedRows++
			errorMessages = append(errorMessages, fmt.Sprintf("Row %d: name is empty", totalRows+1))
			continue
		}

		// Extract type and validate (private/public or shared-group syntax, default to private)
		entryType := getField("type")
		if entryType == "" {
			entryType = "private"
		} else {
			entryTypeLower := strings.ToLower(entryType)
			switch {
			case entryTypeLower == "private" || entryTypeLower == "public":
				entryType = entryTypeLower
			case store.IsValidGroupContactType(entryType):
				entryType = store.EncodeSharedGroupsType(store.GetSharedGroupsFromType(entryType))
			default:
				skippedRows++
				errorMessages = append(errorMessages, fmt.Sprintf("Row %d: invalid type '%s' (must be 'private', 'public', or 'group:<group1,group2>')", totalRows+1, getField("type")))
				continue
			}
		}

		// Extract all available fields (OwnerID will be set by caller)
		entry := &store.PhonebookEntry{
			Name:           name,
			Type:           entryType,
			WorkEmail:      getField("workemail"),
			HomeEmail:      getField("homeemail"),
			WorkPhone:      getField("workphone"),
			HomePhone:      getField("homephone"),
			CellPhone:      getField("cellphone"),
			Fax:            getField("fax"),
			Title:          getField("title"),
			Company:        getField("company"),
			Notes:          getField("notes"),
			HomeStreet:     getField("homestreet"),
			HomePOB:        getField("homepob"),
			HomeCity:       getField("homecity"),
			HomeProvince:   getField("homeprovince"),
			HomePostalCode: getField("homepostalcode"),
			HomeCountry:    getField("homecountry"),
			WorkStreet:     getField("workstreet"),
			WorkPOB:        getField("workpob"),
			WorkCity:       getField("workcity"),
			WorkProvince:   getField("workprovince"),
			WorkPostalCode: getField("workpostalcode"),
			WorkCountry:    getField("workcountry"),
			URL:            getField("url"),
			Extension:      getField("extension"),
			SpeedDialNum:   getField("speeddial_num"),
		}

		entries = append(entries, entry)
	}

	_ = ctx // context used above, keep reference

	response := &PhonebookImportResponse{
		Message:       "phonebook import completed",
		TotalRows:     totalRows,
		ImportedRows:  0, // Will be set by caller after persistence
		FailedRows:    0, // Will be set by caller after persistence
		SkippedRows:   skippedRows,
		ErrorMessages: errorMessages,
	}

	return entries, response, nil
}

// entriesContainPublic reports whether any parsed entry is a public contact, i.e. one
// that must be republished to the centralized phonebook for call-time name resolution.
func entriesContainPublic(entries []*store.PhonebookEntry) bool {
	for _, entry := range entries {
		if strings.EqualFold(strings.TrimSpace(entry.Type), "public") {
			return true
		}
	}
	return false
}

// AdminImportPhonebookCSV handles CSV phonebook imports for admin users.
// Admin can import contacts into any target user's phonebook by specifying the username form field.
// Requires super admin bearer token authentication.
func AdminImportPhonebookCSV(c *gin.Context) {
	// Get target username from form field
	targetUsername := strings.TrimSpace(c.Request.FormValue("username"))
	if targetUsername == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "username field is required"})
		return
	}

	// Get the uploaded file
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "file required", "error": err.Error()})
		return
	}
	defer file.Close()

	// Parse CSV using shared helper
	entries, response, err := parsePhonebookCSV(file)
	if err != nil {
		logs.Log("[ERROR][PHONEBOOK] Admin CSV parsing error: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid CSV file", "error": err.Error()})
		return
	}

	// If response has errors but no entries were parsed, return error response
	if len(entries) == 0 && len(response.ErrorMessages) > 0 {
		c.JSON(http.StatusBadRequest, response)
		return
	}

	// Set OwnerID for all entries to the target user
	for _, entry := range entries {
		entry.OwnerID = targetUsername
	}

	// Perform batch import
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	successful, failed, err := store.BatchInsertPhonebookEntries(ctx, entries)
	if err != nil {
		logs.Log("[ERROR][PHONEBOOK] Admin batch import error: " + err.Error())
		response.ErrorMessages = append(response.ErrorMessages, "Database error: "+err.Error())
	}

	response.ImportedRows = successful
	response.FailedRows = failed

	if successful > 0 && entriesContainPublic(entries) {
		scheduleSyncCentralizedPublicContactsFunc()
	}

	// Log admin action with user profile info for audit trail
	logs.Log(fmt.Sprintf("[INFO][PHONEBOOK] Admin imported %d contacts for user %s (total_rows: %d, failed: %d, skipped: %d)",
		successful, targetUsername, response.TotalRows, failed, response.SkippedRows))

	c.JSON(http.StatusOK, response)
}

// ImportPhonebookCSV handles CSV phonebook imports for the authenticated user.
// Requires JWT bearer token authentication.
func ImportPhonebookCSV(c *gin.Context) {
	// Extract username from JWT claims
	claims := jwt.ExtractClaims(c)
	username, ok := claims["id"].(string)
	if !ok || username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid user"})
		return
	}

	// Get the uploaded file
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "file required", "error": err.Error()})
		return
	}
	defer file.Close()

	// Parse CSV using shared helper
	entries, response, err := parsePhonebookCSV(file)
	if err != nil {
		logs.Log("[ERROR][PHONEBOOK] CSV parsing error: " + err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid CSV file", "error": err.Error()})
		return
	}

	// If response has errors but no entries were parsed, return error response
	if len(entries) == 0 && len(response.ErrorMessages) > 0 {
		c.JSON(http.StatusBadRequest, response)
		return
	}

	// Set OwnerID for all entries to the authenticated user
	for _, entry := range entries {
		entry.OwnerID = username
	}

	// Perform batch import
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	successful, failed, err := store.BatchInsertPhonebookEntries(ctx, entries)
	if err != nil {
		logs.Log("[ERROR][PHONEBOOK] batch import error: " + err.Error())
		response.ErrorMessages = append(response.ErrorMessages, "Database error: "+err.Error())
	}

	response.ImportedRows = successful
	response.FailedRows = failed

	if successful > 0 && entriesContainPublic(entries) {
		scheduleSyncCentralizedPublicContactsFunc()
	}

	// Log user action for audit trail
	logs.Log(fmt.Sprintf("[INFO][PHONEBOOK] User %s imported %d contacts (total_rows: %d, failed: %d, skipped: %d)",
		username, successful, response.TotalRows, failed, response.SkippedRows))

	c.JSON(http.StatusOK, response)
}
