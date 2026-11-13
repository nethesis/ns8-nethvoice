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
| `get_system_overview` | `GET /freepbx/rest/*/count`, `userprovider`, `userlimits`, `wizard` | admin, read, stdio only |
| `list_users` | `GET /freepbx/rest/users/true` | admin, read, stdio only |
| `list_outbound_routes` | `GET /freepbx/rest/outboundroutes` | admin, read, stdio only |

User tools run with the identity and the CTI profile permissions of the signed-in user. Admin tools
need the FreePBX administrator password and are therefore offered only in stdio mode, to the
system administrator who configures them on their own computer.

## Guardrails

- Every tool declares `readOnlyHint`. Write tools do not exist unless `NETHVOICE_MCP_ENABLE_WRITES=1`.
- The FreePBX REST client can only send `GET` (plus the login call): there is no code path for an
  admin write.
- Answers are reduced to named fields. Anything that looks like a credential (`secret`, `password`,
  `token`, `lkhash`...) is dropped at any depth, and free text is truncated, because names and notes
  stored in the PBX are untrusted input for the model.
- Arguments are validated against a schema before any request leaves the server.
- Every call is written to stderr as one JSON line: time, identity, tool, arguments, outcome, duration.
- Remote URLs must be `https`.

## Run it

```bash
npm install          # npm >= 11
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

Stateless: each request must carry `Authorization: Bearer <CTI JWT>`, which is forwarded to
nethcti-middleware, so the assistant acts as that user and nothing else. Admin tools are not
available in this mode. It listens on the loopback interface by default (`NETHVOICE_MCP_HOST`,
`NETHVOICE_MCP_PORT`): publish it only behind TLS.

## Configuration

| Variable | Meaning |
| --- | --- |
| `NETHVOICE_CTI_URL` | Base URL of NethVoice CTI, for example `https://cti.example.org` |
| `NETHVOICE_CTI_USERNAME`, `NETHVOICE_CTI_PASSWORD` | CTI user (stdio) |
| `NETHVOICE_CTI_TOKEN` | CTI JWT, alternative to username and password (stdio) |
| `NETHVOICE_PBX_URL` | Base URL of the PBX administration host, for example `https://voice.example.org` |
| `NETHVOICE_ADMIN_USERNAME`, `NETHVOICE_ADMIN_PASSWORD` | FreePBX administrator (stdio, admin tools) |
| `NETHVOICE_MCP_ENABLE_WRITES` | `1` to expose write tools |
| `NETHVOICE_MCP_HOST`, `NETHVOICE_MCP_PORT` | HTTP listener, default `127.0.0.1:8765` |
| `NETHVOICE_MCP_TIMEOUT_MS` | Timeout of each call to the PBX, default `15000` |

## Not done yet

- A token made for assistants: today the HTTP mode forwards the user's CTI JWT, which has no scopes
  (read / write / admin) and no short expiry. nethcti-middleware needs an `mcp` audience with scopes.
- OAuth 2.1 (protected resource metadata, PKCE, dynamic client registration), required by the web
  connectors of Claude and ChatGPT.
- An administrator role below the FreePBX `admin`, so that admin tools can be offered remotely, and
  clean admin endpoints: several `GET` of the REST API still return SIP secrets, which this server
  strips but should never receive.
- Confirmation (elicitation) and more write tools: call, hang up, queue login/logout, create contact.
- Per-identity rate limiting, and a container in the NS8 module published at `https://cti.<host>/mcp`.
