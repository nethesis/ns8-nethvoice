package api

import (
	"context"
	"log"
	"regexp"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/cti"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
)

// operatorRe: an operator's account; anything else online (a guest) is not the CTI's to judge.
var operatorRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)

// KickRevoked disconnects whoever is online without the chat any more: gone from the CTI, or with
// the permission taken from their profile. chat-extauth checks only at login, so an open session
// would last; the next login is refused there.
func (s *Server) KickRevoked(ctx context.Context) {
	if s.CTIConfig == "" {
		return
	}
	allowed, err := cti.ChatUsers(s.CTIConfig)
	if err != nil || len(allowed) == 0 {
		logx.Debugf("revoked: CTI configuration not readable: %v", err) // never act on a guess
		return
	}
	var online []string
	if err := s.ejabberd(ctx, "connected_users", map[string]string{}, &online); err != nil {
		log.Printf("revoked: %v", err)
		return
	}
	users := map[string]bool{}
	for _, j := range online {
		if u := address.Local(j); operatorRe.MatchString(u) {
			users[u] = true
		}
	}
	var out []string
	for u := range users {
		if !allowed[u] {
			out = append(out, u)
		}
	}
	// Half of who is online at once is a configuration being rewritten, not revocations.
	if len(out) > 2 && len(out)*2 > len(users) {
		log.Printf("revoked: %d of %d online users without the chat at once: nothing done", len(out), len(users))
		return
	}
	for _, u := range out {
		if err := s.ejabberd(ctx, "kick_user", map[string]string{"user": u, "host": s.Host}, nil); err != nil {
			log.Printf("revoked: kick %s: %v", u, err)
			continue
		}
		log.Printf("revoked: %s has no chat any more: disconnected", u)
	}
}
