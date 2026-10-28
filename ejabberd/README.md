# ejabberd

Image `nethvoice-ejabberd`: the official ejabberd plus two Go programs.

- `chat-extauth`: ejabberd external auth; the password is the CTI JWT (Chat permission required).
- `chat-gateway`: XEP-0357 push (Web Push, Acrobits PNM), the Acrobits `fetch_messages`, `send_message`, `push_token_report` services, and text search in the archive (`GET /chat-gw/search`, read-only on ejabberd's database: MAM has no text search on SQLite).

```sh
go vet ./...
```

Only errors reach the journal. To see everything else (deliveries, connections, accounts retired):

```sh
runagent -m nethvoice1 python3 -c 'import agent; agent.set_env("CHAT_DEBUG", "1")'
runagent -m nethvoice1 systemctl --user restart chat-server chat-gateway
```

Set it back to `0` the same way.

## Private call consultation transport

The optional `CHAT_CONSULTATION_LISTEN=127.0.0.1:<port>` listener uses a separate
route table and `VOICE_AGENT_CHAT_TOKEN` (at least 32 random characters). It exposes
only authenticated consultation sends/replies. `VOICE_AGENT_RECIPIENT_URL` and
`VOICE_AGENT_RECIPIENT_TOKEN` point to the scoped FreePBX loopback service. Never expose
these through the public gateway or reverse proxy. The NS8 module provisions them.

`voice-agent-assistant` is a reserved XMPP service identity. The gateway derives its
short-lived password internally; Satellite never receives the component secret.
Receipts retain IDs, recipient/reference/expiry, state and a body hash, never message
bodies. Unknown send status is not retried after reconnect. Replies require the
verified sender and an unquoted `#REFERENCE` in the first line within the original deadline. The
transport carries text only; Satellite owns decisions, consent and call state.

Run `go test ./...` for auth, sender/reference/expiry, DND, stale-state, idempotency
and reconnect checks. Real browser/mobile display and reply acceptance remains an
installed-image test.
