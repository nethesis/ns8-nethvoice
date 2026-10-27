// chat-extauth: ejabberd external auth. The password is the CTI JWT (checked on /user/me)
// or the gateway's signed service password; ejabberd extauth length-prefixed protocol.
package main

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/cti"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/svcauth"
)

var (
	middleware = os.Getenv("CHAT_MIDDLEWARE_URL") // set by the module unit, with its port
	secret     = os.Getenv("CHAT_COMPONENT_SECRET")
	nickRe     = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)
	client     = &http.Client{Timeout: 5 * time.Second}

	cacheMu sync.Mutex
	cache   = map[string]cached{} // token -> who it belongs to
)

type cached struct {
	user string
	till time.Time
}

func main() {
	log.SetFlags(0)
	if middleware == "" {
		log.Fatal("extauth: CHAT_MIDDLEWARE_URL is required")
	}
	for {
		var n uint16
		if err := binary.Read(os.Stdin, binary.BigEndian, &n); err != nil {
			return // ejabberd closed the pipe
		}
		buf := make([]byte, n)
		if _, err := io.ReadFull(os.Stdin, buf); err != nil {
			return
		}
		reply(handle(string(buf), whoIs, time.Now()))
	}
}

// handle answers one extauth request: op:user:host[:password].
func handle(req string, who func(string) string, now time.Time) bool {
	f := strings.SplitN(req, ":", 4) // the password may contain colons
	switch f[0] {
	case "auth":
		if len(f) != 4 || !validNick(f[1]) {
			return false
		}
		if svcauth.IsService(f[3]) {
			return svcauth.Valid(secret, f[1], f[2], f[3], now)
		}
		return who(f[3]) == f[1]
	case "isuser":
		// Operators who never logged in must still get messages (offline storage, groups).
		return len(f) >= 2 && validNick(f[1])
	}
	return false
}

func validNick(u string) bool { return nickRe.MatchString(u) }

// whoIs returns the username the middleware says the token belongs to, or "".
func whoIs(token string) string {
	if token == "" {
		return ""
	}
	cacheMu.Lock()
	if c, hit := cache[token]; hit && time.Now().Before(c.till) {
		cacheMu.Unlock()
		return c.user
	}
	cacheMu.Unlock()

	me, err := cti.WhoIs(context.Background(), client, middleware, token)
	if err != nil {
		if !errors.Is(err, cti.ErrUnauthorized) {
			log.Printf("extauth: middleware: %v", err)
		}
		return ""
	}
	if !me.ChatAllowed() {
		logx.Debugf("extauth: %s has no chat permission", me.Username)
		return ""
	}
	cacheMu.Lock()
	cache[token] = cached{user: me.Username, till: time.Now().Add(60 * time.Second)}
	if len(cache) > 10000 {
		cache = map[string]cached{}
	}
	cacheMu.Unlock()
	return me.Username
}

func reply(ok bool) {
	out := []byte{0, 2, 0, 0}
	if ok {
		out[3] = 1
	}
	os.Stdout.Write(out)
}
