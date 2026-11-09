# AGENTS.md

## Project identity

Tancredi is a file-backed IP phone provisioning engine. Runtime code is in `public/` and `src/`; shipped provisioning data lives in `data/`; repo docs are a separate Jekyll site in `docs/`.

## Architecture snapshot

* Stack: PHP 8.1+, Slim 4, Slim PSR-7, PHP-DI, Twig 3, Monolog 3, and IP-address middleware. Treat `composer.json` as authoritative.
* Two HTTP front controllers: `public/api-v1.php` for admin CRUD/assets, `public/provisioning.php` for provisioning and token-gated file delivery.
* Persistent state is filesystem-only: scopes are `.ini` files; tokens are files in token directories; templates are Twig files; writable overrides come from `rw_dir`, shipped defaults from `ro_dir`.
* Provisioning path is: request filename → regex rule in `data/patterns.d/*.ini` → `scopeid` + template variable name → merged variables (`defaults` → model → phone) → optional runtime filters → Twig render.

## Components and responsibilities

* `public/api-v1.php`: CRUD for phones/models/defaults, asset upload/list/delete for backgrounds/firmware/ringtones/screensavers, MAC vendor listing, `tok1` regeneration, optional auth middleware.
* `public/provisioning.php`: serves provisioning payloads and token-protected asset downloads; also exposes `/check/ping`.
* `src/Entity/FileStorage.php`: read/write/list/delete scopes from `ro_dir`/`rw_dir`.
* `src/Entity/Scope.php`: inheritance merge, write-back, provisioning URL assembly, metadata/version timestamps.
* `src/Entity/TokenManager.php`: `tok1`/`tok2` file lifecycle and token→phone resolution.
* `src/LoggingMiddleware.php` + `src/LoggerFactory.php`: request/response logging with sensitive-field redaction and config-driven sink/level.
* `scripts/upgrade.php` + `scripts/upgrade.d/*.php`: ordered data migrations driven by per-scope/defaults `version` metadata.

## Runtime and entrypoints

* Config file path is `tancredi_conf` env var or `/etc/tancredi.conf`; core keys include `rw_dir`, `ro_dir`, `provisioning_url_path`, `api_url_path`, `runtime_filters`, `file_reader`, `upstream_proxies`, and optional `auth_class`.
* Expected web mappings are `/provisioning/ => public/provisioning.php` and `/tancredi/api/v1/ => public/api-v1.php`; CI configures Apache aliases exactly that way.
* `file_reader` changes asset serving mode: native PHP stream vs `X-Sendfile` vs `X-Accel-Redirect`.
* `APP_DEBUG` affects provisioning error-details fallback; API uses `displayErrorDetails` from config.

## State and data model

* Main entities are `defaults`, `model`, and `phone`; inheritance order is `defaults` → model → phone.
* Scope files use `[metadata]` and `[data]`; model metadata includes at least `scopeType`, `displayName`, and often `version`.
* `tok1` is first-access, `tok2` is steady-state. Access through `tok2` deletes any first-access token for that phone.
* Tokenless provisioning (`GET /{filename}`) intentionally blanks `account_*`, `adminpw`, and `userpw`, then reuses `tok1` semantics by forcing `tok2 = tok1`. Do not weaken this path accidentally.
* Template override order is `rw_dir/templates-custom/` before `ro_dir/templates/`.

## Build / test / dev workflow

* Syntax/quality CI: `composer validate`, `composer install`, PHP lint on `public/ src/ scripts/`, Twig syntax checks on `data/*.tmpl|*.macros`, INI syntax checks on `data/*.ini`.
* Local Bats workflow: `./test/run.sh` now defaults to a low-privilege local harness that uses `var/test-runtime/`, a generated `tancredi.conf`, repo-local writable data, and PHP's built-in web server while preserving the public `/provisioning/` and `/tancredi/api/v1/` paths.
* End-to-end CI/system workflow: Apache on Ubuntu, deployed layout under `/usr/share/tancredi` + `/var/lib/tancredi/data`, then Bats suite via `./test/run.sh system`.
* Bats coverage is repo-specific: upgrades, models, phones, defaults, file uploads, golden-fixture rendering, and template operand safety across vendor families.
* Docs site is Jekyll/Just-the-Docs, with variable metadata in `docs/_data/*.tsv`.

## Code-change rules

* Prefer data-layer edits over PHP edits when behavior is vendor/model-specific: most provisioning behavior is encoded in `data/scopes/*.ini`, `data/patterns.d/*.ini`, and `data/templates/*`.
* Treat `docs/` as secondary to code for runtime behavior; update docs when public behavior changes, but do not derive implementation constraints from stale docs.
* Any persistent-data change that alters shipped scope values must preserve upgrade/idempotency semantics and bump the relevant `version` in migration logic.
* Avoid editing `vendor/` unless the change is an intentional dependency/vendor refresh. The repo currently contains `vendor/`, even though `.gitignore` excludes it.

## Safe-change patterns

* New phone/model support: add or update scope `.ini`; add pattern rule only if request filename/vendor mapping changes; add/update template or macros only if existing family template cannot express it; add Bats coverage or fixture updates for rendered output. This is the lowest-risk path in this repo.
* Provisioning render changes: validate both normal rendering and operand-safety scenarios, especially for Snom/Fanvil/Yealink/Nethesis families.
* API/storage changes: keep `api-v1.php`, `FileStorage`, `Scope`, `TokenManager`, and Bats helpers aligned.
* Auth changes: use `auth_class` plug-in style under `src/Entity`; API does not own auth itself.
* Testing changes: keep `./test/run.sh` as the canonical entrypoint. Local mode should stay repo-local and low-privilege; CI/system mode must keep compatibility with Apache aliases, `/usr/share/tancredi`, `/var/lib/tancredi/data`, and `/tmp/fixtures` artifact output.

## Repo-specific conventions

* Template selectors are variables (`tmpl_phone`, `tmpl_firmware`, `tmpl_variables`), not hard-coded filenames in routing rules.
* Pattern files are merged from every `data/patterns.d/*.ini`; first matching regex wins. A small regex change can reroute an entire vendor family.
* Runtime filters are PHP callables instantiated by class name from config and invoked on the full scope array immediately before rendering.
* Variable reference docs are generated from TSV data, not hand-maintained prose.

## High-risk areas / invariants

* `public/provisioning.php` is the main coupling hotspot: it depends on pattern regexes, scope inheritance, token lifecycle, runtime filters, and Twig overrides.
* Token semantics are security-sensitive: invalid token handling, first-access invalidation, and secret stripping must stay intact.
* Upgrade scripts are ordered by filename glob and expected to be idempotent.
* Template output is contract-tested against fixtures; changing output formatting is a public behavior change.

## Definition of done

* Relevant PHP/Twig/INI lint checks pass in the same scope as `.github/workflows/php.yml`.
* Relevant Bats scenarios pass in the appropriate mode: `./test/run.sh` for local development changes and `./test/run.sh system` for CI/system-layout-sensitive changes. If provisioning output changed, fixtures and/or rendering tests are updated deliberately.
* Stored-data changes have an upgrade story when needed and remain idempotent.
* Public API/provisioning/docs behavior stays consistent with deployed path/config expectations.

## Commit messages style

All commits in this repository must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

Preferred format:

```
<type>(<scope>): <subject>

<body>
```

Examples of `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.

Apply the seven commit-message rules:
1. Separate subject from body with a blank line
2. Limit the subject line to 50 characters
3. Capitalize the subject line
4. Do not end the subject line with a period
5. Use imperative mood in the subject line
6. Wrap the body at 72 characters
7. Explain what and why (not only how)
