package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
)

func TestAccountRemovalReport(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	node, err := st.PutPNM(store.PNMToken{Node: "pnm:a", Username: "antonio", Selector: "sel", Token: "tok"})
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{Store: st}
	report := func(body string) int {
		w := httptest.NewRecorder()
		s.accountRemovalReport(w, httptest.NewRequest(http.MethodPost, "/api/client/account_removal_report", strings.NewReader(body)))
		return w.Code
	}
	// Someone else's token, or none: the phone keeps its pushes.
	for _, body := range []string{`{"username":"antonio","selector":"sel","token_msgs":"other"}`, `{"username":"antonio","selector":"sel"}`} {
		report(body)
		if tok, _ := st.PNM(node); tok == nil {
			t.Fatalf("%s removed the token", body)
		}
	}
	if code := report(`{"username":"antonio@example.com","selector":"sel","token_msgs":"tok"}`); code != 200 {
		t.Fatalf("HTTP %d", code)
	}
	if tok, _ := st.PNM(node); tok != nil {
		t.Fatal("token still there after logout")
	}
}
