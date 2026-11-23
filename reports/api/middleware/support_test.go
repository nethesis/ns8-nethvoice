package middleware

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
)

func testSupportHash(user string) string {
	return fmt.Sprintf("%x", sha1.Sum([]byte("pw-"+user)))
}

func testSupportLogin(user string, expire time.Time) *supportLogin {
	return &supportLogin{User: user, Expire: expire, Binding: supportBinding(testSupportHash(user))}
}

func stubSupportUsers(t *testing.T, users map[string]bool) *int {
	t.Helper()
	calls := 0
	configuration.Config.Secret = "test-secret"
	orig := supportUserHash
	supportUserHash = func(user string) string {
		calls++
		if users[user] {
			return testSupportHash(user)
		}
		return ""
	}
	supportSeenMu.Lock()
	supportSeen = make(map[string]time.Time)
	supportSeenMu.Unlock()
	t.Cleanup(func() { supportUserHash = orig })
	return &calls
}

func newTestJWT(t *testing.T) *jwt.GinJWTMiddleware {
	t.Helper()
	gin.SetMode(gin.TestMode)
	configuration.Config.Secret = "test-secret"
	return InitJWT()
}

func TestSupportUsernameRegex(t *testing.T) {
	for _, u := range []string{"support-neth-2239-7d37", "support-abcdefgh"} {
		if !supportUsernameRe.MatchString(u) {
			t.Errorf("expected %q to be valid", u)
		}
	}
	for _, u := range []string{"support-", "admin", "support-ABC", "support-a b", "support-a'--", "xsupport-a", "support-" + strings.Repeat("a", 65)} {
		if supportUsernameRe.MatchString(u) {
			t.Errorf("expected %q to be invalid", u)
		}
	}
}

func TestSha1Matches(t *testing.T) {
	stored := fmt.Sprintf("%x", sha1.Sum([]byte("Pa55!@#%^&*")))
	if !sha1Matches("Pa55!@#%^&*", stored) {
		t.Error("expected matching password")
	}
	if sha1Matches("wrong", stored) {
		t.Error("expected wrong password to fail")
	}
	if sha1Matches("", "") {
		t.Error("expected empty stored hash to fail")
	}
}

func supportClaims(user string, expire time.Time) map[string]interface{} {
	return map[string]interface{}{
		identityKey:    "admin",
		supportUserKey: user,
		supportExpKey:  float64(expire.Unix()),
		supportBindKey: supportBinding(testSupportHash(user)),
	}
}

func TestValidSupportClaims(t *testing.T) {
	calls := stubSupportUsers(t, map[string]bool{"support-a": true})

	if _, isSupport, _ := validSupportClaims(map[string]interface{}{identityKey: "admin"}); isSupport {
		t.Error("admin token must not be a support token")
	}
	if _, isSupport, valid := validSupportClaims(supportClaims("support-a", time.Now().Add(time.Hour))); !isSupport || !valid {
		t.Error("expected live support token to be valid")
	}
	if _, _, valid := validSupportClaims(supportClaims("support-a", time.Now().Add(-time.Second))); valid {
		t.Error("expected expired support token to be invalid")
	}
	if _, _, valid := validSupportClaims(supportClaims("support-gone", time.Now().Add(time.Hour))); valid {
		t.Error("expected removed support user to be invalid")
	}
	if _, _, valid := validSupportClaims(map[string]interface{}{supportUserKey: "support-a"}); valid {
		t.Error("expected support token without expiration to be invalid")
	}
	unbound := supportClaims("support-a", time.Now().Add(time.Hour))
	delete(unbound, supportBindKey)
	if _, _, valid := validSupportClaims(unbound); valid {
		t.Error("expected support token without row binding to be invalid")
	}
	stale := supportClaims("support-a", time.Now().Add(time.Hour))
	stale[supportBindKey] = supportBinding(fmt.Sprintf("%x", sha1.Sum([]byte("previous-session"))))
	if _, _, valid := validSupportClaims(stale); valid {
		t.Error("expected token of an earlier session to stay invalid once the row is recreated")
	}

	*calls = 0
	validSupportClaims(supportClaims("support-a", time.Now().Add(time.Hour)))
	if *calls != 0 {
		t.Error("expected cached positive lookup")
	}
	supportSeenMu.Lock()
	supportSeen["support-a|"+supportBinding(testSupportHash("support-a"))] = time.Now().Add(-supportCheckTTL - time.Second)
	supportSeenMu.Unlock()
	validSupportClaims(supportClaims("support-a", time.Now().Add(time.Hour)))
	if *calls != 1 {
		t.Error("expected lookup after cache expiry")
	}
}

