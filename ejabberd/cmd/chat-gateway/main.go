// chat-gateway: XEP-0357 push app server (Web Push, Acrobits PNM) and the Acrobits web services.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/api"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/push"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/svcauth"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

func required(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("%s is required", k)
	}
	return v
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	log.SetFlags(0)
	// Addresses and ports come from the module unit: no defaults, a missing one stops here.
	host := required("CHAT_HOST")              // the XMPP domain, chat.internal
	publicHost := required("CHAT_PUBLIC_HOST") // the CTI host clients reach
	secret := required("CHAT_COMPONENT_SECRET")
	listen := required("CHAT_LISTEN")
	c2s := required("CHAT_C2S_ADDR")
	componentAddr := required("CHAT_COMPONENT_ADDR")
	mwURL := required("CHAT_MIDDLEWARE_URL")
	ejabberdAPI := required("CHAT_EJABBERD_API")
	uploadURL := required("CHAT_UPLOAD_URL")
	dataDir := env("CHAT_DATA_DIR", "/data")
	pnmURL := env("CHAT_PNM_URL", "https://pnm.cloudsoftphone.com/pnm2/send")

	st, err := store.Open(dataDir)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	router, err := push.NewRouter(st, pnmURL)
	if err != nil {
		log.Fatalf("push: %v", err)
	}
	mw := api.NewMiddleware(mwURL)
	mw.OnSeen = st.SeenUser
	srv := &api.Server{Host: host, C2SAddr: c2s, PushService: address.Push(host), VAPIDPublic: router.VAPIDPublic, Store: st, MW: mw, EjabberdAPI: ejabberdAPI, UploadURL: uploadURL, PublicHost: publicHost}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	router.RoomName = push.RoomName
	srv.RoomName = push.RoomName
	router.Names = mw.Name
	router.Address = mw.Extension
	router.ArchiveID = func(ctx context.Context, user, peer string) string {
		ses, err := xmppc.Dial(ctx, c2s, host, user, svcauth.Password(secret, user, host, time.Now()))
		if err != nil {
			log.Printf("push: archive id for %s: %v", user, err)
			return ""
		}
		defer ses.Close()
		m, err := ses.Last(ctx, peer)
		if err != nil {
			log.Printf("push: archive id for %s with %s: %v", user, peer, err)
			return ""
		}
		return m.ID
	}
	go push.ServeComponent(ctx, componentAddr, host, secret, router)
	// Accounts gone from the CTI: a minute after start, then every ten minutes.
	go func() {
		for wait := time.Minute; ; wait = 10 * time.Minute {
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
				rctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
				srv.Reconcile(rctx)
				cancel()
			}
		}
	}()

	hs := &http.Server{Addr: listen, Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		logx.Debugf("chat-gateway: listening on %s for %s", listen, host)
		if err := hs.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = hs.Shutdown(shutdown)
}
