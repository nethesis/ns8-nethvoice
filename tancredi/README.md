# Tancredi

Tancredi container for NethServer 8


Tancredi code repository are https://github.com/nethesis/tancredi and https://github.com/nethesis/nethserver-tancredi/

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

## LLDP provisioning

The **LLDP** selector is available under **Network** in global provisioning
defaults, model settings, and individual phone settings. Values inherit from
global defaults through the model to the phone. Selecting `-` in a model or
phone selector removes that override and restores inheritance. Changes apply
on the phone's next provisioning request.

Fresh installations enable LLDP on supported phones. Existing installations
keep the behavior of their previous templates:

| Phone family | LLDP after upgrade |
| --- | --- |
| Yealink, Snom, Gigaset P-series, Akuvox | Disabled |
| Fanvil, NethPhone, Sangoma | Enabled |

Migration `016-custom.php` sets an existing installation's missing default to
disabled and preserves enabled families through model overrides. It also
handles copied custom models and phones with a different provisioning template.
Existing explicit values are preserved. Phones added after the upgrade inherit
these migrated defaults and model settings. Administrators can change the
global default or individual overrides afterward; restarting or upgrading
NethVoice does not reapply the compatibility values.

Gigaset Maxwell and templates without LLDP support do not expose this control.
The scope variable is `lldp_enable`, with string values `"1"` (enabled) and
`"0"` (disabled). A missing or blank resolved variable omits LLDP settings from
the rendered configuration; removing a scope override instead inherits its
parent's value. Existing custom template files must implement the variable to
respond to the selector.

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
LLDP template variant.

After building the Tancredi container, check its actual entrypoint with:

```bash
bash tests/unit/test_tancredi_startup.sh localhost/nethvoice-tancredi:lldp-8167
```

The Containerfile pins the LLDP Tancredi commit for pull request testing.
Replace `TANCREDI_VERSION` with the release tag once the containing Tancredi
release is available; the archive URL supports both commit hashes and tags.
