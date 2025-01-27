#!/bin/bash

# change sshd port with env variable ASTERISK_RECORDING_SFTP_PORT
sed -i "s/Port .*/Port ${ASTERISK_RECORDING_SFTP_PORT}/" /etc/ssh/sshd_config

# Check if host keys exist; if not, generate them
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    echo "SSH host keys not found, generating..."
    ssh-keygen -A
fi

# Create MySQL credentials file
cat > /etc/mysql-auth.conf <<EOF
AMP_DB_USER="${AMPDBUSER:-freepbxuser}"
AMP_DB_PASS="${AMPDBPASS}"
AMP_DB_HOST="${AMPDBHOST:-127.0.0.1}"
AMP_DB_NAME="${AMPDBNAME:-asterisk}"
AMP_DB_PORT="${NETHVOICE_MARIADB_PORT:-3306}"
EOF

# Set proper permissions
chmod 600 /etc/mysql-auth.conf

/usr/sbin/sshd.pam -D -e
