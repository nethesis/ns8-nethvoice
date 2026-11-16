/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	jwtv5 "github.com/golang-jwt/jwt/v5"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
)

// PersistedSession represents minimal session data needed for persistence
type PersistedSession struct {
	Username     string   `json:"username"`
	JWTTokens    []string `json:"jwt_tokens"`
	NethCTIToken string   `json:"nethcti_token"`
}

var (
	persistenceMutex sync.RWMutex
	persistencePath  string
)

// InitPersistence sets up the persistence file path
func InitPersistence(dataDir string) {
	persistencePath = filepath.Join(dataDir, "sessions.json")
	logs.Log("[INFO][PERSISTENCE] Session persistence initialized at " + persistencePath)
}

// Saves current user sessions to disk
func SaveSessions() error {
	if persistencePath == "" {
		return nil // Persistence not initialized
	}

	persistenceMutex.Lock()
	defer persistenceMutex.Unlock()

	// Convert UserSessions to PersistedSession format
	snapshot := SessionsSnapshot()
	sessions := make([]PersistedSession, 0, len(snapshot))
	for username, session := range snapshot {
		sessions = append(sessions, PersistedSession{
			Username:     username,
			JWTTokens:    session.JWTTokens,
			NethCTIToken: session.NethCTIToken,
		})
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		logs.Log("[ERROR][PERSISTENCE] Failed to marshal sessions: " + err.Error())
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(persistencePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		logs.Log("[ERROR][PERSISTENCE] Failed to create directory: " + err.Error())
		return err
	}

	// Write to file atomically (write to temp file, then rename)
	tempPath := persistencePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0600); err != nil {
		logs.Log("[ERROR][PERSISTENCE] Failed to write sessions file: " + err.Error())
		return err
	}

	if err := os.Rename(tempPath, persistencePath); err != nil {
		logs.Log("[ERROR][PERSISTENCE] Failed to rename sessions file: " + err.Error())
		os.Remove(tempPath) // Cleanup
		return err
	}

	return nil
}

// LoadSessions loads user sessions from disk
func LoadSessions() error {
	if persistencePath == "" {
		return nil // Persistence not initialized
	}

	persistenceMutex.RLock()
	defer persistenceMutex.RUnlock()

	// Check if file exists
	if _, err := os.Stat(persistencePath); os.IsNotExist(err) {
		logs.Log("[INFO][PERSISTENCE] No persisted sessions found (first run)")
		return nil
	}

	// Read file
	data, err := os.ReadFile(persistencePath)
	if err != nil {
		logs.Log("[ERROR][PERSISTENCE] Failed to read sessions file: " + err.Error())
		return err
	}

	// Unmarshal JSON
	var sessions []PersistedSession
	if err := json.Unmarshal(data, &sessions); err != nil {
		logs.Log("[ERROR][PERSISTENCE] Failed to unmarshal sessions: " + err.Error())
		return err
	}

	// Restore sessions to UserSessions map
	loadedCount := 0
	ModifySessions(func(userSessions map[string]*models.UserSession) {
		for _, ps := range sessions {
			// Recreate UserSession
			userSessions[ps.Username] = &models.UserSession{
				Username:     ps.Username,
				JWTTokens:    ps.JWTTokens,
				NethCTIToken: ps.NethCTIToken,
				OTP_Verified: false, // Will be validated from JWT claims
			}
			loadedCount++
		}
	})

	logs.Log(fmt.Sprintf("[INFO][PERSISTENCE] Loaded %d session(s) from disk", loadedCount))
	return nil
}

