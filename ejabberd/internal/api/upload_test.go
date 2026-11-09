package api

import "testing"

func TestLoopbackUpload(t *testing.T) {
	s := &Server{UploadURL: "http://127.0.0.1:20044/upload", PublicHost: "cti.example.com"}
	ok := map[string]string{
		"https://cti.example.com/upload/3f2a/photo.jpg":         "http://127.0.0.1:20044/upload/3f2a/photo.jpg",
		"https://old.example.com/upload/3f2a/My%20file.pdf":     "http://127.0.0.1:20044/upload/3f2a/My%20file.pdf",
		"https://cti.example.com/upload/3f2a/archive.v1.tar.gz": "http://127.0.0.1:20044/upload/3f2a/archive.v1.tar.gz",
	}
	for in, want := range ok {
		if got, good := s.loopbackUpload(in); !good || got != want {
			t.Errorf("loopbackUpload(%q) = %q, %v; want %q", in, got, good, want)
		}
	}
	// Whatever steps out of /upload/ reaches the admin API on the same listener: refused.
	for _, in := range []string{
		"https://cti.example.com/upload/../api/send_stanza",
		"https://cti.example.com/upload/%2e%2e/api/send_stanza",
		"https://cti.example.com/upload/%2E%2E/api/send_stanza",
		"https://cti.example.com/upload/x/..%2f..%2fapi/destroy_room",
		"https://cti.example.com/upload/a/b?room=x&affiliation=owner",
		"https://cti.example.com/upload/a/b?",
		"https://cti.example.com/upload/a/b#frag",
		"https://cti.example.com/upload/a//b",
		"https://cti.example.com/upload/a/b/",
		"https://cti.example.com/upload/a\\..\\api",
		"https://cti.example.com/upload/a;/../api",
		"https://user@cti.example.com/upload/a/b",
		"https://cti.example.com/api/upload/a/b",
		"https://cti.example.com/xupload/a/b",
		"file:///upload/a/b",
		"/upload/a/b",
		"",
	} {
		if got, good := s.loopbackUpload(in); good {
			t.Errorf("loopbackUpload(%q) = %q, accepted", in, got)
		}
		if got := s.publicURL(in); got != in {
			t.Errorf("publicURL(%q) = %q, rewritten", in, got)
		}
	}
	if got := s.publicURL("https://old.example.com/upload/3f2a/a.png"); got != "https://cti.example.com/upload/3f2a/a.png" {
		t.Errorf("publicURL moved host: %q", got)
	}
}
