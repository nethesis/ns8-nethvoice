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
