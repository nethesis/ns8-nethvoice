package api

import (
	"regexp"
	"strings"
)

// The Acrobits app has no emoji shortcodes: :+1: typed there, or kept from older
// messages, reaches the other side as its emoji. Code (`inline`, ``` fenced) is left alone.
var (
	codeRe      = regexp.MustCompile("(?s)```.*?(?:```|$)|`[^`\n]*`?")
	shortcodeRe = regexp.MustCompile(`:([a-z0-9_+-]+):`)
)

func emojify(text string) string {
	if !strings.Contains(text, ":") {
		return text
	}
	var b strings.Builder
	last := 0
	for _, loc := range codeRe.FindAllStringIndex(text, -1) {
		b.WriteString(convertShortcodes(text[last:loc[0]]))
		b.WriteString(text[loc[0]:loc[1]])
		last = loc[1]
	}
	b.WriteString(convertShortcodes(text[last:]))
	return b.String()
}

func convertShortcodes(s string) string {
	return shortcodeRe.ReplaceAllStringFunc(s, func(whole string) string {
		if e, ok := shortcodeTable[whole[1:len(whole)-1]]; ok {
			return e
		}
		return whole
	})
}
