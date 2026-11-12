#!/bin/bash

while (ps aux | grep -q [f]"wconsole userman.*syncall"); do
    sleep 1
done
sleep 2

if [[ -z "${NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN}" || -z "${NETHVOICE_MIDDLEWARE_PORT}" ]]; then
    exit 0
fi

if ! [[ "${NETHVOICE_MIDDLEWARE_PORT}" =~ ^[0-9]+$ ]]; then
    exit 0
fi

if (( NETHVOICE_MIDDLEWARE_PORT < 1 || NETHVOICE_MIDDLEWARE_PORT > 65535 )); then
    exit 0
fi

# the token is passed to curl on stdin (-K -), never on a command line
printf 'header = "Authorization: Bearer %s"\n' "${NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN}" | curl -fsS \
    --connect-timeout 1 \
    --max-time 2 \
    -X POST \
    -K - \
    -H "Content-Type: application/json" \
    "http://127.0.0.1:${NETHVOICE_MIDDLEWARE_PORT}/admin/reload/profiles" \
    >/dev/null
