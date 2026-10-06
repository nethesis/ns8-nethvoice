// Package api is the gateway's HTTP side; this file talks to the CTI middleware.
package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/cti"
)

var (
	ErrUnauthorized = cti.ErrUnauthorized
	ErrForbidden    = errors.New("chat not enabled for this account")
)

type Middleware struct {
	URL    string
	OnSeen func(username, name string) // every valid token: who uses the chat, with the name the CTI gives
	client *http.Client

	mu      sync.Mutex
	tokens  map[string]cachedToken // sha256(user:password) -> jwt
	users   *userCache
	lastJWT string // the newest token seen valid, to refresh the user list for pushes

	refreshing bool
}

const tokenTTL = 2 * time.Minute

type cachedToken struct {
	jwt  string
	till time.Time
}

type User struct {
	Username  string
	Name      string
	Extension string
	Presence  string
}

type userCache struct {
	byUser map[string]User
	byExt  map[string]string
	till   time.Time
}

func NewMiddleware(url string) *Middleware {
	return &Middleware{URL: url, client: &http.Client{Timeout: 10 * time.Second}, tokens: map[string]cachedToken{}}
}

// Login exchanges NethVoice credentials for a CTI JWT. The cache is short: a changed password stops working within tokenTTL.
func (m *Middleware) Login(ctx context.Context, username, password string) (string, error) {
	key := tokenKey(username, password)
	m.mu.Lock()
	if c, ok := m.tokens[key]; ok && time.Now().Before(c.till) {
		m.mu.Unlock()
		return c.jwt, nil
	}
	m.mu.Unlock()

	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, _ := http.NewRequestWithContext(ctx, "POST", m.URL+"/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return "", ErrUnauthorized
	}
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("login: HTTP %d", resp.StatusCode)
	}
	var out struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil || out.Token == "" {
		return "", fmt.Errorf("login: bad response")
	}
	m.mu.Lock()
	for k, c := range m.tokens {
		if time.Now().After(c.till) {
			delete(m.tokens, k)
		}
	}
	m.tokens[key] = cachedToken{jwt: out.Token, till: time.Now().Add(tokenTTL)}
	m.mu.Unlock()
	return out.Token, nil
}

// Forget drops a cached token the CTI or ejabberd no longer accepts.
func (m *Middleware) Forget(username, password string) {
	m.mu.Lock()
	delete(m.tokens, tokenKey(username, password))
	m.mu.Unlock()
}

func tokenKey(username, password string) string {
	sum := sha256.Sum256([]byte(username + ":" + password))
	return hex.EncodeToString(sum[:])
}

// WhoAmI returns the username a JWT belongs to, the same check chat-extauth does.
func (m *Middleware) WhoAmI(ctx context.Context, jwt string) (string, error) {
	me, err := cti.WhoIs(ctx, m.client, m.URL, jwt)
	if err != nil {
		return "", err
	}
	if !me.ChatAllowed() {
		return "", ErrForbidden
	}
	m.mu.Lock()
	m.lastJWT = jwt
	m.mu.Unlock()
	if m.OnSeen != nil {
		m.OnSeen(me.Username, me.Name)
	}
	return me.Username, nil
}

// Directory is the CTI user list for the gateway's own jobs, read with the newest token seen.
func (m *Middleware) Directory(ctx context.Context) (*userCache, error) {
	m.mu.Lock()
	jwt := m.lastJWT
	m.mu.Unlock()
	if jwt == "" {
		return nil, ErrUnauthorized
	}
	return m.Users(ctx, jwt)
}

// known returns the cached user list, refreshing it in the background when it is
// missing or stale: push delivery has no token of its own, so it borrows the newest one.
func (m *Middleware) known() *userCache {
	m.mu.Lock()
	defer m.mu.Unlock()
	if (m.users == nil || time.Now().After(m.users.till)) && m.lastJWT != "" && !m.refreshing {
		m.refreshing = true
		jwt := m.lastJWT
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_, _ = m.Users(ctx, jwt)
			m.mu.Lock()
			m.refreshing = false
			m.mu.Unlock()
		}()
	}
	return m.users
}

// Name and Extension answer from the last user list fetched, for callers without a token
// (push delivery); an unknown or never-fetched user falls back to the username.
func (m *Middleware) Name(username string) string {
	if users := m.known(); users != nil {
		if u, ok := users.byUser[username]; ok && u.Name != "" {
			return u.Name
		}
	}
	return username
}

func (m *Middleware) Extension(username string) string {
	if users := m.known(); users != nil {
		if u, ok := users.byUser[username]; ok && u.Extension != "" {
			return u.Extension
		}
	}
	return username
}

// Users returns the CTI user list, cached ten minutes, fetched with the caller's JWT.
func (m *Middleware) Users(ctx context.Context, jwt string) (*userCache, error) {
	m.mu.Lock()
	if m.users != nil && time.Now().Before(m.users.till) {
		u := m.users
		m.mu.Unlock()
		return u, nil
	}
	m.mu.Unlock()

	type raw struct {
		Username     string `json:"username"`
		Name         string `json:"name"`
		MainPresence string `json:"mainPresence"`
		Endpoints    struct {
			Extension []struct {
				ID string `json:"id"`
			} `json:"extension"`
			MainExtension []struct {
				ID string `json:"id"`
			} `json:"mainextension"`
		} `json:"endpoints"`
	}
	var all map[string]raw
	if err := m.get(ctx, jwt, "/user/endpoints/all", &all); err != nil {
		return nil, err
	}
	uc := &userCache{byUser: map[string]User{}, byExt: map[string]string{}, till: time.Now().Add(10 * time.Minute)}
	for _, r := range all {
		u := User{Username: r.Username, Name: r.Name, Presence: r.MainPresence}
		if len(r.Endpoints.MainExtension) > 0 {
			u.Extension = r.Endpoints.MainExtension[0].ID
		} else if len(r.Endpoints.Extension) > 0 {
			u.Extension = r.Endpoints.Extension[0].ID
		}
		if u.Username == "" {
			continue
		}
		uc.byUser[u.Username] = u
		for _, e := range r.Endpoints.Extension {
			uc.byExt[e.ID] = u.Username
		}
		if u.Extension != "" {
			uc.byExt[u.Extension] = u.Username
		}
	}
	m.mu.Lock()
	m.users = uc
	m.mu.Unlock()
	return uc, nil
}

func (m *Middleware) get(ctx context.Context, jwt, path string, out any) error {
	return cti.Get(ctx, m.client, m.URL, jwt, path, out)
}
