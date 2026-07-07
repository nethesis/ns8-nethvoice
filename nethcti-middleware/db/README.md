# Database management

This file briefly documents how the `db` package initializes the MariaDB connection and applies schema SQL included in the repository.

## Paths

- `db/create.sql` — embedded initial schema (creates all required tables).
- `db/upgrade.sql` — embedded SQL file containing idempotent schema upgrades.

## Environment variables (used to build DSN)

-- `NETHVOICE_MIDDLEWARE_MARIADB_HOST` (default: `localhost`)
-- `NETHVOICE_MIDDLEWARE_MARIADB_PORT` (default: `3306`)
-- `NETHVOICE_MIDDLEWARE_MARIADB_USER` (default: `root`)
-- `NETHVOICE_MIDDLEWARE_MARIADB_PASSWORD` (default: `root` in local/test)
-- `NETHVOICE_MIDDLEWARE_MARIADB_DATABASE` (default: `nethcti3`)

Satellite DB connection (transcripts, PostgreSQL):
-- `SATELLITE_PGSQL_HOST` (default: `localhost`)
-- `SATELLITE_PGSQL_PORT` (default: `5432` when host is set)
-- `SATELLITE_PGSQL_USER` (default: `satellite` when host is set)
-- `SATELLITE_PGSQL_PASSWORD`
-- `SATELLITE_PGSQL_DB` (default: `satellite` when host is set)
## Schema Migrations & Upgrades

If the database already exists when the application starts, `db.Init()` will run the embedded `db/upgrade.sql` automatically. The statements in `upgrade.sql` must be idempotent and safe to re-run.

Please note that `db/upgrade.sql` should contain idempotent statements (or checks) because it may be executed on existing databases and can be re-run in tests/CI.

### Connection Pool Configuration

The middleware uses a connection pool with the following defaults:
- Max open connections: 25
- Max idle connections: 5
- Connection max lifetime: 5 minutes

These can be adjusted in `db/db.go` if needed for your workload.

## Testing

- Unit tests for the package run with `go test ./db`.
- Integration tests that exercise the real DB require a running MariaDB instance (see `agents.md` for a Podman/Docker command).