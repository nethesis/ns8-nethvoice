/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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
	profiles         map[string]*ProfileData
	users            map[string]*UserProfile
	profileMutex     sync.RWMutex
	profilesFilePath string
	usersFilePath    string
)

//go:embed default_profiles.json
var defaultProfilesJSON []byte

// InitProfiles loads profiles and users from JSON files
func InitProfiles(profilesPath, usersPath string) error {
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
	newProfiles, err := loadProfiles(profAbs)
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
	profileMutex.Unlock()

	return nil
}

// GetUserCapabilities returns all capabilities for a given username
func GetUserCapabilities(username string) (map[string]bool, error) {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	user, ok := users[username]
	if !ok {
		return nil, fmt.Errorf("user %s not found", username)
	}

	profile, ok := profiles[user.ProfileID]
	if !ok {
		return nil, fmt.Errorf("profile %s not found for user %s", user.ProfileID, username)
	}

	return profile.Capabilities, nil
}

// GetUserProfile returns the profile data for a given username
func GetUserProfile(username string) (*ProfileData, error) {
	profileMutex.RLock()
	defer profileMutex.RUnlock()

	user, ok := users[username]
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

	user, ok := users[username]
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
	// Load new profiles and users into temporary variables
	newProfiles, profilesErr := loadProfiles(profilesFilePath)

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

	// If both failed, return error and keep old data in memory
	if profilesErr != nil && usersErr != nil {
		logs.Log(fmt.Sprintf("[ERROR][AUTH] Failed to reload profiles: %v", profilesErr))
		logs.Log(fmt.Sprintf("[ERROR][AUTH] Failed to reload users: %v", usersErr))
		return nil, fmt.Errorf("reload failed for both profiles and users")
	}

	stats := &ReloadStats{}

	// Update profiles if load succeeded, otherwise keep old data
	if profilesErr != nil {
		logs.Log(fmt.Sprintf("[WARNING][AUTH] Failed to reload profiles (keeping previous data): %v", profilesErr))
		profileMutex.RLock()
		stats.ProfilesLoaded = len(profiles)
		profileMutex.RUnlock()
	} else {
		profileMutex.Lock()
		profiles = newProfiles
		profileMutex.Unlock()
		stats.ProfilesLoaded = len(newProfiles)
	}

	// Update users if load succeeded, otherwise keep old data
	if usersErr != nil {
		logs.Log(fmt.Sprintf("[WARNING][AUTH] Failed to reload users (keeping previous data): %v", usersErr))
		profileMutex.RLock()
		stats.UsersLoaded = len(users)
		profileMutex.RUnlock()
	} else {
		profileMutex.Lock()
		users = newUsers
		profileMutex.Unlock()
		stats.UsersLoaded = len(newUsers)
	}

	return stats, nil
}

// loadProfiles loads profiles into a temporary map without modifying global state
func loadProfiles(path string) (map[string]*ProfileData, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		// If the provided profiles file cannot be read, fall back to the embedded default
		logs.Log(fmt.Sprintf("[WARNING][AUTH] Could not read profiles file %s: %v; using embedded defaults", path, err))
		data = defaultProfilesJSON
	}

	raw := make(map[string]*rawProfile)
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse profiles: %w", err)
	}

	result := make(map[string]*ProfileData)
	for key, rp := range raw {
		profID := rp.ID
		if profID == "" {
			profID = key
		}

		if profID == "" {
			continue
		}

		capMap := make(map[string]bool)
		for macroName, macro := range rp.MacroPermissions {
			capMap[macroName] = macro.Value
			for _, permission := range macro.Permissions {
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

	return result, nil
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
		if ru.ProfileID == "" {
			return nil, fmt.Errorf("user %s missing profile reference", username)
		}

		if _, ok := profilesMap[ru.ProfileID]; !ok {
			return nil, fmt.Errorf("user %s references unknown profile %s", username, ru.ProfileID)
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

		result[username] = &UserProfile{
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
