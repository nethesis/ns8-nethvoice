package api

// CTI groups as chats: one room per CTI operator group, cti-<slug>@conference.<host>, named after
// the group. Its members are the group's own operators: seeing a group in the operators panel
// (all_groups, grp_) is not being in it. The rooms follow the CTI: members join and leave, a
// renamed group gets a new room, a deleted one is destroyed.

import (
	"context"
	"encoding/xml"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/cti"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
)

// CTIRoomPrefix marks the rooms the gateway keeps for CTI groups: clients offer no leave or delete there.
const CTIRoomPrefix = "cti-"

// GroupsEvery: how often the rooms are compared with the CTI groups.
const GroupsEvery = 2 * time.Minute

// FullSyncEvery: the rooms are checked against the CTI at least this often, even with no change seen.
const FullSyncEvery = 30 * time.Minute

var (
	groupsMu   sync.Mutex // one sync at a time
	lastGroups string     // the CTI groups and members of the last sync that went through
	lastFull   time.Time
)

// SyncGroups brings the CTI group rooms in line with the CTI.
func (s *Server) SyncGroups(ctx context.Context) {
	groupsMu.Lock()
	defer groupsMu.Unlock()
	token := s.MW.Token()
	if token == "" {
		return // nobody logged in yet: nothing to read the groups with
	}
	groups, err := cti.OperatorGroups(ctx, s.MW.Client(), s.MW.URL, token)
	if err != nil {
		log.Printf("groups: %v", err)
		return
	}
	dir, err := s.MW.Directory(ctx)
	if err != nil || dir == nil || len(dir.byUser) == 0 {
		return // never act on a guess
	}
	known, err := s.Store.CTIRooms()
	if err != nil {
		log.Printf("groups: %v", err)
		return
	}
	// No groups at all while rooms exist: more likely a CTI hiccup than every group deleted.
	if len(groups) == 0 && len(known) > 0 {
		return
	}
	want := map[string]string{} // slug -> name
	for name := range groups {
		if slug := cti.Slug(name); slug != "" {
			want[slug] = name
		}
	}
	// Only the group's own operators: seeing a group in the operators panel is not being in it.
	members := map[string]map[string]bool{}
	var seen []string
	for slug, name := range want {
		members[slug] = map[string]bool{}
		for _, u := range groups[name].Users {
			if _, ok := dir.byUser[u]; ok {
				members[slug][u] = true
			}
		}
		seen = append(seen, slug+"="+name+":"+strings.Join(keys(members[slug]), ","))
	}
	for slug, name := range known {
		seen = append(seen, "room "+slug+"="+name)
	}
	sort.Strings(seen)
	// Nothing changed in the CTI: no calls to ejabberd, each of them costs it a burst of CPU.
	fp := strings.Join(seen, ";")
	if fp == lastGroups && time.Since(lastFull) < FullSyncEvery {
		return
	}
	ok := true
	for slug, name := range want {
		ok = s.syncRoom(ctx, slug, name, members[slug], known) && ok
	}
	for slug := range known {
		if _, ok := want[slug]; !ok {
			if err := s.ejabberd(ctx, "destroy_room", map[string]string{"name": CTIRoomPrefix + slug, "service": address.MUC(s.Host)}, nil); err != nil && !roomMissing(err) {
				log.Printf("groups: destroy %s: %v", slug, err)
				ok = false
				continue
			}
			s.Store.DeleteCTIRoom(slug)
			logx.Debugf("groups: %s deleted in the CTI, room destroyed", slug)
		}
	}
	// A failed step is retried on the next round.
	if ok {
		lastGroups, lastFull = fp, time.Now()
	}
}

