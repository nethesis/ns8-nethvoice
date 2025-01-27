# FreePBX container

FreePBX container for NethServer 8

## Environment variables

- `APACHE_RUN_USER` user Apache is run with (Asterisk)
- `APACHE_RUN_GROUP` group Apache is run with (Asterisk)
- `ASTMANAGERHOST` is the ip where AMI , Asterisk Manager Interface is exposed. 127.0.0.1 in network=host configuration
- `ASTMANAGERPORT` port of AMI, Asterisk Manager Interface
- `AMPMGRUSER` User automatically configured to access ti AMI
- `AMPMGRPASS` Password of AMI user
- `AMPDBUSER` FreePBX MariaDB database user (default: freepbxuser)
- `AMPDBPASS` FreePBX MariaDB database password
- `AMPDBHOST` FreePBX MariaDB database host (default: 127.0.0.1)
- `AMPDBNAME` FreePBX MariaDB database name (default: asterisk)
- `CDRDBUSER` CDR MariaDB database user (default: freepbxuser)
- `CDRDBPASS` CDR MariaDB database pass
- `NETHCTI*`
    - `NETHCTI_DB_USER` NethCTI MariaDB database user (default: nethcti3)
    - `NETHCTI_DB_PASSWORD` NethCTI MariaDB database password
    - `NETHCTI_AMI_PASSWORD` NethCTI AMI password 
- `NETHVOICE_MARIADB_PORT` port of MariaDB phonebook database
- `PHONEBOOK_DB_NAME` name of phonebook database
- `PHONEBOOK_DB_USER` user of phonebook database
- `PHONEBOOK_DB_PASS` password of phonebook database
- `PHONEBOOK_DB_HOST` host of phonebook database
- `PHONEBOOK_LDAP_LIMIT` limit of LDAP results. Default is 500
- `PHONEBOOK_LDAP_PORT` port of LDAP server
- `PHONEBOOK_LDAP_USER` user of LDAP server
- `PHONEBOOK_LDAP_PASS` password of LDAP server
- `PROXY_IP` sip proxy host or ip to be used in extensions. Default is host
- `PROXY_PORT` sip proxy port. Default is 5060
- `APACHE_PORT` Port used for httpd
- `TANCREDIPORT` Port used bt Tancredi
- `BRAND_NAME` Name for branding (default: NethVoice)
- `BRAND_SITE` Site or branding (default: https://www.nethesis.it/soluzioni/nethvoice)
- `BRAND_DOCS` Site or documentation (default: ?)
- `SUBSCRIPTION_SYSTEMID` my.nethesis.it server SystemID
- `SUBSCRIPTION_SECRET` my.nethesis.it server secret

## User base Environments
- `NETHVOICE_LDAP_PASS` Ldap password of user base
- `NETHVOICE_LDAP_SCHEMA` [ad|rfc2307] luser base schema
- `NETHVOICE_LDAP_BASE` ldap base
- `NETHVOICE_LDAP_PORT` ldap port
- `NETHVOICE_LDAP_USER` ldap username in the format od user@domain or basedn
- `NETHVOICE_LDAP_HOST` ldap host

If userbase is customized in FreePBX userman module, "Directory Name" in FreePBX directory configuration should be "NethServer8 [custom]" and it won't be overwritten

## Asterisk Environment variables

- `ASTMANAGERHOST` is the ip where AMI , Asterisk Manager Interface is exposed. 127.0.0.1 in network=host configuration
- `ASTMANAGERPORT` port of AMI, Asterisk Manager Interface
- `AMPMGRUSER` User automatically configured to access ti AMI
- `AMPMGRPASS` Password of AMI user
- `NETHVOICE_MARIADB_PORT` Port of MariaDB
- `ASTERISK_RTPSTART` and `ASTERISK_RTPEND` are the UDP port range for RTP packages
- `ASTERISK_SIP_PORT` and `ASTERISK_SIPS_PORT` are the UDP and TCP ports for SIP transport
- `ASTERISK_IAX_PORT` is the UDP port for IAX transport

## Voicemail SMTP smarthost

NethVoice send voicemail emails using s-nail. Smarthost is configured with following environment variables:

- `SMTP_ENABLED` Is SMTP smarthost enabled. If not, s-nail is left unconfigured: [1 | ""]
- `SMTP_HOST` smarthost host "smtp.example.com"
- `SMTP_PORT` smarthost port
- `SMTP_USERNAME` smarthost username"foo@example.com"
- `SMTP_PASSWORD` smarthost password "My43Cr3t"
- `SMTP_ENCRYPTION` smarthost encryption type ["starttls"|"tls"]
- `SMTP_TLSVERIFY` verify smarthost certificate: [1 | ""]

## Trunks without proxy

By default, at container startup, trunks are configured to use the outbound proxy. But sometimes it's necessary to configure a different proxy or none. In this case, make sure that trunk name contains the string "custom". For instance, a trunk named "Foo", will have proxy overwritten at container startup, a trunk named "Foo_custom" will be left unchanged.

## FreePBX custom modules

To install a FreePBX custom module, place it's .tar.gz in the folder `/home/nethvoiceX/.config/state/freepbx_custom_modules/` and restart FreePBX
Its filename must be the name of the module .tar.gz. For instance, for installing the apicall module:

```
 runagent -m nethvoiceX
 curl -L https://github.com/Stell0/apicall-freepbx/archive/refs/heads/main.tar.gz -o ./freepbx_custom_modules/apicall.tar.gz
 systemctl --user restart freepbx
 ```
 The module will be reinstalled into container again at every restart of container

# Asterisk

Asterisk container merged with FreePBX
