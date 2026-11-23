---
nav_order: 1
---

# Installation

Tancredi requires a PHP 8.1+ web stack. The current application uses Slim 4,
Slim PSR-7, PHP-DI, Twig 3 and Monolog 3.

Apache or Nginx with PHP-FPM are typical deployment choices.

1. Clone the repository:

```bash
git clone https://github.com/nethesis/tancredi.git
cd tancredi
```

1. Install PHP dependencies with Composer:

```bash
composer install
```

1. Create the configuration file.

Tancredi reads its configuration from the path in the `tancredi_conf`
environment variable, or `/etc/tancredi.conf` if the variable is not set.
Start from [tancredi.conf.sample](../tancredi.conf.sample):

```bash
cp tancredi.conf.sample /etc/tancredi.conf
```

Review at least these settings:

- `rw_dir`: writable runtime data directory.
- `ro_dir`: read-only shipped data directory.
- `provisioning_url_path`: provisioning base path, usually `/provisioning/`.
- `api_url_path`: administrative API base path, usually `/tancredi/api/v1/`.
- `file_reader`: static-file delivery mode for protected assets.
- `upstream_proxies`: trusted reverse proxies for client IP logging.
- `auth_class`: optional administrative API authentication middleware.

If `file_reader` is set to `apache` or `nginx`, also configure the web server
to allow protected asset delivery from both `rw_dir/{backgrounds,firmware,
ringtones,screensavers}/` and `ro_dir/{backgrounds,firmware,ringtones,
screensavers}/`. Otherwise packaged assets served from `ro_dir/` can fail with
`403` or `404` even when the file exists.

1. Set up write access permissions on the writable directories under `rw_dir`.

These directories are always used by the application:

- `first_access_tokens/`
- `scopes/`
- `templates-custom/`
- `tokens/`

If you use the asset upload API, these directories must be writable too:

- `backgrounds/`
- `firmware/`
- `ringtones/`
- `screensavers/`

Example for an Apache deployment where the web server group is `apache`:

```bash
chown -R root:apache data/{backgrounds,firmware,first_access_tokens,ringtones,scopes,screensavers,templates-custom,tokens}
chmod g+w data/{backgrounds,firmware,first_access_tokens,ringtones,scopes,screensavers,templates-custom,tokens}
```

1. If you configure `logfile`, create its parent directory and grant write
       access to the web server user or group.

```bash
mkdir -p /var/log/tancredi
chown -R root:apache /var/log/tancredi
chmod g+w /var/log/tancredi
```

1. Configure the HTTP server to map the public entrypoints to the configured
       URL prefixes. A typical setup is:

```text
https://host.fqdn/provisioning/ => public/provisioning.php
https://host.fqdn/tancredi/api/v1/ => public/api-v1.php
```

1. Verify the provisioning entrypoint.

The health check endpoint is served by `public/provisioning.php` at
`/check/ping` under `provisioning_url_path`. It returns the configuration
file modification time as JSON.

