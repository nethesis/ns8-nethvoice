// Package address: the tenant's XMPP addresses, how they are built and read.
package address

import "strings"

// The services ejabberd runs beside the tenant's domain.
func MUC(host string) string    { return "conference." + host }
func Push(host string) string   { return "push." + host }
func Upload(host string) string { return "upload." + host }

// IsRoom tells a group address (room@conference.host) from a user.
func IsRoom(j string) bool { return strings.Contains(j, "@conference.") }

// Bare drops the resource: user@host/res -> user@host.
func Bare(j string) string {
	if i := strings.IndexByte(j, '/'); i >= 0 {
		return j[:i]
	}
	return j
}

// Local is the part before the @: the username.
func Local(j string) string { return strings.SplitN(j, "@", 2)[0] }

// The app reads spaces and commas in an address as several people: a group's name goes
// with look-alikes that keep it one name (no-break space, low comma), and comes back with Name.
var (
	toThread   = strings.NewReplacer(" ", " ", ",", "‚")
	fromThread = strings.NewReplacer(" ", " ", "‚", ",")
)

// Thread is a group's name as the app's address for it.
func Thread(name string) string { return toThread.Replace(name) }

// Name is the group name behind an app address.
func Name(thread string) string { return fromThread.Replace(thread) }
