package api

// Attachments: Acrobits file transfer JSON (AES-CTR files on MMMSG) <-> XEP-0066 links
// on ejabberd's upload service.

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

const (
	fileTransferType = "application/x-acro-filetransfer+json"
	maxAttachment    = 25 << 20 // ejabberd's max_size for uploads
)

type acroFile struct {
	Body        string       `json:"body,omitempty"`
	Attachments []attachment `json:"attachments"`
}

type attachment struct {
	ContentType   string `json:"content-type,omitempty"`
	ContentURL    string `json:"content-url"`
	ContentSize   int64  `json:"content-size,omitempty"`
	Filename      string `json:"filename,omitempty"`
	EncryptionKey string `json:"encryption-key,omitempty"`
	Hash          string `json:"hash,omitempty"`
}

// fileClient fetches from MMMSG and talks to ejabberd's upload service.
var fileClient = &http.Client{Timeout: 60 * time.Second}

// parseFileTransfer recognises the app's attachment message, whatever content type it was sent with.
func parseFileTransfer(contentType, body string) (*acroFile, bool) {
	if contentType != fileTransferType && !strings.HasPrefix(strings.TrimSpace(body), `{"`) {
		return nil, false
	}
	var f acroFile
	if json.Unmarshal([]byte(body), &f) != nil || len(f.Attachments) == 0 {
		return nil, false
	}
	return &f, true
}

// decrypt undoes the app's encryption: AES-CTR with the hex key and a zero IV.
func decrypt(data []byte, hexKey string) ([]byte, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("encryption key: %w", err)
	}
	block, err := aes.NewCipher(key) // 16, 24 or 32 bytes: AES-128, 192 or 256
	if err != nil {
		return nil, err
	}
	out := make([]byte, len(data))
	cipher.NewCTR(block, make([]byte, aes.BlockSize)).XORKeyStream(out, data)
	return out, nil
}

// fetchAttachment downloads one of the app's files and returns it in clear, checked against its hash.
func fetchAttachment(ctx context.Context, a attachment) ([]byte, error) {
	u, err := url.Parse(a.ContentURL)
	if err != nil || u.Scheme != "https" {
		return nil, fmt.Errorf("attachment url %q refused", a.ContentURL)
	}
	req, _ := http.NewRequestWithContext(ctx, "GET", a.ContentURL, nil)
	resp, err := fileClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("attachment: HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxAttachment+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxAttachment {
		return nil, fmt.Errorf("attachment larger than %d bytes", maxAttachment)
	}
	if a.EncryptionKey != "" {
		if data, err = decrypt(data, a.EncryptionKey); err != nil {
			return nil, err
		}
	}
	if a.Hash != "" {
		if want, err := strconv.ParseUint(a.Hash, 10, 32); err == nil && uint32(want) != crc32.ChecksumIEEE(data) {
			return nil, fmt.Errorf("attachment: checksum mismatch")
		}
	}
	return data, nil
}

// fileName picks a name the chat understands: the extension tells it a player from an image.
func fileName(a attachment) string {
	ct := a.ContentType
	if ct == "" {
		ct = "image/jpeg" // the format's default
	}
	name := path.Base(strings.TrimSpace(a.Filename))
	if name == "." || name == "/" || name == "" {
		kind := "file"
		switch {
		case strings.HasPrefix(ct, "audio/"):
			kind = "voice"
		case strings.HasPrefix(ct, "image/"):
			kind = "image"
		case strings.HasPrefix(ct, "video/"):
			kind = "video"
		}
		name = fmt.Sprintf("%s-%d", kind, time.Now().UnixMilli())
	}
	if path.Ext(name) == "" {
		name += extFor(ct)
	}
	return name
}

func extFor(ct string) string {
	switch strings.ToLower(strings.TrimSpace(strings.SplitN(ct, ";", 2)[0])) {
	case "audio/ogg", "audio/opus":
		return ".ogg"
	case "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac":
		return ".m4a"
	case "audio/mpeg":
		return ".mp3"
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/heic":
		return ".heic"
	case "video/mp4":
		return ".mp4"
	case "video/quicktime":
		return ".mov"
	}
	if exts, _ := mime.ExtensionsByType(ct); len(exts) > 0 {
		return exts[0]
	}
	return ""
}

