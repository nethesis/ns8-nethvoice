# SFTP container for NethServer 8

This container provides SFTP access to the shared volumes. To connect, use the username `asterisk` with the same password as the NethVoice interface. Alternatively, you can enable key-based authentication by adding an `authorized_keys` file in the volume mounted at `/etc/ssh`

On NethVoice, systemd unit file is provided. To enable it automatically, launch `systemctl --user enable --now sftp` 

## Environment variables

- `AMPDBUSER` FreePBX MariaDB database user (default: freepbxuser)
- `AMPDBPASS` FreePBX MariaDB database password
- `AMPDBHOST` FreePBX MariaDB database host (default: 127.0.0.1)
- `AMPDBNAME` FreePBX MariaDB database name (default: asterisk)
- `NETHVOICE_MARIADB_PORT` Port of MariaDB
- `ASTERISK_RECORDING_SFTP_PORT` Port where sftp service will be reachable

## Access volumes

Shared volumes are:

- `sounds` - All asterisk system sounds, recordings and announcements
- `moh` - Hold music
- `spool` - All Asterisk spool directories (with call recordings under `spool/monitor`)

To access sftp server, connect using sftp on port `$ASTERISK_RECORDING_SFTP_PORT` using the user `asterisk` and the NethVoice admin password.
By default sftp access is only enabled from the same machine, to access from the outside, you have to open the port on firewall:

example: ASTERISK_RECORDING_SFTP_PORT=20033, nethvoice instace is 1
```
firewall-cmd --permanent --service=nethvoice1 --add-port=20033/tcp
firewall-cmd --reload
```

sample scp command:
```
scp -r -P 20033 asterisk@HOST:spool/monitor ./
```