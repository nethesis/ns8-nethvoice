package api

import "testing"

func TestAppQuote(t *testing.T) {
	for in, want := range map[string]string{
		"just text": "just text",
		"> Edoardo Spadoni: per my ti è arrivata una email, devi seguire quello che c'è scritto per accedere\nottimo... Grazie !": "┃ Edoardo Spadoni:\n┃ per my ti è arrivata una email,\n┃ devi seguire quello che c'è…\nottimo... Grazie !",
		"> Mario: ok\nsì": "┃ Mario:\n┃ ok\nsì",
		"> no newline":    "> no newline",
	} {
		if got := appQuote(in); got != want {
			t.Errorf("appQuote(%q)\n got %q\nwant %q", in, got, want)
		}
	}
}
