# NethVoice MCP server (prototype)

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI assistant
(Claude Desktop, Claude Code, any MCP client) look at a NethVoice PBX through the APIs that already
exist. It holds no domain logic: every tool is one or a few calls to nethcti-middleware (`/api`) or
to the FreePBX REST API (`/freepbx/rest`), reshaped into a small, credential-free answer.

It is a prototype: it proves the tool catalogue and the guardrails on a real PBX. What is still
missing before it can be offered to customers is listed at the bottom.

## Tools

| Tool | Backend | Access |
| --- | --- | --- |
| `get_my_profile` | `GET /api/user/me` | user, read |
| `list_extensions_status` | `GET /api/astproxy/extensions` | user, read |
| `get_trunks_status` | `GET /api/astproxy/trunks` | user, read |
| `get_queues_status` | `GET /api/astproxy/queues` | user, read |
| `search_contacts` | `GET /api/phonebook/search/{term}` | user, read |
| `set_my_presence` | `POST /api/user/presence` | user, write, only with `NETHVOICE_MCP_ENABLE_WRITES=1` |
| `get_system_overview` | `GET /freepbx/rest/*/count`, `configuration/userprovider`, `mainextensions/userlimits`, `configuration/wizard` | admin, read, any section |
| `list_users` | `GET /freepbx/rest/users/all` | admin, read, any section |
| `list_outbound_routes` | `GET /freepbx/rest/outboundroutes` | admin, read, any section |
| `get_today_calls` | `GET /freepbx/rest/dashboard/calls` | admin, read, `dashboard` section |

User tools run with the identity and the CTI profile permissions of the signed-in user.

Admin tools are offered only in stdio mode, to the system administrator who configures them on their
own computer. At startup the server reads `GET /freepbx/rest/me` and registers only the admin tools
that the sections of that administrator allow: the counters, the user list and the outbound routes
are lookup endpoints open to any NethVoice administrator, the calls of today need the `dashboard`
section (or `superadmin`). `get_system_overview` returns `null` for the fields the administrator
cannot read, such as the user provider (`superadmin` only), and lists them in `unavailable` with the
reason. If the permissions cannot be read, the admin tools are left out and the reason is written
to stderr.

`list_users` reads `GET /users/all`, which does not start a synchronization with the user provider
(`GET /users/true` does). The REST API returns the user password and the SIP secrets: the server
drops them before the answer reaches the assistant.

### A dedicated administrator for the assistant

Do not give the assistant the FreePBX `admin` password. Create a FreePBX administrator for it and
grant only the sections it needs. Sections are stored in `ampusers.sections` as `nethvoice:<section>`
entries separated by `;`; NethVoice has no page to manage them yet. For the read-only tools above,
`nethvoice:dashboard` is enough:

```sql
UPDATE ampusers SET sections = 'nethvoice:dashboard' WHERE username = 'mcp-assistant';
```

Any NethVoice section gives access to the lookup endpoints used by `get_system_overview`,
`list_users` and `list_outbound_routes`. Requests to other sections are rejected by the REST API with
`403 Forbidden: missing permission`, whatever this server does.

## Guardrails

- Every tool declares `readOnlyHint`. Write tools do not exist unless `NETHVOICE_MCP_ENABLE_WRITES=1`.
- The FreePBX REST client can only send `GET` (plus the login call): there is no code path for an
  admin write.
- Answers are reduced to named fields. Anything that looks like a credential (`secret`, `password`,
  `token`, `lkhash`...) is dropped at any depth, and free text is truncated, because names and notes
  stored in the PBX are untrusted input for the model.
- Responses are checked before they are reshaped: a response with an unexpected shape becomes an
  error that names the request, not a crash or an empty list.
- Arguments are validated against a schema before any request leaves the server.
- Each tool call has one deadline (`NETHVOICE_MCP_TIMEOUT_MS`) shared by all the requests it makes,
  login included. Concurrent calls share one login.
- Errors name the method, the path and the cause (HTTP status and message, `ENOTFOUND`,
  `ECONNREFUSED`, `timeout`), never credentials.
- Every call is written to stderr as one JSON line: time, identity, tool, arguments, outcome,
  duration. The identity is the CTI username for user tools and the FreePBX administrator for admin
  tools.
- Remote URLs must be `https`; plain `http` is accepted only for `localhost`, `127.0.0.1` and `[::1]`.