func RemoveJWTToken(username, tokenToRemove string) error {
	found := false
	removedSession := ""
	ModifySessions(func(userSessions map[string]*models.UserSession) {
		userSession := userSessions[username]
		if userSession == nil {
			return
		}
		found = true

		updatedTokens := make([]string, 0, len(userSession.JWTTokens))
		for _, token := range userSession.JWTTokens {
			if token != tokenToRemove {
				updatedTokens = append(updatedTokens, token)
			}
		}
		userSession.JWTTokens = updatedTokens

		// Remove user session if no tokens remain
		if len(updatedTokens) == 0 {
			delete(userSessions, username)
			removedSession = userSession.NethCTIToken
		}
	})
	if !found {
		return fmt.Errorf("no session found for user %s", username)
	}

	if removedSession != "" {
		revokeLegacyToken(username, removedSession)
	}

	// Persist changes
	if err := SaveSessions(); err != nil {
		return fmt.Errorf("failed to save sessions after token removal: %w", err)
	}

	return nil
}

func RemoveAllJWTTokens(username string) error {
	var removed *models.UserSession
	ModifySessions(func(userSessions map[string]*models.UserSession) {
		removed = userSessions[username]
		if removed != nil {
			removed.JWTTokens = []string{}
			delete(userSessions, username)
		}
	})
	if removed == nil {
		return fmt.Errorf("no session found for user %s", username)
	}

	// Revoke legacy session as well
	revokeLegacyToken(username, removed.NethCTIToken)

	// Persist changes
	if err := SaveSessions(); err != nil {
		return fmt.Errorf("failed to save sessions after removing all tokens: %w", err)
	}

	return nil
}

// RemoveSessionJWTTokens removes the login tokens of the user except keep.
// Integration tokens (issued with an audience) stay valid. Returns how many
// tokens were removed.
func RemoveSessionJWTTokens(username, keep string) (int, error) {
	parser := jwtv5.NewParser(jwtv5.WithoutClaimsValidation())
	removed := 0
	removedSession := ""
	ModifySessions(func(userSessions map[string]*models.UserSession) {
		userSession := userSessions[username]
		if userSession == nil {
			return
		}

		updatedTokens := make([]string, 0, len(userSession.JWTTokens))
		for _, token := range userSession.JWTTokens {
			claims := jwtv5.MapClaims{}
			_, _, err := parser.ParseUnverified(token, claims)
			if token == keep || (err == nil && claims["aud"] != nil) {
				updatedTokens = append(updatedTokens, token)
			}
		}

		removed = len(userSession.JWTTokens) - len(updatedTokens)
		if removed == 0 {
			return
		}
		userSession.JWTTokens = updatedTokens

		// Remove user session if no tokens remain
		if len(updatedTokens) == 0 {
			delete(userSessions, username)
			removedSession = userSession.NethCTIToken
		}
	})
	if removed == 0 {
		return 0, nil
	}

	if removedSession != "" {
		revokeLegacyToken(username, removedSession)
	}

	if err := SaveSessions(); err != nil {
		return removed, fmt.Errorf("failed to save sessions after token removal: %w", err)
	}

	return removed, nil
}

// revokeLegacyToken revokes the legacy persistent token (subtype "user") of a
// session already removed from UserSessions. It does not hold the sessions
// lock, as it calls the V1 server.
func revokeLegacyToken(username, NethCTIToken string) {
	if NethCTIToken == "" {
		return
	}

	legacyURL := configuration.Config.V1Protocol + "://" + configuration.Config.V1ApiEndpoint + configuration.Config.V1ApiPath + "/authentication/persistent_token_remove"
	removePayload := struct {
		Type    string `json:"type"`
		Subtype string `json:"subtype"`
	}{Type: "phone-island", Subtype: "user"}
	removePayloadBytes, _ := json.Marshal(removePayload)
	req, err := http.NewRequest("POST", legacyURL, bytes.NewBuffer(removePayloadBytes))
	if err != nil {
		logs.Log("[ERROR][AUTH] Failed to build revoke request for user " + username + ": " + err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", NethCTIToken)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logs.Log("[ERROR][AUTH] Failed to revoke legacy persistent token for user " + username + ": " + err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		logs.Log("[INFO][AUTH] Deleted session and revoked legacy persistent token (user:token) for user " + username)
	} else {
		logs.Log("[WARN][AUTH] Legacy persistent token revoke returned status " + resp.Status)
	}
}
