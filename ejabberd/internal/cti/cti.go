// Package cti: the CTI middleware as the chat programs see it, a token and /user/me.
package cti

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
)

// ErrUnauthorized: the middleware refused the token.
var ErrUnauthorized = errors.New("unauthorized")

// Me is the CTI user behind a token.
type Me struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Profile  struct {
		MacroPermissions struct {
			NethvoiceCTI struct {
				Permissions struct {
					Chat struct {
						Value bool `json:"value"`
					} `json:"chat"`
				} `json:"permissions"`
			} `json:"nethvoice_cti"`
			// all_groups and grp_<slug>: the operator groups shown besides the user's own.
			PresencePanel struct {
				Permissions map[string]struct {
					Value bool `json:"value"`
				} `json:"permissions"`
			} `json:"presence_panel"`
		} `json:"macro_permissions"`
	} `json:"profile"`
}

// ChatAllowed: the chat is a CTI profile permission, like the other features.
func (m Me) ChatAllowed() bool { return m.Profile.MacroPermissions.NethvoiceCTI.Permissions.Chat.Value }

// GroupAccess: every operator group (all_groups), or the slugs of the grp_ permissions granted.
func (m Me) GroupAccess() (all bool, slugs []string) {
	for k, p := range m.Profile.MacroPermissions.PresencePanel.Permissions {
		switch {
		case !p.Value:
		case k == "all_groups":
			all = true
		case strings.HasPrefix(k, "grp_"):
			slugs = append(slugs, strings.TrimPrefix(k, "grp_"))
		}
	}
	sort.Strings(slugs)
	return all, slugs
}

// Groups are the CTI operator groups and their members, by group name.
type Groups map[string]struct {
	Users []string `json:"users"`
}

// OperatorGroups reads every operator group, whoever the token belongs to.
func OperatorGroups(ctx context.Context, client *http.Client, base, token string) (Groups, error) {
	var g Groups
	return g, Get(ctx, client, base, token, "/astproxy/opgroups", &g)
}

// Slug is a group name as the CTI keys its permission: grp_<slug>.
func Slug(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Get reads a middleware path with a CTI token into out.
func Get(ctx context.Context, client *http.Client, base, token, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, "GET", base+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return ErrUnauthorized
	}
	if resp.StatusCode != 200 {
		return fmt.Errorf("%s: HTTP %d", path, resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(out)
}

// WhoIs is the CTI user behind a token.
func WhoIs(ctx context.Context, client *http.Client, base, token string) (Me, error) {
	var me Me
	if err := Get(ctx, client, base, token, "/user/me", &me); err != nil {
		return me, err
	}
	if me.Username == "" {
		return me, ErrUnauthorized
	}
	return me, nil
}