## Run it

```bash
npm install
npm test
```

### stdio (Claude Desktop, Claude Code)

```bash
claude mcp add nethvoice \
  --env NETHVOICE_CTI_URL=https://cti.example.org \
  --env NETHVOICE_CTI_USERNAME=a.miller \
  --env NETHVOICE_CTI_PASSWORD='...' \
  -- node /path/to/ns8-nethvoice/mcp/src/main.mjs
```

Add `NETHVOICE_PBX_URL`, `NETHVOICE_ADMIN_USERNAME` and `NETHVOICE_ADMIN_PASSWORD` to get the admin
tools as well. `NETHVOICE_CTI_TOKEN` can replace username and password with a JWT obtained from
`POST /api/login`.

### Streamable HTTP

```bash
NETHVOICE_CTI_URL=https://cti.example.org npm run start:http   # http://127.0.0.1:8765/mcp
```

Stateless: each request must carry `Authorization: Bearer <CTI JWT>`. Before handling the request,
the server checks the token with `GET /api/user/me` on nethcti-middleware and keeps the answer for
60 seconds (by token hash). A missing or rejected token gets `401` with `WWW-Authenticate: Bearer`;
an unreachable CTI gets `502`. The token is then forwarded to nethcti-middleware on every tool call,
so the assistant acts as that user and nothing else, and the audit log records that username. Admin
tools are not available in this mode.

Requests whose `Host` is not in `NETHVOICE_MCP_ALLOWED_HOSTS`, or that carry an `Origin` not in
`NETHVOICE_MCP_ALLOWED_ORIGINS`, are rejected with `403` (DNS rebinding protection, also enabled in
the SDK transport). It listens on the loopback interface by default (`NETHVOICE_MCP_HOST`,
`NETHVOICE_MCP_PORT`): publish it only behind TLS, and set `NETHVOICE_MCP_ALLOWED_HOSTS` to the
public host name.

## Configuration

| Variable | Meaning |
| --- | --- |
| `NETHVOICE_CTI_URL` | Base URL of NethVoice CTI, for example `https://cti.example.org` |
| `NETHVOICE_CTI_USERNAME`, `NETHVOICE_CTI_PASSWORD` | CTI user (stdio) |
| `NETHVOICE_CTI_TOKEN` | CTI JWT, alternative to username and password (stdio) |
| `NETHVOICE_PBX_URL` | Base URL of the PBX administration host, for example `https://voice.example.org` |
| `NETHVOICE_ADMIN_USERNAME`, `NETHVOICE_ADMIN_PASSWORD` | FreePBX administrator for the admin tools (stdio), preferably a dedicated one |
| `NETHVOICE_MCP_ENABLE_WRITES` | `1` to expose write tools |
| `NETHVOICE_MCP_HOST`, `NETHVOICE_MCP_PORT` | HTTP listener, default `127.0.0.1:8765` |
| `NETHVOICE_MCP_ALLOWED_HOSTS` | Comma-separated `Host` values accepted in HTTP mode. Default: `localhost`, `127.0.0.1` and `[::1]` with the port on a loopback listener, `host:port` otherwise. Required when listening on `0.0.0.0` or `::` |
| `NETHVOICE_MCP_ALLOWED_ORIGINS` | Comma-separated `Origin` values accepted in HTTP mode. Default: none, so browser requests are rejected |
| `NETHVOICE_MCP_TIMEOUT_MS` | Deadline of each tool call, default `15000` |

## Not done yet

- A token made for assistants: today the HTTP mode forwards the user's CTI JWT, which has no scopes
  (read / write / admin) and no short expiry. nethcti-middleware needs an `mcp` audience with scopes.
- OAuth 2.1 (protected resource metadata at `/.well-known/oauth-protected-resource`, PKCE, dynamic
  client registration), required by the web connectors of Claude and ChatGPT. The `401` answers do
  not carry `resource_metadata` yet.
- A page to grant NethVoice sections to an administrator, so that the dedicated account above can be
  created without SQL, and admin tools offered remotely.
- Clean admin endpoints: several `GET` of the REST API still return SIP secrets and user passwords,
  which this server strips but should never receive.
- Confirmation (elicitation) and more write tools: call, hang up, queue login/logout, create contact.
- Per-identity rate limiting, and a container in the NS8 module published at `https://cti.<host>/mcp`.
