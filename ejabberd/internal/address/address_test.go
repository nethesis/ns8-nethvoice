package address

import "testing"

func TestAuthor(t *testing.T) {
	for nick, want := range map[string]string{"mario": "Mario Rossi", "Ada Lovelace": "Ada Lovelace (External)", "ada ·": "ada (External)", "": "Mario Rossi"} {
		if got := Author(nick, "Mario Rossi"); got != want {
			t.Errorf("Author(%q) = %q, want %q", nick, got, want)
		}
	}
}