func TestSupportPayloadAndLifetime(t *testing.T) {
	mw := newTestJWT(t)
	expire := time.Now().Add(supportTokenTimeout)

	claims := mw.PayloadFunc(testSupportLogin("support-a", expire))
	if claims[identityKey] != "admin" || claims[supportUserKey] != "support-a" || claims[supportExpKey] != expire.Unix() ||
		claims[supportBindKey] != supportBinding(testSupportHash("support-a")) {
		t.Errorf("unexpected support claims: %v", claims)
	}
	if supportTokenTimeout > time.Hour {
		t.Error("support tokens must not live longer than one hour")
	}
	if _, ok := mw.PayloadFunc(&models.UserAuthorizations{Username: "admin"})[supportUserKey]; ok {
		t.Error("admin token must not carry a support user")
	}
}

func refresh(mw *jwt.GinJWTMiddleware, token string) *httptest.ResponseRecorder {
	r := gin.New()
	r.GET("/refresh_token", RefreshHandler(mw))
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/refresh_token", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	return w
}

func TestRefreshDoesNotExtendSupportToken(t *testing.T) {
	stubSupportUsers(t, map[string]bool{"support-a": true})
	mw := newTestJWT(t)

	expire := time.Now().Add(30 * time.Minute)
	token, _, err := mw.TokenGenerator(testSupportLogin("support-a", expire))
	if err != nil {
		t.Fatal(err)
	}

	w := refresh(mw, token)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Token  string `json:"token"`
		Expire string `json:"expire"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Token != token {
		t.Error("support token must be returned unchanged")
	}
	if body.Expire != time.Unix(expire.Unix(), 0).Format(time.RFC3339) {
		t.Errorf("unexpected expire %s", body.Expire)
	}

	expired, _, _ := mw.TokenGenerator(testSupportLogin("support-a", time.Now().Add(-time.Second)))
	if w := refresh(mw, expired); w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired support token, got %d", w.Code)
	}

	gone, _, _ := mw.TokenGenerator(testSupportLogin("support-gone", expire))
	if w := refresh(mw, gone); w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for removed support user, got %d", w.Code)
	}

	admin, _, _ := mw.TokenGenerator(&models.UserAuthorizations{Username: "admin"})
	if w := refresh(mw, admin); w.Code != http.StatusOK {
		t.Errorf("expected admin token to be refreshed, got %d", w.Code)
	}
}

func TestSupportSession(t *testing.T) {
	stubSupportUsers(t, map[string]bool{"support-a": true})
	mw := newTestJWT(t)

	r := gin.New()
	r.Use(mw.MiddlewareFunc(), SupportSession())
	r.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	get := func(token string) int {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		r.ServeHTTP(w, req)
		return w.Code
	}

	live, _, _ := mw.TokenGenerator(testSupportLogin("support-a", time.Now().Add(time.Hour)))
	if code := get(live); code != http.StatusOK {
		t.Errorf("expected 200 for live support token, got %d", code)
	}
	expired, _, _ := mw.TokenGenerator(testSupportLogin("support-a", time.Now().Add(-time.Second)))
	if code := get(expired); code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired support token, got %d", code)
	}
	gone, _, _ := mw.TokenGenerator(testSupportLogin("support-gone", time.Now().Add(time.Hour)))
	if code := get(gone); code != http.StatusUnauthorized {
		t.Errorf("expected 401 for removed support user, got %d", code)
	}
}
