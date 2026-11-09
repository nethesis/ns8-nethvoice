package api

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

// A group as the app's provisioning proxy lists it among the contacts: the room, its name,
// the address the app shows the group under (see address.Thread) and its picture, when it has one.
type group struct {
	Room    string `json:"room"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Avatar  string `json:"avatar,omitempty"` // data URL
}

// groups answers GET /groups with a CTI token: the rooms the account is subscribed to.
func (s *Server) groups(w http.ResponseWriter, r *http.Request) {
	user, jwt, err := s.bearerUser(r)
	if err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	ses, err := xmppc.Dial(r.Context(), s.C2SAddr, s.Host, user, jwt)
	if err != nil {
		log.Printf("groups %s: %v", user, err)
		fail(w, 502, "chat server unavailable")
		return
	}
	defer ses.Close()
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	rooms, err := ses.Groups(ctx)
	if err != nil {
		log.Printf("groups %s: %v", user, err)
		fail(w, 502, "chat server error")
		return
	}
	out := []group{}
	for _, room := range rooms {
		name := s.roomName(ctx, ses, room)
		g := group{Room: room, Name: name, Address: address.Thread(name)}
		// A CTI group's room is the gateway's own: nobody can give it a picture.
		if !strings.HasPrefix(address.Local(room), CTIRoomPrefix) {
			g.Avatar = ses.RoomAvatar(ctx, room)
		}
		out = append(out, g)
	}
	writeJSON(w, 200, map[string]any{"groups": out})
}
