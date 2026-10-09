package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
)

// Grace: how long an account must be missing from the CTI before it is retired.
// It absorbs directory hiccups and users removed by mistake.
const Grace = 24 * time.Hour

// ejabberd runs a command of ejabberd's mod_http_api on loopback.
func (s *Server) ejabberd(ctx context.Context, cmd string, args, out any) error {
	body, _ := json.Marshal(args)
	req, _ := http.NewRequestWithContext(ctx, "POST", s.EjabberdAPI+"/"+cmd, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := apiClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != 200 {
		return fmt.Errorf("%s: HTTP %d %s", cmd, resp.StatusCode, strings.TrimSpace(string(b)))
	}
	if out != nil {
		return json.Unmarshal(b, out)
	}
	return nil
}

// Reconcile compares the accounts that used the chat with the CTI users. One gone is
// disconnected and gets no pushes at once; after Grace it is retired: out of its groups
// (the first member added inherits a group it owned), push registrations deleted.
// Its history stays, for it and for everyone else, until the retention removes it.
func (s *Server) Reconcile(ctx context.Context) {
	dir, err := s.MW.Directory(ctx)
	if err != nil || dir == nil || len(dir.byUser) == 0 {
		return // no list, nothing to compare with: never act on a guess
	}
	known, err := s.Store.ChatUsers()
	if err != nil {
		log.Printf("users: %v", err)
		return
	}
	var missing []string
	active := 0
	since := map[string]int64{}
	for _, u := range known {
		if cu, ok := dir.byUser[u.Username]; ok {
			if u.MissingSince != 0 || u.Inactive || u.Name != cu.Name {
				if u.MissingSince != 0 || u.Inactive {
					logx.Debugf("users: %s is back", u.Username)
				}
				_ = s.Store.SetPresent(u.Username, cu.Name)
			}
		} else if !u.Inactive {
			missing = append(missing, u.Username)
			since[u.Username] = u.MissingSince
		}
		if !u.Inactive {
			active++
		}
	}
	// Half the accounts gone at once is a directory problem (a provider switch, a sync gone wrong), not departures.
	if len(missing) > 2 && len(missing)*2 > active {
		log.Printf("users: %d of %d accounts missing from the CTI at once: nothing done", len(missing), active)
		return
	}
	now := time.Now().Unix()
	for _, u := range missing {
		_ = s.ejabberd(ctx, "kick_user", map[string]string{"user": u, "host": s.Host}, nil)
		if since[u] == 0 {
			_ = s.Store.SetMissing(u, now)
			logx.Debugf("users: %s is not in the CTI any more: disconnected, no pushes; retired after %s", u, Grace)
		} else if now-since[u] >= int64(Grace.Seconds()) {
			s.retire(ctx, u)
		}
	}
}

// retire takes an account out of its groups and marks it inactive.
func (s *Server) retire(ctx context.Context, user string) {
	var subs []struct {
		RoomJID string `json:"roomjid"`
	}
	if err := s.ejabberd(ctx, "get_user_subscriptions", map[string]string{"user": user, "host": s.Host}, &subs); err != nil {
		log.Printf("users: retire %s: %v", user, err)
		return // tried again at the next round
	}
	muc := address.MUC(s.Host)
	for _, sub := range subs {
		room := address.Local(sub.RoomJID)
		if err := s.leaveRoom(ctx, user, room, muc); err != nil {
			log.Printf("users: %s out of %s: %v", user, room, err)
		}
	}
	if err := s.Store.SetInactive(user); err != nil {
		log.Printf("users: retire %s: %v", user, err)
		return
	}
	logx.Debugf("users: %s retired (%d groups)", user, len(subs))
}

// leaveRoom: an owner hands the group to the first member added, or destroys it when nobody is left.
func (s *Server) leaveRoom(ctx context.Context, user, room, muc string) error {
	var affs []struct {
		JID         string `json:"jid"`
		Affiliation string `json:"affiliation"`
		Reason      string `json:"reason"`
	}
	if err := s.ejabberd(ctx, "get_room_affiliations", map[string]string{"room": room, "service": muc}, &affs); err != nil {
		return err
	}
	owner, otherOwner := false, false
	type cand struct {
		user  string
		added float64 // the island writes when it added the member in the reason; 0 when unknown
	}
	var members []cand
	for _, a := range affs {
		u := address.Local(a.JID)
		switch {
		case u == user:
			owner = a.Affiliation == "owner"
		case a.Affiliation == "owner":
			otherOwner = true
		case (a.Affiliation == "member" || a.Affiliation == "admin") && !s.Store.Away(u):
			added, _ := strconv.ParseFloat(a.Reason, 64)
			members = append(members, cand{u, added})
		}
	}
	if owner && !otherOwner {
		if len(members) == 0 {
			return s.ejabberd(ctx, "destroy_room", map[string]string{"room": room, "service": muc}, nil)
		}
		// First added first; groups made before the order was recorded fall back to the name.
		sort.Slice(members, func(i, j int) bool {
			a, b := members[i], members[j]
			if (a.added > 0) != (b.added > 0) {
				return a.added > 0
			}
			if a.added != b.added {
				return a.added < b.added
			}
			return a.user < b.user
		})
		heir := members[0].user
		if err := s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": room, "service": muc, "user": heir, "host": s.Host, "affiliation": "owner"}, nil); err != nil {
			return err
		}
		logx.Debugf("users: %s now owns %s", heir, room)
	}
	errs := []error{
		s.ejabberd(ctx, "unsubscribe_room", map[string]string{"user": user, "host": s.Host, "room": room, "service": muc}, nil),
		s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": room, "service": muc, "user": user, "host": s.Host, "affiliation": "none"}, nil),
	}
	return errors.Join(errs...)
}

// inactive lists the retired accounts with their last name, for the clients to label them.
func (s *Server) inactive(w http.ResponseWriter, r *http.Request) {
	if _, _, err := s.bearerUser(r); err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	users, err := s.Store.ChatUsers()
	if err != nil {
		fail(w, 500, "internal error")
		return
	}
	out := []map[string]string{}
	for _, u := range users {
		if u.Inactive {
			out = append(out, map[string]string{"username": u.Username, "name": u.Name})
		}
	}
	writeJSON(w, 200, map[string]any{"users": out})
}
