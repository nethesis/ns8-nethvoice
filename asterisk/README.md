# Asterisk

Asterisk container for NethServer 8

## Environment variables

- `ASTMANAGERHOST` is the ip where AMI , Asterisk Manager Interface is exposed. 127.0.0.1 in network=host configuration
- `ASTMANAGERPORT` port of AMI, Asterisk Manager Interface
- `AMPMGRUSER` User automatically configured to access ti AMI
- `AMPMGRPASS` Password of AMI user
- `NETHVOICE_MARIADB_PORT` Port of MariaDB
- `ASTERISK_RTPSTART` and `ASTERISK_RTPEND` are the UDP port range for RTP packages
- `ASTERISK_SIP_PORT` and `ASTERISK_SIPS_PORT` are the UDP and TCP ports for SIP transport
- `ASTERISK_PJSIP_PORT` `ASTERISK_PJSIPS_PORT` are the UDP and TCP ports for PJSIP transport
- `ASTERISK_IAX_PORT is the UDP port for IAX transport
