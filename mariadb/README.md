# MariaDB

MariaDB container for NethServer 8

## Environment variables

- `MARIADB_ROOT_PASSWORD` root password of MariaDB. Mandatory since it is used to set permissions to other users.
- `NETHVOICE_MARIADB_PORT` port of MariaDB
- `AMPDBUSER` user of asterisk database, used by FreePBX
- `AMPDBPASS` password of asterisk database
- `CDRDBUSER` user of asteriskcdrdb database
- `CDRDBPASS` password of asteriskcdrdb database
- `CTIUSER` user of nethcti3 database
- `NETHCTI_DB_PASSWORD` password of nethcti3 database
- `PHONEBOOK*`
    - `PHONEBOOK_DB_NAME` name of phonebook database
    - `PHONEBOOK_DB_USER` user of phonebook database
    - `PHONEBOOK_DB_PASS` password of phonebook database


- `ASTERISK_RTPSTART` and `ASTERISK_RTPEND` are the UDP port range for RTP packages
- `ICEIGNORE` list of interfaces to ignore. Default is 'vmnet,tap,tun,virb,vb-' https://github.com/meetecho/janus-gateway#configure-and-start
- `STUNSERVER` STUN server. Default is stun1.l.google.com
- `STUNPORT` STUN port. Default is 19302
- `JANUS_DEBUG_LEVEL` Debug/logging level (0=disable debugging, 7=maximum debug level; default=5)

## Default data and users

At first start, database is initialized with tables from docker-entrypoint-initdb.d.
Database created are: asterisk, asteriskcdrdb, nethcti3 and phonebook.

Then the docker-entrypoint-initdb.d/90_users.sh script is executed. The scripts creates users and permissions for the databases.
