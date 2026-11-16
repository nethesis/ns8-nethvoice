/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"net/http"
	"strings"

	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

type nethlinkHeartbeatRequest struct {
	Extension       string `json:"extension"`
	NethlinkVersion string `json:"nethlink_version"`
	OsType          string `json:"os_type"`
	OsRelease       string `json:"os_release"`
	Arch            string `json:"arch"`
}

// NethlinkHeartbeat records a NethLink last-seen for the authenticated user. It supersedes
// the legacy nethcti-server POST /user/nethlink (previously reached via the V1 proxy) and
// additionally persists the client version and OS details sent in the body. The username
// comes from the JWT; the extension is taken from the body since the JWT does not carry it.
func NethlinkHeartbeat(c *gin.Context) {
	username, err := getUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
			Code:    http.StatusUnauthorized,
			Message: "unauthorized",
			Data:    nil,
		}))
		return
	}

	var req nethlinkHeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Keep backward compatibility: an empty/malformed body still records a heartbeat.
		req = nethlinkHeartbeatRequest{}
	}

	if err := store.SetNethlinkHeartbeat(c.Request.Context(), store.NethlinkHeartbeat{
		Username:        username,
		Extension:       strings.TrimSpace(req.Extension),
		NethlinkVersion: strings.TrimSpace(req.NethlinkVersion),
		OsType:          strings.TrimSpace(req.OsType),
		OsRelease:       strings.TrimSpace(req.OsRelease),
		Arch:            strings.TrimSpace(req.Arch),
	}); err != nil {
		logs.Log("[ERROR][NETHLINK] failed to store heartbeat for user " + username + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusInternalServerError{
			Code:    http.StatusInternalServerError,
			Message: "failed to store heartbeat",
			Data:    nil,
		}))
		return
	}

	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    http.StatusOK,
		Message: "success",
		Data:    nil,
	}))
}
