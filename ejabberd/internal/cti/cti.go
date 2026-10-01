// Package cti: the CTI middleware as the chat programs see it, a token and /user/me.
package cti

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
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
		} `json:"macro_permissions"`
	} `json:"profile"`
}

// ChatAllowed: the chat is a CTI profile permission, like the other features.
func (m Me) ChatAllowed() bool { return m.Profile.MacroPermissions.NethvoiceCTI.Permissions.Chat.Value }

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
