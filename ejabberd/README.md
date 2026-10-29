# ejabberd

Image `nethvoice-ejabberd`: the official ejabberd plus two Go programs.

- `chat-extauth`: ejabberd external auth; the password is the CTI JWT (Chat permission required).
- `chat-gateway`: XEP-0357 push (Web Push, Acrobits PNM), the Acrobits `fetch_messages`, `send_message`, `push_token_report` services, text search in the archive (`GET /chat-gw/search`, read-only on ejabberd's database: MAM has no text search on SQLite), and the account's groups with their pictures (`GET /chat-gw/groups`, for the mobile app's contacts through ctiapp-authproxy).

```sh
go vet ./...
```

Only errors reach the journal. To see everything else (deliveries, connections, accounts retired):

```sh
runagent -m nethvoice1 python3 -c 'import agent; agent.set_env("CHAT_DEBUG", "1")'
runagent -m nethvoice1 systemctl --user restart chat-server chat-gateway
```

Set it back to `0` the same way.
