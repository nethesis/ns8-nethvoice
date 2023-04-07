# Asterisk

Asterisk container for NethServer 8

## Environment variables

- `ASTMANAGERHOST` is the ip where AMI , Asterisk Manager Interface is exposed. 127.0.0.1 in network=host configuration
- `ASTMANAGERPORT` port of AMI, Asterisk Manager Interface
- `AMPMGRUSER` User automatically configured to access ti AMI
- `AMPMGRPASS` Password of AMI user
- `NETHVOICE_MARIADB_PORT` Port of MariaDB
- `ASTERISK_RTPSTART` and `ASTERISK_RTPEND` are the UDP port range for RTP packages
