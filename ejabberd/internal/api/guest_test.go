package api

import "testing"

func TestGuestNick(t *testing.T) {
	taken := map[string]bool{"Mario Rossi": true, "Mario Rossi 2": true}
	for in, want := range map[string]string{"Mario Rossi": "Mario Rossi 3", "Anna": "Anna", "mario": "mario ·", "edoardo.s": "edoardo.s ·"} {
		if got := guestNick(in, taken); got != want {
			t.Errorf("guestNick(%q) = %q, want %q", in, got, want)
		}
	}
	if !IsGuest("g~0123456789ab@chat.internal") || IsGuest("edoardo@chat.internal") || IsGuest("gianni") || IsGuest("g.rossi") {
		t.Error("IsGuest")
	}
}

func TestGuestName(t *testing.T) {
	for in, want := range map[string]string{"  Mario   Rossi ": "Mario Rossi", "ACME; srl=x": "ACME; srl=x"} {
		if got, ok := guestName(in); !ok || got != want {
			t.Errorf("guestName(%q) = %q, %v", in, got, ok)
		}
	}
	for _, in := range []string{"", "   ", "a\x00b", "a\u202eb", "a\u200bb", string(make([]rune, 65))} {
		if _, ok := guestName(in); ok {
			t.Errorf("guestName(%q) accepted", in)
		}
	}
}
