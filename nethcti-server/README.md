# NethCTI Server

NethCTI Server container for NethServer 8

## Environment variables

- `AMPDBHOST` FreePBX MariaDB database host
- `AMPDBNAME` FreePBX MariaDB database name
- `AMPDBPASS` FreePBX MariaDB database password
- `AMPDBUSER` FreePBX MariaDB database user
- `ASTMANAGERPORT` port of AMI, Asterisk Manager Interface. Default: 5038
- `CDRDBHOST` CDR MariaDB database host
- `CDRDBNAME` CDR MariaDB database name
- `CDRDBPASS` CDR MariaDB database pass
- `CDRDBUSER` CDR MariaDB database user
- `NETHCTI*`
    - `NETHCTI_ALERTS` true|false enable or disable alerts for queues. Default true
    - `NETHCTI_AMI_PASSWORD` password of AMI, Asterisk Manager Interface
    - `NETHCTI_AUTHENTICATION_ENABLED` true|false enable or disable authentication. Default true
    - `NETHCTI_AUTOC` enabled|disabled enable or disable auto click to call
    - `NETHCTI_CDR_SCRIPT` path of the script to execute on outgoing call end
    - `NETHCTI_CDR_SCRIPT_CALL_IN` path of the script to execute on incoming call end
    - `NETHCTI_CDR_SCRIPT_TIMEOUT` timeout of the cdr script execution
    - `NETHCTI_DB_PASSWORD` password of NethCTI database
    - `NETHCTI_DB_USER` user of NethCTI database
    - `NETHCTI_JABBER_DOMAIN` domain of the jabber server
    - `NETHCTI_JABBER_URL` url of the jabber server
    - `NETHCTI_LOG_LEVEL` log level of the server
    - `NETHCTI_PREFIX` telephone prefix
    - `NETHCTI_SERVER_API_PORT` port of the server api
    - `NETHCTI_SERVER_WS_PORT` port of the server websocket
    - `NETHCTI_TRUNKS_EVENTS` enabled|disabled enable or disable trunks events
    - `NETHCTI_UNAUTHE_CALL` enabled|disabled enable or disable unauthenticated call. Default disabled
    - `NETHCTI_UNAUTHE_CALL_IP` ip of which unauthenticated call are allowed (if enabled)
- `NETHVOICE*` 
    - `NETHVOICE_HOST` hostname of the NethVoice server
    - `NETHVOICE_LDAP_BASE` ldap base for users authentication
    - `NETHVOICE_LDAP_PORT` ldap port for users authentication
    - `NETHVOICE_LDAP_SCHEMA` rfc2307|ad ldap schema for users authentication
    - `NETHVOICE_LDAP_USER` ldap user for users authentication
    - `NETHVOICE_MARIADB_PORT` port of NethVoice MariaDB database
- `PHONEBOOK*`
    - `PHONEBOOK_DB_HOST` host of the NethVoice centralized phonebook database
    - `PHONEBOOK_DB_NAME` name of the NethVoice centralized phonebook database
    - `PHONEBOOK_DB_PASS` password of the NethVoice centralized phonebook database
    - `PHONEBOOK_DB_PORT` port of the NethVoice centralized phonebook database
    - `PHONEBOOK_DB_USER` user of the NethVoice centralized phonebook database

You can reload the CTI using:
```
podman exec -ti nethcti-server node nethcti-cli reload
```
