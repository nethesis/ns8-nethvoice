/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/nethesis/nethcti-middleware/logs"
)

// ProfileData represents a profile with capability map
type ProfileData struct {
	ID           string
	Name         string
	Capabilities map[string]bool
}

// UserProfile links a username to a profile
type UserProfile struct {
	Username     string
	Name         string
	ProfileID    string
	Endpoints    UserEndpoints
	PhoneNumbers []string
}

// UserEndpoints contains endpoint data loaded from users.json.
type UserEndpoints struct {
	MainExtension map[string]struct{}
	Extension     map[string]*UserExtension
	Voicemail     map[string]struct{}
	Email         map[string]struct{}
	Cellphone     map[string]struct{}
}

// UserExtension stores details for a single extension endpoint.
type UserExtension struct {
	Type     string
	User     string
	Password string
}

type rawProfile struct {
	ID               string                         `json:"id"`
	Name             string                         `json:"name"`
	MacroPermissions map[string]*rawMacroPermission `json:"macro_permissions"`
}

type rawMacroPermission struct {
	Value       bool             `json:"value"`
	Permissions []*rawPermission `json:"permissions"`
}

type rawPermission struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Value bool   `json:"value"`
}

type rawUser struct {
	Name      string           `json:"name"`
	Endpoints rawUserEndpoints `json:"endpoints"`
	ProfileID string           `json:"profile_id"`
}

type rawUserEndpoints struct {
	MainExtension map[string]struct{}       `json:"mainextension"`
	Extension     map[string]*UserExtension `json:"extension"`
	Voicemail     map[string]struct{}       `json:"voicemail"`
	Email         map[string]struct{}       `json:"email"`
	Cellphone     map[string]struct{}       `json:"cellphone"`
}

// ReloadStats reports in-memory counters after a reload attempt.
type ReloadStats struct {
	ProfilesLoaded int
	UsersLoaded    int
}

var (
	profiles               map[string]*ProfileData
	users                  map[string]*UserProfile
	profileMutex           sync.RWMutex
	profileReloadMu        sync.Mutex
	profilesFilePath       string
	usersFilePath          string
	extensionAccessCurrent bool
)

//go:embed default_profiles.json
var defaultProfilesJSON []byte

// InitProfiles loads profiles and users from JSON files
func InitProfiles(profilesPath, usersPath string) error {
	profileReloadMu.Lock()
	defer profileReloadMu.Unlock()

	profileMutex.Lock()
	extensionAccessCurrent = false
	profileMutex.Unlock()

	profAbs, err := filepath.Abs(profilesPath)
	if err != nil {
		return fmt.Errorf("profiles path: %w", err)
	}

	usersAbs, err := filepath.Abs(usersPath)
	if err != nil {
		return fmt.Errorf("users path: %w", err)
	}

	// Store file paths for reload functionality
	profilesFilePath = profAbs
	usersFilePath = usersAbs

	// Load profiles using temp function
	newProfiles, fromFile, err := loadProfiles(profAbs)
	if err != nil {
		return err
	}

	// Load users using temp function
	newUsers, err := loadUsers(usersAbs, newProfiles)
	if err != nil {
		return err
	}

	// Update global state
	profileMutex.Lock()
	profiles = newProfiles
	users = newUsers
	extensionAccessCurrent = fromFile
	profileMutex.Unlock()

	return nil
}

// GetUserCapabilities returns all capabilities for a given username
func GetUserCapabilities(username string) (map[string]bool, error) {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	user, ok := users[strings.ToLower(username)]
	if !ok {
		return nil, fmt.Errorf("user %s not found", username)
	}

	profile, ok := profiles[user.ProfileID]
	if !ok {
		return nil, fmt.Errorf("profile %s not found for user %s", user.ProfileID, username)
	}

	return profile.Capabilities, nil
}

// GetUserExtensionAccess returns capabilities and owned extensions from the same profile snapshot.
func GetUserExtensionAccess(username string) (map[string]bool, []string, error) {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	if !extensionAccessCurrent {
		return nil, nil, errors.New("extension ownership and permissions are unavailable")
	}
	user := users[strings.ToLower(username)]
	if user == nil || profiles[user.ProfileID] == nil {
		return nil, nil, nil
	}
	// PhoneNumbers is the union of the caller's configured primary and secondary extensions.
	return profiles[user.ProfileID].Capabilities, append([]string(nil), user.PhoneNumbers...), nil
}

// UserExists reports whether the username is a configured user (exact name,
// case insensitive): extensions and other aliases are not users.
func UserExists(username string) bool {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	_, ok := users[strings.ToLower(username)]
	return ok
}

// GetUserProfile returns the profile data for a given username
func GetUserProfile(username string) (*ProfileData, error) {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	user, ok := users[strings.ToLower(username)]
	if !ok {
		return nil, fmt.Errorf("user %s not found", username)
	}

	profile, ok := profiles[user.ProfileID]
	if !ok {
		return nil, fmt.Errorf("profile %s not found for user %s", user.ProfileID, username)
	}

	return profile, nil
}

// GetUserDisplayInfo returns display name and phone numbers for a given user.
func GetUserDisplayInfo(username string) (string, []string, error) {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	user, ok := users[strings.ToLower(username)]
	if !ok {
		return "", nil, fmt.Errorf("user %s not found", username)
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Username
	}

	phoneNumbers := make([]string, len(user.PhoneNumbers))
	copy(phoneNumbers, user.PhoneNumbers)

	return displayName, phoneNumbers, nil
}

