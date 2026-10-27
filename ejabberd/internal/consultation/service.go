// Package consultation owns the private transport interface, never LLM decisions.
package consultation

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

const Identity = "voice-agent-assistant"

var nick = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)
var identifier = regexp.MustCompile(`^[a-f0-9]{32}$`)
var reference = regexp.MustCompile(`^[A-F0-9]{8}$`)

type Recipient struct {
	Version   int       `json:"version"`
	ID        string    `json:"recipient_id"`
	Extension string    `json:"mainextension"`
	Presence  string    `json:"effective_presence"`
	Device    string    `json:"device_state"`
	Chat      bool      `json:"chat_allowed"`
	At        time.Time `json:"observed_at"`
}

// Reader talks only to the separate loopback CTI listener using a scoped key.
func Reader(base, token string) (func(context.Context, string) (Recipient, error), error) {
	u, err := url.Parse(base)
	if err != nil || u.Scheme != "http" || u.Hostname() != "127.0.0.1" || u.Port() == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || len(token) < 32 {
		return nil, errors.New("invalid_recipient_service")
	}
	client := &http.Client{Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return func(ctx context.Context, extension string) (Recipient, error) {
		var value Recipient
		if !regexp.MustCompile(`^[0-9]{1,20}$`).MatchString(extension) {
			return value, errors.New("invalid_extension")
		}
		req, _ := http.NewRequestWithContext(ctx, "GET", base+"/v1/recipients/"+extension, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := client.Do(req)
		if err != nil {
			return value, err
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			return value, errors.New("recipient_unavailable")
		}
		if json.NewDecoder(io.LimitReader(res.Body, 8192)).Decode(&value) != nil || value.Version != 1 || !nick.MatchString(value.ID) || value.ID == Identity || value.Extension != extension || time.Since(value.At) > 3*time.Second || time.Until(value.At) > time.Second {
			return Recipient{}, errors.New("invalid_recipient")
		}
		return value, nil
	}, nil
}

type Message struct {
	ID        string    `json:"id"`
	Recipient string    `json:"recipient"`
	Extension string    `json:"mainextension"`
	Reference string    `json:"reference"`
	Body      string    `json:"body,omitempty"`
	Expires   time.Time `json:"expires_at"`
	Started   time.Time `json:"started_at"`
	State     string    `json:"state"`
	BodyHash  string    `json:"body_hash"`
}
type Service struct {
	Store   *store.Store
	Host    string
	Token   string
	Read    func(context.Context, string) (Recipient, error)
	Send    func(context.Context, string, string, string) error
	History func(context.Context) ([]xmppc.Message, error)
	mu      sync.Mutex
	known   map[string]Message
	notices map[string]time.Time
}

func (s *Service) Handler() http.Handler {
	s.known = map[string]Message{}
	s.notices = map[string]time.Time{}
	for _, raw := range s.Store.ConsultationReceipts() {
		var m Message
		if json.Unmarshal([]byte(raw), &m) == nil && time.Now().Before(m.Expires) {
			s.known[m.ID] = m
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/consultations/messages", s.send)
	mux.HandleFunc("GET /v1/consultations/replies", s.replies)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if len(s.Token) < 32 || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+s.Token)) != 1 {
			w.WriteHeader(401)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Service) send(w http.ResponseWriter, r *http.Request) {
	var m Message
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&m) != nil || !identifier.MatchString(m.ID) || !reference.MatchString(m.Reference) || !nick.MatchString(m.Recipient) || m.Recipient == Identity || len(m.Body) == 0 || len(m.Body) > 2000 || m.State != "" || m.BodyHash != "" || !m.Started.IsZero() || time.Until(m.Expires) <= 0 || time.Until(m.Expires) > 65*time.Second {
		w.WriteHeader(400)
		return
	}
	hash := sha256.Sum256([]byte(m.Body))
	m.BodyHash = hex.EncodeToString(hash[:])
	recipient, err := s.Read(r.Context(), m.Extension)
	if err != nil || recipient.ID != m.Recipient || !recipient.Chat {
		w.WriteHeader(403)
		return
	}
	s.mu.Lock()
	stored, err := s.Store.Meta("consultation:" + m.ID)
	if err != nil {
		s.mu.Unlock()
		w.WriteHeader(503)
		return
	}
	if stored != "" {
		var old Message
		err = json.Unmarshal([]byte(stored), &old)
		s.mu.Unlock()
		if err != nil || old.Recipient != m.Recipient || old.Reference != m.Reference || old.Extension != m.Extension || old.BodyHash != m.BodyHash || !old.Expires.Equal(m.Expires) {
			w.WriteHeader(409)
			return
		}
		if old.State != "sent" {
			w.WriteHeader(503)
			return
		}
		w.WriteHeader(204)
		return
	}
	if len(s.known) >= 512 {
		s.mu.Unlock()
		w.WriteHeader(503)
		return
	}
	m.Started = time.Now().UTC()
	m.State = "pending"
	metadata := m
	metadata.Body = ""
	encoded, _ := json.Marshal(metadata)
	if s.Store.SetMeta("consultation:"+m.ID, string(encoded)) != nil {
		s.mu.Unlock()
		w.WriteHeader(503)
		return
	}
	s.known[m.ID] = metadata
	s.mu.Unlock()
	// Reserve before sending: an uncertain write is never resent after reconnect.
	if s.Send(r.Context(), m.ID, m.Recipient+"@"+s.Host, m.Body) != nil {
		w.WriteHeader(503)
		return
	}
	metadata.State = "sent"
	encoded, _ = json.Marshal(metadata)
	if s.Store.SetMeta("consultation:"+m.ID, string(encoded)) != nil {
		w.WriteHeader(503)
		return
	}
	s.mu.Lock()
	s.known[m.ID] = metadata
	s.mu.Unlock()
	w.WriteHeader(204)
}

func (s *Service) replies(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if !identifier.MatchString(id) || len(r.URL.Query()) != 1 {
		w.WriteHeader(400)
		return
	}
	raw, err := s.Store.Meta("consultation:" + id)
	var m Message
	if err != nil || raw == "" || json.Unmarshal([]byte(raw), &m) != nil || m.State != "sent" || !time.Now().Before(m.Expires) {
		w.WriteHeader(410)
		return
	}
	recipient, err := s.Read(r.Context(), m.Extension)
	if err != nil || !recipient.Chat || recipient.ID != m.Recipient {
		w.WriteHeader(403)
		return
	}
	messages, err := s.History(r.Context())
	if err != nil {
		w.WriteHeader(503)
		return
	}
	replies := make([]map[string]interface{}, 0)
	for _, msg := range messages {
		if msg.Room != "" || msg.From != m.Recipient+"@"+s.Host || msg.To != Identity+"@"+s.Host || msg.At.Before(m.Started) || !msg.At.Before(m.Expires) || len(msg.ID) == 0 || len(msg.ID) > 128 || len(msg.Body) > 2000 {
			continue
		}
		// References in quoted history do not authorize a new response.
		lines := []string{}
		for _, line := range strings.Split(msg.Body, "\n") {
			if !strings.HasPrefix(strings.TrimSpace(line), ">") {
				lines = append(lines, line)
			}
		}
		body := strings.Join(lines, "\n")
		if !regexp.MustCompile(`(?:^|\s)#` + m.Reference + `(?:\s|$|[.,:;!?])`).MatchString(body) {
			continue
		}
		replies = append(replies, map[string]interface{}{"id": msg.ID, "sender": m.Recipient, "reference": m.Reference, "text": body, "at": msg.At})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"version": 1, "replies": replies})
}

// DND asks authoritative CTI state for known consultation recipients. It never
// borrows a human JWT and does not override the gateway's ordinary DND check.
func (s *Service) DND(ctx context.Context, user string) bool {
	s.mu.Lock()
	var extension string
	for _, m := range s.known {
		if m.Recipient == user && time.Now().Before(m.Expires) {
			extension = m.Extension
			break
		}
	}
	s.mu.Unlock()
	if extension == "" {
		return false
	}
	r, err := s.Read(ctx, extension)
	return err != nil || r.ID != user || r.Presence == "dnd" || r.Device == "dnd"
}

// Sweep bounds receipts and explains the consultation-only identity to new
// unsolicited senders without storing message bodies or replaying decisions.
func (s *Service) Sweep(ctx context.Context) {
	tick := time.NewTicker(5 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			now := time.Now()
			s.mu.Lock()
			for id, m := range s.known {
				if now.After(m.Expires.Add(time.Minute)) {
					delete(s.known, id)
				}
			}
			for user, at := range s.notices {
				if now.Sub(at) > time.Minute {
					delete(s.notices, user)
				}
			}
			s.mu.Unlock()
			s.Store.PruneConsultationReceipts(now.Add(-2 * time.Minute).Unix())
			messages, err := s.History(ctx)
			if err != nil {
				continue
			}
			for _, m := range messages {
				if m.Room != "" || m.To != Identity+"@"+s.Host || now.Sub(m.At) > 10*time.Second || len(m.Body) == 0 || len(m.Body) > 2000 {
					continue
				}
				user := strings.TrimSuffix(m.From, "@"+s.Host)
				if !nick.MatchString(user) || user == Identity {
					continue
				}
				active := false
				s.mu.Lock()
				for _, known := range s.known {
					if known.Recipient == user && now.Before(known.Expires) {
						active = true
						break
					}
				}
				_, notified := s.notices[user]
				if len(s.notices) >= 512 {
					notified = true
				}
				if !active && !notified && len(s.notices) < 512 {
					s.notices[user] = now
				}
				s.mu.Unlock()
				if active || notified {
					continue
				}
				sum := sha256.Sum256([]byte(m.ID))
				s.Send(ctx, hex.EncodeToString(sum[:16]), m.From, "I handle live call consultations only. General assistant requests are not available yet.")
			}
		}
	}
}

func Loopback(address string) bool {
	host, port, err := net.SplitHostPort(address)
	return err == nil && host == "127.0.0.1" && port != ""
}
