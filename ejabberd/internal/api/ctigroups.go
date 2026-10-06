package api

// CTI groups as chats: one room per CTI operator group, cti-<slug>@conference.<host>, named after
// the group. Its members are the users who see the group in the CTI operators panel: the group's
// own members, plus anyone with all_groups or that group's grp_ permission. The rooms follow the
// CTI: members join and leave, a renamed group gets a new room, a deleted one is destroyed.

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
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
)

// CTIRoomPrefix marks the rooms the gateway keeps for CTI groups: clients offer no leave or delete there.
const CTIRoomPrefix = "cti-"

// GroupsEvery: how often the rooms are compared with the CTI groups.
const GroupsEvery = 2 * time.Minute

var groupsMu sync.Mutex // one sync at a time

// SeenProfile records which groups a user sees; a change brings the rooms in line at once.
func (s *Server) SeenProfile(me cti.Me) {
	all, slugs := me.GroupAccess()
	if s.Store.PutGroupAccess(me.Username, store.GroupAccess{All: all, Slugs: slugs}) {
		logx.Debugf("groups: %s sees all=%v %v", me.Username, all, slugs)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
			defer cancel()
			s.SyncGroups(ctx)
		}()
	}
}

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
	access, err := s.Store.GroupAccesses()
	if err != nil {
		log.Printf("groups: %v", err)
		return
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
	for slug, name := range want {
		members := map[string]bool{}
		for _, u := range groups[name].Users {
			if _, ok := dir.byUser[u]; ok {
				members[u] = true
			}
		}
		for u, a := range access {
			if _, ok := dir.byUser[u]; ok && (a.All || contains(a.Slugs, slug)) {
				members[u] = true
			}
		}
		s.syncRoom(ctx, slug, name, members, known)
	}
	for slug := range known {
		if _, ok := want[slug]; !ok {
			if err := s.ejabberd(ctx, "destroy_room", map[string]string{"name": CTIRoomPrefix + slug, "service": address.MUC(s.Host)}, nil); err != nil && !roomMissing(err) {
				log.Printf("groups: destroy %s: %v", slug, err)
				continue
			}
			s.Store.DeleteCTIRoom(slug)
			logx.Debugf("groups: %s deleted in the CTI, room destroyed", slug)
		}
	}
}

// syncRoom creates the room or adjusts its members and name.
func (s *Server) syncRoom(ctx context.Context, slug, name string, members map[string]bool, known map[string]string) {
	room, muc := CTIRoomPrefix+slug, address.MUC(s.Host)
	var affs []struct {
		Affiliation string `json:"affiliation"`
		JID         string `json:"jid"`
	}
	err := s.ejabberd(ctx, "get_room_affiliations", map[string]string{"room": room, "service": muc}, &affs)
	if err != nil && !roomMissing(err) {
		log.Printf("groups: %s: %v", slug, err)
		return
	}
	if err != nil {
		s.createRoom(ctx, slug, name, members)
		return
	}
	current := map[string]bool{}
	for _, a := range affs {
		if a.Affiliation == "member" || a.Affiliation == "owner" {
			current[address.Local(a.JID)] = true
		}
	}
	var added []string
	for u := range members {
		if current[u] {
			continue
		}
		if err := s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": room, "service": muc, "user": u, "host": s.Host, "affiliation": "member"}, nil); err != nil {
			log.Printf("groups: %s into %s: %v", u, slug, err)
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
			continue
		}
		s.tellRemoved(ctx, u, room)
		logx.Debugf("groups: %s out of %s", u, slug)
	}
	renamed := known[slug] != name
	if renamed {
		_ = s.ejabberd(ctx, "change_room_option", map[string]string{"name": room, "service": muc, "option": "title", "value": name}, nil)
		s.Store.PutCTIRoom(slug, name)
	}
	// An invitation makes a client show the room, or read its new name.
	if renamed {
		s.invite(ctx, room, keys(members))
	} else if len(added) > 0 {
		s.invite(ctx, room, added)
		logx.Debugf("groups: %v into %s", added, slug)
	}
}

func (s *Server) createRoom(ctx context.Context, slug, name string, members map[string]bool) {
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
		return
	}
	s.Store.PutCTIRoom(slug, name)
	s.invite(ctx, room, keys(members))
	logx.Debugf("groups: room for %q with %d members", name, len(members))
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

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func xmlEscape(v string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(v))
	return b.String()
}
