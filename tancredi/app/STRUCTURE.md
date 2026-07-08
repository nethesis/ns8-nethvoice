# STRUCTURE.md

## Top-level tree summary

* `.github/workflows/` — CI for Bats E2E, PHP/Twig/INI lint, SBOM/security scan.
* `data/` — shipped read-only provisioning dataset: scopes, patterns, templates, writable-overlay directories, asset directories.
* `docs/` — Jekyll documentation site plus variable metadata tables.
* `public/` — HTTP entrypoints (`api-v1.php`, `provisioning.php`).
* `scripts/` — upgrade runner and numbered migrations.
* `src/` — runtime PHP classes.
* `test/` — Bats suite, helpers, golden fixtures.
* `vendor/` — committed Composer dependencies snapshot.
* Root files: `composer.json`, `composer.lock`, `tancredi.conf.sample`, `README.md`, `.gitignore`, `renovate.json`.

## Directory-by-directory purpose

### `.github/workflows/`

* `bats.yml`: installs Apache/PHP/Bats, assembles deployed layout, writes `/etc/tancredi.conf`, configures aliases, runs `test/run.sh`, uploads fixtures on failure/always.
* `php.yml`: validation/lint workflow for Composer, PHP, Twig, and INI files.
* `scans.yml`: Trivy SARIF + CycloneDX SBOM on push/release.

### `data/`

* `patterns.d/`: vendor/request regex bindings (`akuvox.ini`, `fanvil.ini`, `gigaset.ini`, `nethesis.ini`, `sangoma.ini`, `snom.ini`, `variables.ini`, `yealink.ini`).
* `scopes/`: shipped scope inventory; contains `defaults.ini` plus many model `.ini` files for Akuvox, Fanvil, Gigaset, Nethesis, Sangoma, Snom, Yealink.
* `templates/`: Twig templates/macros for each vendor family plus shared helpers (`fallback.tmpl`, `variables.tmpl`, `*.macros`).
* `templates-custom/`: writable override layer; repo ships only `.gitignore`.
* `backgrounds/`, `firmware/`, `ringtones/`, `screensavers/`, `first_access_tokens/`, `tokens/`: writable runtime directories; packaged deployments may also ship read-only assets in the corresponding `ro_dir` paths.

### `docs/`

* Page set includes `API.md`, `auth.md`, `installation.md`, `paths.md`, `problems.md`, `templates.md`, `variables.md`, plus `_data/linekeys.tsv`, `_data/softkeys.tsv`, `_data/variables.tsv`.
* `_config.yml` and `Gemfile` define a Just-the-Docs/Jekyll site.

### `public/`

* `api-v1.php`: administrative API entrypoint.
* `provisioning.php`: provisioning/rendering entrypoint.

### `scripts/`

* `upgrade.php`: migration dispatcher.
* `upgrade.d/001.php` … `013.php`: ordered data fixes/version bumps.

### `src/`

* `LoggerFactory.php`, `LoggingMiddleware.php`, `init.php`.