// ReloadProfiles reloads profiles and users and returns resulting counters.
func ReloadProfiles() (*ReloadStats, error) {
	profileReloadMu.Lock()
	defer profileReloadMu.Unlock()

	// Load new profiles and users into temporary variables
	newProfiles, fromFile, profilesErr := loadProfiles(profilesFilePath)

	// If profiles failed to load, attempt to reload users against the currently loaded profiles
	var usersTarget map[string]*ProfileData
	if profilesErr != nil {
		profileMutex.RLock()
		usersTarget = profiles
		profileMutex.RUnlock()
	} else {
		usersTarget = newProfiles
	}

	newUsers, usersErr := loadUsers(usersFilePath, usersTarget)

	// Other callers can continue using partial or fallback data. Room creation
	// requires current ownership and permissions from both configured files.
	profileMutex.Lock()
	defer profileMutex.Unlock()
	extensionAccessCurrent = profilesErr == nil && fromFile && usersErr == nil

	// If both failed, return error and keep old data in memory
	if profilesErr != nil && usersErr != nil {
		logs.Log(fmt.Sprintf("[ERROR][AUTH] Failed to reload profiles: %v", profilesErr))
		logs.Log(fmt.Sprintf("[ERROR][AUTH] Failed to reload users: %v", usersErr))
		return nil, fmt.Errorf("reload failed for both profiles and users")
	}

	if profilesErr != nil {
		logs.Log(fmt.Sprintf("[WARNING][AUTH] Failed to reload profiles (keeping previous data): %v", profilesErr))
	}
	if usersErr != nil {
		logs.Log(fmt.Sprintf("[WARNING][AUTH] Failed to reload users (keeping previous data): %v", usersErr))
	}

	if profilesErr == nil {
		profiles = newProfiles
	}
	if usersErr == nil {
		users = newUsers
	}
	return &ReloadStats{ProfilesLoaded: len(profiles), UsersLoaded: len(users)}, nil
}

// loadProfiles loads profiles into a temporary map without modifying global state
func loadProfiles(path string) (map[string]*ProfileData, bool, error) {
	data, err := os.ReadFile(path)
	fromFile := err == nil
	if err != nil {
		// If the provided profiles file cannot be read, fall back to the embedded
		// default. This is a degraded state: the embedded defaults only contain the
		// stock profiles (ids 1/2/3), so any user on a custom profile will be dropped
		// by loadUsers and lose all capability-gated features. Log loudly at ERROR so
		// the real cause (e.g. wrong ownership/permissions on the file) is visible.
		logs.Log(fmt.Sprintf("[ERROR][AUTH] Could not read profiles file %s: %v; falling back to embedded defaults (custom profiles will be unavailable)", path, err))
		data = defaultProfilesJSON
	}

	raw := make(map[string]*rawProfile)
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, false, fmt.Errorf("parse profiles: %w", err)
	}

	result := make(map[string]*ProfileData)
	for key, rp := range raw {
		if rp == nil {
			continue
		}
		profID := rp.ID
		if profID == "" {
			profID = key
		}

		if profID == "" {
			continue
		}

		capMap := make(map[string]bool)
		for macroName, macro := range rp.MacroPermissions {
			if macro == nil {
				continue
			}
			capMap[macroName] = macro.Value
			for _, permission := range macro.Permissions {
				if permission == nil {
					continue
				}
				key := fmt.Sprintf("%s.%s", macroName, permission.Name)
				capMap[key] = permission.Value
			}
		}

		result[profID] = &ProfileData{
			ID:           profID,
			Name:         rp.Name,
			Capabilities: capMap,
		}
	}

	return result, fromFile, nil
}

// loadUsers loads users into a temporary map without modifying global state
func loadUsers(path string, profilesMap map[string]*ProfileData) (map[string]*UserProfile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read users: %w", err)
	}

	raw := make(map[string]*rawUser)
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse users: %w", err)
	}

	result := make(map[string]*UserProfile)
	for username, ru := range raw {
		// A single malformed/unresolvable user must not wipe out every other
		// user: skip it with a loud warning and keep loading the valid ones.
		// Otherwise one bad record blacks out all capability-gated features
		// (e.g. the phonebook) for the entire instance.
		if ru == nil || ru.ProfileID == "" {
			logs.Log(fmt.Sprintf("[WARNING][AUTH] Skipping user %s: missing profile reference", username))
			continue
		}

		if _, ok := profilesMap[ru.ProfileID]; !ok {
			logs.Log(fmt.Sprintf("[WARNING][AUTH] Skipping user %s: references unknown profile %s", username, ru.ProfileID))
			continue
		}

		phoneSet := make(map[string]struct{})
		for exten := range ru.Endpoints.Extension {
			phoneSet[exten] = struct{}{}
		}
		for exten := range ru.Endpoints.MainExtension {
			phoneSet[exten] = struct{}{}
		}

		phoneNumbers := make([]string, 0, len(phoneSet))
		for exten := range phoneSet {
			phoneNumbers = append(phoneNumbers, exten)
		}
		sort.Strings(phoneNumbers)

		// Login/JWT usernames are matched case-insensitively (Asterisk/AMI auth
		// lowercases the login, while /etc/nethcti/users.json keys keep the
		// original display-name casing from FreePBX). Index by the lowercased
		// form so lookups from GetUserCapabilities/GetUserProfile/GetUserDisplayInfo
		// succeed regardless of case, while preserving the original casing for display.
		result[strings.ToLower(username)] = &UserProfile{
			Username:  username,
			Name:      ru.Name,
			ProfileID: ru.ProfileID,
			Endpoints: UserEndpoints{
				MainExtension: ru.Endpoints.MainExtension,
				Extension:     ru.Endpoints.Extension,
				Voicemail:     ru.Endpoints.Voicemail,
				Email:         ru.Endpoints.Email,
				Cellphone:     ru.Endpoints.Cellphone,
			},
			PhoneNumbers: phoneNumbers,
		}
	}

	return result, nil
}
