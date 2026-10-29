package api

import "strings"

// quoteWidth keeps a quoted line short enough for a phone not to wrap it, so every line keeps its bar.
const quoteWidth = 32

// appQuote turns the quote a reply starts with ("> Name: text", the XEP-0428 fallback) into
// lines the app shows apart from the answer: "┃ Name:", up to two "┃ text" lines, then the answer.
func appQuote(body string) string {
	var quote []string
	for strings.HasPrefix(body, ">") {
		i := strings.IndexByte(body, '\n')
		if i < 0 {
			return body
		}
		quote = append(quote, strings.TrimSpace(strings.TrimPrefix(body[:i], ">")))
		body = strings.TrimSpace(body[i+1:])
	}
	if len(quote) == 0 {
		return body
	}
	q := strings.Join(quote, " ")
	var b strings.Builder
	if name, text, ok := strings.Cut(q, ": "); ok {
		b.WriteString("┃ " + name + ":\n")
		q = text
	}
	for _, l := range wrap(q, quoteWidth, 2) {
		b.WriteString("┃ " + l + "\n")
	}
	return b.String() + body
}

// wrap splits text into at most n lines of about width runes, on spaces; what does not fit ends in "…".
func wrap(text string, width, n int) []string {
	var lines []string
	line := ""
	for _, w := range strings.Fields(text) {
		if line != "" && len([]rune(line+" "+w)) > width {
			if len(lines) == n-1 {
				return append(lines, line+"…")
			}
			lines = append(lines, line)
			line = ""
		}
		if line != "" {
			line += " "
		}
		line += w
	}
	return append(lines, line)
}