// storeUpload puts a file on ejabberd's upload service for this account and returns its public URL.
// The PUT goes to ejabberd on loopback: the public URL answers through Traefik, the gateway does not need to.
func (s *Server) storeUpload(ctx context.Context, ses *xmppc.Session, name, contentType string, data []byte) (string, error) {
	put, get, headers, err := ses.Slot(ctx, name, int64(len(data)), contentType)
	if err != nil {
		return "", err
	}
	req, _ := http.NewRequestWithContext(ctx, "PUT", s.loopbackUpload(put), bytes.NewReader(data))
	req.Host = hostOf(put) // ejabberd finds the slot by the virtual host it was issued for
	req.ContentLength = int64(len(data))
	req.Header.Set("Content-Type", contentType)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := fileClient.Do(req)
	if err != nil {
		return "", err
	}
	resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return "", fmt.Errorf("upload: HTTP %d", resp.StatusCode)
	}
	return get, nil
}

// loopbackUpload turns https://<host>/upload/... into the local ejabberd listener, when one is configured.
func (s *Server) loopbackUpload(public string) string {
	if s.UploadURL == "" {
		return public
	}
	if i := strings.Index(public, "/upload/"); i >= 0 {
		return strings.TrimSuffix(s.UploadURL, "/") + public[i+len("/upload"):]
	}
	return public
}

// publicURL points an upload link at the current CTI host: links survive a host change.
func (s *Server) publicURL(link string) string {
	if i := strings.Index(link, "/upload/"); i >= 0 && s.PublicHost != "" {
		return "https://" + s.PublicHost + link[i:]
	}
	return link
}

func hostOf(link string) string {
	if u, err := url.Parse(link); err == nil {
		return u.Host
	}
	return ""
}

// sendFileTransfer relays each of the app's attachments as a chat attachment; the text, if any, goes as its caption.
func (s *Server) sendFileTransfer(ctx context.Context, ses *xmppc.Session, to string, group bool, f *acroFile) (string, error) {
	var last string
	for i, a := range f.Attachments {
		data, err := fetchAttachment(ctx, a)
		if err != nil {
			return "", err
		}
		name := fileName(a)
		ct := a.ContentType
		if ct == "" {
			ct = "image/jpeg"
		}
		link, err := s.storeUpload(ctx, ses, name, ct, data)
		if err != nil {
			return "", err
		}
		caption := name // the chat hides a caption equal to the file name
		if i == 0 && strings.TrimSpace(f.Body) != "" {
			caption = f.Body
		}
		if group {
			last, err = ses.SendGroup(ctx, to, caption, link)
		} else {
			last, err = ses.Send(ctx, to, caption, link)
		}
		if err != nil {
			return "", err
		}
	}
	return last, nil
}

// Size and CRC32 of our own uploads, read once: the app uses the size to decide whether to
// download by itself, and checks what it downloaded against the hash, as for its own files.
type fileInfo struct {
	size int64
	hash string
}

var (
	infoMu sync.Mutex
	infos  = map[string]fileInfo{}
)

func (s *Server) uploadInfo(ctx context.Context, link string) fileInfo {
	infoMu.Lock()
	fi, ok := infos[link]
	infoMu.Unlock()
	if ok {
		return fi
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", s.loopbackUpload(link), nil)
	req.Host = hostOf(link)
	resp, err := fileClient.Do(req)
	if err != nil {
		return fileInfo{}
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fileInfo{}
	}
	h := crc32.NewIEEE()
	n, err := io.Copy(h, io.LimitReader(resp.Body, maxAttachment+1))
	if err != nil || n == 0 || n > maxAttachment {
		return fileInfo{}
	}
	fi = fileInfo{size: n, hash: strconv.FormatUint(uint64(h.Sum32()), 10)}
	infoMu.Lock()
	if len(infos) > 5000 {
		infos = map[string]fileInfo{}
	}
	infos[link] = fi
	infoMu.Unlock()
	return fi
}

// fileTransferText renders a chat attachment for the app.
func (s *Server) fileTransferText(ctx context.Context, link, caption string) string {
	name := path.Base(link)
	if u, err := url.PathUnescape(name); err == nil {
		name = u
	}
	ct := mime.TypeByExtension(strings.ToLower(path.Ext(name)))
	switch strings.ToLower(path.Ext(name)) {
	case ".m4a":
		ct = "audio/mp4"
	case ".ogg", ".opus":
		ct = "audio/ogg"
	case ".webm":
		ct = "audio/webm"
	}
	if ct == "" {
		ct = "application/octet-stream"
	}
	fi := s.uploadInfo(ctx, link)
	a := attachment{ContentType: strings.SplitN(ct, ";", 2)[0], ContentURL: s.publicURL(link), Filename: name, ContentSize: fi.size, Hash: fi.hash}
	// The app's own voice notes carry no file name: that is how it tells them from an audio file.
	if strings.HasPrefix(a.ContentType, "audio/") {
		a.Filename = ""
	}
	f := acroFile{Attachments: []attachment{a}}
	if caption != "" && caption != name && caption != link {
		f.Body = caption
	}
	out, _ := json.Marshal(f)
	return string(out)
}
