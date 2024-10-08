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
