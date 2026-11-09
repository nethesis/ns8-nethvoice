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
	secret     = svcauth.Secret(os.Getenv)
	nickRe     = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)
	guestRe    = regexp.MustCompile(`^g~[0-9a-f]{12}$`) // a guest's account: only the gateway logs in to it
	client     = &http.Client{Timeout: 5 * time.Second}
	// extauthClient: what the middleware counts these calls under (it trusts X-Forwarded-For from loopback).
	extauthClient = "127.0.0.2"

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
		if len(f) != 4 {
			return false
		}
		if svcauth.IsService(f[3]) {
			return (validNick(f[1]) || guestRe.MatchString(f[1])) && svcauth.Valid(secret, f[1], f[2], f[3], now)
		}
		return validNick(f[1]) && who(f[3]) == f[1]
	case "isuser":
		// Operators who never logged in must still get messages (offline storage, groups).
		return len(f) >= 2 && (validNick(f[1]) || guestRe.MatchString(f[1]))
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

	// Its own address for the middleware's per-client limit: logins never share the gateway's.
	ctx := cti.WithClient(context.Background(), extauthClient)
	me, err := cti.WhoIs(ctx, client, middleware, token)
	if err != nil && !errors.Is(err, cti.ErrUnauthorized) {
		log.Printf("extauth: middleware: %v", err)
		return "" // no answer: asked again next time
	}
	user := me.Username
	if err != nil {
		user = ""
	} else if !me.ChatAllowed() {
		logx.Debugf("extauth: %s has no chat permission", me.Username)
		user = ""
	}
	// A refusal is kept too: the same bad token again costs nothing.
	cacheMu.Lock()
	cache[token] = cached{user: user, till: time.Now().Add(60 * time.Second)}
	if len(cache) > 10000 {
		cache = map[string]cached{}
	}
	cacheMu.Unlock()
	return user
}

func reply(ok bool) {
	out := []byte{0, 2, 0, 0}
	if ok {
		out[3] = 1
	}
	os.Stdout.Write(out)
}
