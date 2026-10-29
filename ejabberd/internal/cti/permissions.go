package cti

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// ChatUsers reads the CTI's own configuration, the files the middleware loads: users.json (each
// user's profile) and profiles.json (each profile's permissions). It returns the users whose
// profile has the chat, the same permission /user/me reports.
func ChatUsers(dir string) (map[string]bool, error) {
	var users map[string]struct {
		ProfileID string `json:"profile_id"`
	}
	var profiles map[string]struct {
		MacroPermissions struct {
			NethvoiceCTI struct {
				Permissions []struct {
					Name  string `json:"name"`
					Value bool   `json:"value"`
				} `json:"permissions"`
			} `json:"nethvoice_cti"`
		} `json:"macro_permissions"`
	}
	for name, out := range map[string]any{"users.json": &users, "profiles.json": &profiles} {
		b, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(b, out); err != nil {
			return nil, err
		}
	}
	chat := map[string]bool{}
	for id, p := range profiles {
		for _, perm := range p.MacroPermissions.NethvoiceCTI.Permissions {
			if perm.Name == "chat" && perm.Value {
				chat[id] = true
			}
		}
	}
	allowed := map[string]bool{}
	for user, u := range users {
		if chat[u.ProfileID] {
			allowed[user] = true
		}
	}
	return allowed, nil
}

// Names reads each user's display name from the CTI's users.json.
func Names(dir string) (map[string]string, error) {
	var users map[string]struct {
		Name string `json:"name"`
	}
	b, err := os.ReadFile(filepath.Join(dir, "users.json"))
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(b, &users); err != nil {
		return nil, err
	}
	out := map[string]string{}
	for u, v := range users {
		if v.Name != "" {
			out[u] = v.Name
		}
	}
	return out, nil
}
