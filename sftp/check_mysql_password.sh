#!/bin/bash
# Source MySQL credentials
source /etc/mysql-auth.conf

# Read password from stdin
read -r PASSWORD

# Calculate SHA1 of input password
INPUT_SHA1=$(echo -n "${PASSWORD}" | sha1sum | awk '{print $1}')

# Get stored SHA1 from database
STORED_SHA1=$(mariadb -h "${AMP_DB_HOST}" -u "${AMP_DB_USER}" -p"${AMP_DB_PASS}" -P"${AMP_DB_PORT}" --database "${AMP_DB_NAME}" -sBN --skip-ssl -e "SELECT password_sha1 FROM ampusers WHERE username = 'admin';" 2>/dev/null)

# Compare hashes
if [ "${INPUT_SHA1}" = "${STORED_SHA1}" ]; then
    exit 0
else
    exit 1
fi
