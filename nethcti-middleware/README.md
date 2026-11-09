# nethcti-middleware

Backend layer for NethVoice. It exposes the new HTTP API, handles authentication
and 2FA, and proxies everything it does not implement to the legacy
`nethcti-server`. Deployed as a container by
[ns8-nethvoice](https://github.com/nethesis/ns8-nethvoice).

## Documentation

- [API reference](https://bump.sh/nethesis/doc/nethcti-middleware/) — browsable,
  published from [`doc/openapi.yaml`](doc/openapi.yaml) on every push to `main`
- [NethVoice API guides](https://docs.nethvoice.com/docs/tutorial/api) — how the
  middleware, the CTI server and the wizard APIs fit together
- [`doc/README.md`](doc/README.md) — profiles and users configuration files

## Configuration

All configuration comes from environment variables.

### Server

| Variable | Description | Default |
|---|---|---|
| `NETHVOICE_MIDDLEWARE_LISTEN_ADDRESS` | Address and port to listen on | `127.0.0.1:8080` |
| `NETHVOICE_MIDDLEWARE_SECRETS_DIR` | Directory holding the JWT secret and sessions | `/var/lib/whale/secrets` |
| `NETHVOICE_MIDDLEWARE_SENSITIVE_LIST` | Field names masked in request logs | `password,secret,token,passphrase,private,key` |
| `NETHVOICE_MIDDLEWARE_TRUSTED_PROXY` | IP or CIDR of the proxy in front, for Gin's [trusted proxies](https://gin-gonic.com/en/docs/deployment/#dont-trust-all-proxies) | `127.0.0.1` |
| `NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_AVERAGE` | Sustained requests/sec per client IP; `0` disables it | `25` |
| `NETHVOICE_MIDDLEWARE_GLOBAL_RATE_LIMIT_BURST` | Burst above the average before HTTP 429 | `100` |
| `GIN_MODE` | `release` hides Gin's per-request access log, `debug` prints it | `debug` (Gin's default) |

### Legacy backend

| Variable | Description | Default |
|---|---|---|
| `NETHVOICE_MIDDLEWARE_V1_API_ENDPOINT` | Hostname/IP of the legacy API | **required** |
| `NETHVOICE_MIDDLEWARE_V1_WS_ENDPOINT` | Hostname/IP of the legacy WebSocket | **required** |
| `NETHVOICE_MIDDLEWARE_V1_PROTOCOL` | Protocol used to reach them | `https` |
| `NETHVOICE_MIDDLEWARE_V1_API_PATH` | Path prefix for legacy API calls | _(empty)_ |
| `NETHVOICE_MIDDLEWARE_V1_WS_PATH` | Path for legacy WebSocket connections | `/socket.io` |
| `NETHVOICE_MIDDLEWARE_FREEPBX_APIS` | Comma-separated FreePBX paths that bypass JWT | see `configuration.go` |

### MariaDB

| Variable | Description | Default |
|---|---|---|
| `NETHVOICE_MIDDLEWARE_MARIADB_HOST` | Hostname | `localhost` |
| `NETHVOICE_MIDDLEWARE_MARIADB_PORT` | Port | **required** |
| `NETHVOICE_MIDDLEWARE_MARIADB_USER` | Username | `root` |
| `NETHVOICE_MIDDLEWARE_MARIADB_PASSWORD` | Password | **required** |
| `NETHVOICE_MIDDLEWARE_MARIADB_DATABASE` | Phonebook and persistence database | `nethcti3` |
| `NETHVOICE_MIDDLEWARE_MARIADB_CDR_DATABASE` | Call history database | `asteriskcdrdb` |

### Satellite (transcripts and summaries)

| Variable | Description | Default |
|---|---|---|
| `SATELLITE_PGSQL_HOST` | PostgreSQL hostname | `localhost` |
| `SATELLITE_PGSQL_PORT` | PostgreSQL port | `5432` |
| `SATELLITE_PGSQL_USER` | PostgreSQL username | `satellite` |
| `SATELLITE_PGSQL_PASSWORD` | PostgreSQL password | _(empty)_ |
| `SATELLITE_PGSQL_DB` | PostgreSQL database | `satellite` |
| `SATELLITE_MQTT_HOST` | MQTT broker hostname | `127.0.0.1` |
| `SATELLITE_MQTT_PORT` | MQTT broker port | `1883` |
| `SATELLITE_MQTT_USERNAME` | MQTT username | `satellite` |
| `SATELLITE_MQTT_PASSWORD` | MQTT password; MQTT stays off while it is empty | _(empty)_ |

### Authorization

| Variable | Description | Default |
|---|---|---|
| `AUTH_PROFILES_PATH` | Profiles file | `/etc/nethcti/profiles.json` |
| `AUTH_USERS_PATH` | Users file | `/etc/nethcti/users.json` |
| `NETHVOICE_MIDDLEWARE_ISSUER_2FA` | Issuer shown in 2FA authenticator apps | `NethVoice` |
| `NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN` | Bearer token for `/admin/*` | random at startup |
| `NETHVOICE_MIDDLEWARE_SUPER_ADMIN_ALLOW_IPS` | Comma-separated IPs or CIDRs allowed to call `/admin/*` | `127.0.0.0/8` |

## Development

Requires Go 1.26+ and `oathtool`, used by the 2FA tests.

```bash
go build -o whale          # build
go test ./...              # test
podman build -t nethcti-middleware .
```

Tests bring up their own mock legacy server, secrets directory and JWT secret.
The MariaDB-backed ones skip themselves when no server is reachable; CI runs
them against MariaDB 10.11, the version ns8-nethvoice ships.

For a full set of environment variables to run the container against, see the
[systemd unit in ns8-nethvoice](https://github.com/nethesis/ns8-nethvoice/blob/main/imageroot/systemd/user/nethcti-middleware.service).

## Migration status annotations

When a route replaces a legacy `nethcti-server` endpoint at a **different** path,
annotate it in `main.go` right above the route. The
[migration status dashboard](https://migration.ta.nethserver.net/migration-status)
(internal) reads these; identical paths are detected automatically.

```go
// @migration-replaces: POST /authentication/phone_island_token_login
// @migration-note: Replaced by the new persistent token API.
api.POST("/tokens/persistent/:audience", methods.CreatePersistentToken)
```

`@migration-replaces` takes the method and the full legacy path, one line per
replaced path. `@migration-note` is optional. The block may contain blank lines
and plain `//` comments, but no other code before the route.
