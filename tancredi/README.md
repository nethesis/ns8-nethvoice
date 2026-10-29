# Tancredi

Tancredi container for NethServer 8


Tancredi code repository are https://github.com/nethesis/tancredi and https://github.com/nethesis/nethserver-tancredi/

## Multipart request filtering

Apache rejects multipart requests before PHP executes, except for `POST` to
`/tancredi/api/v1/backgrounds`, `/tancredi/api/v1/firmware`,
`/tancredi/api/v1/ringtones`, and `/tancredi/api/v1/screensavers`.
The exceptions preserve the existing authenticated asset uploads. Provisioning
downloads and JSON API requests keep their existing behavior.

This limits where multipart parsing can be reached; it does not protect the
allowed upload endpoints from a PHP parser vulnerability. Session upload
progress remains disabled. Rebuild and deploy the Tancredi image to apply the
filter, and install a patched PHP runtime when available.

## Environment variables

- `AMPDBPASS` password of asterisk database
- `AMPDBUSER` user of asterisk database
- `NETHVOICE_HOST` hostname of NethVoice server devices will connect to
- `NETHVOICE_MARIADB_PORT` port of MariaDB
- `NETHVOICESECRETKEY` secret key used by NethVoice UI to authenticate with Tancredi
- `TANCREDI_STATIC_TOKEN` static token used by NethCTI to authenticate with Tancredi
- `PHONEBOOK_LDAP_PORT` port of  the LDAP server used by phonebook, the host is the same as NethVoice host
- `PHONEBOOK_LDAP_USER` user of the LDAP server used by phonebook
- `PHONEBOOK_LDAP_PASS` password for the LDAP server used by phonebook
- `TANCREDI_LOG_LEVEL` verbosity of the Tancredi application log: `WARNING` (default), `ERROR`, `INFO` or `DEBUG`. At `DEBUG` every provisioning and API request is logged with its request and response body. Only these four uppercase values are understood, anything else is read as `DEBUG`

## LLDP provisioning

The **LLDP** selector is available under **Network** in global provisioning
defaults, model settings, and individual phone settings. Values inherit from
global defaults through the model to the phone. Selecting `-` in a model or
phone selector removes that override and restores inheritance. Changes apply
on the phone's next provisioning request.

New phones enable LLDP on supported templates, both on fresh installations and
after upgrading an existing installation. Phones already configured at upgrade
keep the behavior of their previous templates:

| Existing phone family | LLDP after upgrade |
| --- | --- |
| Yealink, Snom, Gigaset P-series, Akuvox | Disabled |
| Fanvil, NethPhone, Sangoma | Enabled |

Migration `016-custom.php` sets an existing installation's missing default to
enabled and adds compatibility overrides to existing phones where needed.
Models without explicit administrator settings inherit the enabled default,
so phones added after the upgrade enable LLDP. This also handles copied custom
models and phones with a different provisioning template. Existing explicit
global, model, and phone settings are preserved and take precedence over the
new default. Administrators can change or remove individual overrides afterward;
restarting or upgrading NethVoice does not reapply the compatibility values.

Gigaset Maxwell and templates without LLDP support do not expose this control.
The scope variable is `lldp_enable`, with string values `"1"` (enabled) and
`"0"` (disabled). A missing or invalid resolved value uses the old default for
that template family shown in the table above; removing a scope override instead
inherits its parent's value. Existing custom template files must implement the
variable to respond to the selector.

The migration completion marker is defaults metadata version `16`, also shipped
by the new Tancredi defaults. Fresh installations skip the compatibility
migration. Failed migrations prevent the provisioning service from starting and
can be retried; the completion marker is saved only after all scope updates.

### LLDP regression checks

With the matching Tancredi source and its Composer dependencies available:

```bash
TANCREDI_ROOT=/path/to/tancredi php tests/unit/test_tancredi_lldp.php
node tests/unit/test_lldp_ui.cjs
```

Run these commands from the NethVoice repository root. Tancredi's
`./test/run.sh` additionally checks provisioning output for every supported
LLDP template variant. The `Provisioning checks` CI workflow runs the UI,
migration, and template rendering checks against the same verified Tancredi
release used by the Containerfile.

After building the Tancredi container, check its actual entrypoint with:

```bash
bash tests/unit/test_tancredi_startup.sh localhost/nethvoice-tancredi:lldp-8167
```

The Containerfile pins Tancredi 1.11.0, which includes the LLDP templates and
version 16 defaults. The release archive is verified against
`remote-artifacts.sha256`.
