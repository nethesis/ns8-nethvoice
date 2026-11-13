/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

type voicemailListResponse struct {
	Count int                      `json:"count"`
	Rows  []map[string]interface{} `json:"rows"`
}

var (
	fetchLegacyVoicemailListFunc = fetchLegacyVoicemailListFromV1
	proxyV1RequestFunc           = ProxyV1Request
)

// ListVoicemailByID returns a single voicemail by DB id when :id is numeric.
// For legacy list types such as "all", "old" or "inbox", it transparently
// falls back to the V1 voicemail endpoint to preserve existing behavior.
func ListVoicemailByID(c *gin.Context) {
	voicemailID := strings.TrimSpace(c.Param("id"))
	if voicemailID == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "voicemail id is required",
			Data:    nil,
		}))
		return
	}

	if !isNumericVoicemailID(voicemailID) {
		proxyV1RequestFunc(c, c.Request.URL.Path, false)
		return
	}

	username, err := getUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
			Code:    http.StatusUnauthorized,
			Message: "unauthorized",
			Data:    nil,
		}))
		return
	}

	userSession := store.UserSessions[username]
	if userSession == nil || strings.TrimSpace(userSession.NethCTIToken) == "" {
		c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
			Code:    http.StatusUnauthorized,
			Message: "user session not found",
			Data:    nil,
		}))
		return
	}

	voicemailList, err := fetchLegacyVoicemailListFunc(userSession.NethCTIToken)
	if err != nil {
		logs.Log("[ERROR][VOICEMAIL] Failed to fetch voicemail list for user " + username + ": " + err.Error())
		c.JSON(http.StatusBadGateway, gin.H{
			"code":    http.StatusBadGateway,
			"message": "failed to fetch voicemail list",
			"data":    nil,
		})
		return
	}

	filteredRows := make([]map[string]interface{}, 0, 1)
	for _, row := range voicemailList.Rows {
		if getVoicemailRowID(row) == voicemailID {
			filteredRows = append(filteredRows, row)
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(filteredRows),
		"rows":  filteredRows,
	})
}

func fetchLegacyVoicemailListFromV1(nethCTIToken string) (*voicemailListResponse, error) {
	if configuration.Config.V1ApiEndpoint == "" {
		return nil, fmt.Errorf("V1 API endpoint not configured")
	}

	url := configuration.Config.V1Protocol + "://" + configuration.Config.V1ApiEndpoint + configuration.Config.V1ApiPath + "/voicemail/list/all"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", nethCTIToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected V1 response status: %d", resp.StatusCode)
	}

	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()

	var result voicemailListResponse
	if err := decoder.Decode(&result); err != nil {
		return nil, err
	}

	if result.Rows == nil {
		result.Rows = []map[string]interface{}{}
	}

	return &result, nil
}

func isNumericVoicemailID(value string) bool {
	if value == "" {
		return false
	}

	for _, char := range value {
		if char < '0' || char > '9' {
			return false
		}
	}

	return true
}

func getVoicemailRowID(row map[string]interface{}) string {
	if row == nil {
		return ""
	}

	switch value := row["id"].(type) {
	case string:
		return value
	case json.Number:
		return value.String()
	case float64:
		return strconv.FormatInt(int64(value), 10)
	case float32:
		return strconv.FormatInt(int64(value), 10)
	case int:
		return strconv.Itoa(value)
	case int32:
		return strconv.FormatInt(int64(value), 10)
	case int64:
		return strconv.FormatInt(value, 10)
	default:
		return fmt.Sprintf("%v", value)
	}
}