// syncRoom creates the room or adjusts its members and name; false when a step failed.
func (s *Server) syncRoom(ctx context.Context, slug, name string, members map[string]bool, known map[string]string) bool {
	room, muc := CTIRoomPrefix+slug, address.MUC(s.Host)
	var affs []struct {
		Affiliation string `json:"affiliation"`
		JID         string `json:"jid"`
	}
	err := s.ejabberd(ctx, "get_room_affiliations", map[string]string{"room": room, "service": muc}, &affs)
	if err != nil && !roomMissing(err) {
		log.Printf("groups: %s: %v", slug, err)
		return false
	}
	if err != nil {
		return s.createRoom(ctx, slug, name, members)
	}
	ok := true
	current := map[string]bool{}
	for _, a := range affs {
		if a.Affiliation == "member" || a.Affiliation == "owner" {
			current[address.Local(a.JID)] = true
		}
	}
	var added []string
	removed := false
	for u := range members {
		if current[u] {
			continue
		}
		if err := s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": room, "service": muc, "user": u, "host": s.Host, "affiliation": "member"}, nil); err != nil {
			log.Printf("groups: %s into %s: %v", u, slug, err)
			ok = false
			continue
		}
		s.subscribe(ctx, u, room)
		added = append(added, u)
	}
	for u := range current {
		if members[u] {
			continue
		}
		// No affiliation in a members-only room: ejabberd drops the subscription too.
		if err := s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": room, "service": muc, "user": u, "host": s.Host, "affiliation": "none"}, nil); err != nil {
			log.Printf("groups: %s out of %s: %v", u, slug, err)
			ok = false
			continue
		}
		s.tellRemoved(ctx, u, room)
		removed = true
		logx.Debugf("groups: %s out of %s", u, slug)
	}
	renamed := known[slug] != name
	if renamed {
		_ = s.ejabberd(ctx, "change_room_option", map[string]string{"name": room, "service": muc, "option": "title", "value": name}, nil)
		s.Store.PutCTIRoom(slug, name)
	}
	// An invitation makes a client show the room, or read its name and members again: everyone's open list follows.
	if renamed || removed || len(added) > 0 {
		s.invite(ctx, room, keys(members))
		logx.Debugf("groups: %s now %v", slug, keys(members))
	}
	return ok
}

func (s *Server) createRoom(ctx context.Context, slug, name string, members map[string]bool) bool {
	room, muc := CTIRoomPrefix+slug, address.MUC(s.Host)
	var affs, subs []string
	for _, u := range keys(members) {
		jid := u + "@" + s.Host
		affs = append(affs, "member="+jid)
		subs = append(subs, jid+"="+u+"=messages=config")
	}
	opts := []map[string]string{
		{"name": "title", "value": name},
		{"name": "persistent", "value": "true"},
		{"name": "members_only", "value": "true"},
		{"name": "public", "value": "false"},
		{"name": "public_list", "value": "false"},
		{"name": "allow_subscription", "value": "true"},
		{"name": "mam", "value": "true"},
	}
	if len(affs) > 0 {
		opts = append(opts, map[string]string{"name": "affiliations", "value": strings.Join(affs, ";")},
			map[string]string{"name": "subscribers", "value": strings.Join(subs, ";")})
	}
	if err := s.ejabberd(ctx, "create_room_with_opts", map[string]any{"room": room, "service": muc, "host": s.Host, "options": opts}, nil); err != nil {
		log.Printf("groups: create %s: %v", slug, err)
		return false
	}
	s.Store.PutCTIRoom(slug, name)
	s.invite(ctx, room, keys(members))
	logx.Debugf("groups: room for %q with %d members", name, len(members))
	return true
}

func (s *Server) subscribe(ctx context.Context, user, room string) {
	err := s.ejabberd(ctx, "subscribe_room", map[string]any{"user": user, "host": s.Host, "nick": user, "room": room, "service": address.MUC(s.Host),
		"nodes": []string{"urn:xmpp:mucsub:nodes:messages", "urn:xmpp:mucsub:nodes:config"}}, nil)
	if err != nil {
		log.Printf("groups: subscribe %s to %s: %v", user, room, err)
	}
}

func (s *Server) invite(ctx context.Context, room string, users []string) {
	if len(users) == 0 {
		return
	}
	jids := make([]string, len(users))
	for i, u := range users {
		jids[i] = u + "@" + s.Host
	}
	_ = s.ejabberd(ctx, "send_direct_invitation", map[string]any{"room": room, "service": address.MUC(s.Host), "password": "none", "reason": "none", "users": jids}, nil)
}

// tellRemoved: a client drops a room it was taken out of, as when a room is destroyed.
func (s *Server) tellRemoved(ctx context.Context, user, room string) {
	jid := xmlEscape(room + "@" + address.MUC(s.Host))
	stanza := fmt.Sprintf(`<message from='%s' to='%s'><event xmlns='http://jabber.org/protocol/pubsub#event'><items node='urn:xmpp:mucsub:nodes:config'><item><presence xmlns='jabber:client' from='%s' type='unavailable'><x xmlns='http://jabber.org/protocol/muc#user'><destroy/></x></presence></item></items></event></message>`,
		jid, xmlEscape(user+"@"+s.Host), jid)
	_ = s.ejabberd(ctx, "send_stanza", map[string]string{"from": room + "@" + address.MUC(s.Host), "to": user + "@" + s.Host, "stanza": stanza}, nil)
}

func roomMissing(err error) bool {
	m := strings.ToLower(err.Error())
	return strings.Contains(m, "not exist") || strings.Contains(m, "doesn't exist") || strings.Contains(m, "not found")
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func xmlEscape(v string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(v))
	return b.String()
}
