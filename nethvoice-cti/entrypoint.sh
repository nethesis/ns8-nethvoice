#!/bin/sh

#
# Copyright (C) 2024 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-2.0-only
#

cat > /app/public/config/config.production.js<<EOF
window.CONFIG = {
  BRAND_NAME: '${BRAND_NAME:=NethVoice}',
  PRODUCT_NAME: '${PRODUCT_NAME:=NethVoice CTI}',
  COMPANY_NAME: '${COMPANY_NAME:=Nethesis}',
  COMPANY_SUBNAME: '${COMPANY_SUBNAME:=CTI}',
  COMPANY_URL: '${COMPANY_URL:=https://www.nethesis.it/}',
  NUMERIC_TIMEZONE: '$(date +'%z')',
  TIMEZONE: '${TIMEZONE:=UTC}',
EOF

if [ -z $VOICE_ENDPOINT ]; then
	cat >> /app/public/config/config.production.js<<EOF
  VOICE_ENDPOINT:
    window.location.hostname +
    (window.location.port ? ':' + window.location.port : '') +
    window.location.pathname,
EOF
else
	cat >> /app/public/config/config.production.js<<EOF
  VOICE_ENDPOINT: '$VOICE_ENDPOINT',
EOF
fi

if [ -z $API_ENDPOINT ]; then
	cat >> /app/public/config/config.production.js<<EOF
  API_ENDPOINT:
    window.location.hostname +
    (window.location.port ? ':' + window.location.port : '') +
    window.location.pathname,
EOF
else
	cat >> /app/public/config/config.production.js<<EOF
  API_ENDPOINT: '$API_ENDPOINT',
EOF
fi

if [ -z $API_SCHEME ]; then
	cat >> /app/public/config/config.production.js<<EOF
  API_SCHEME: window.location.protocol + '//',
EOF
else
	cat >> /app/public/config/config.production.js<<EOF
  API_SCHEME: '$API_SCHEME',
EOF
fi

if [ -z $WS_ENDPOINT ]; then
	cat >> /app/public/config/config.production.js<<EOF
  WS_ENDPOINT:
    'wss://' +
    window.location.hostname +
    (window.location.port ? ':' + window.location.port : '') +
    window.location.pathname +
    'ws',
EOF
else
	cat >> /app/public/config/config.production.js<<EOF
  WS_ENDPOINT: '$WS_ENDPOINT',
EOF
fi

cat >> /app/public/config/config.production.js<<EOF
  SIP_HOST: '${SIP_HOST:-127.0.0.1}',
EOF

cat >> /app/public/config/config.production.js<<EOF
  SIP_PORT: '${SIP_PORT:-5060}',
EOF

#login people icon rebrandind ( show or hide string )
cat >> /app/public/config/config.production.js<<EOF
  LOGIN_PEOPLE: '${LOGIN_PEOPLE:-show}',
EOF

cat >> /app/public/config/config.production.js<<EOF
  FAVICON_URL: '${FAVICON_URL:-}',
  NAVBAR_LOGO_URL: '${NAVBAR_LOGO_URL:-}',
  NAVBAR_LOGO_DARK_URL: '${NAVBAR_LOGO_DARK_URL:-}',
EOF


cat >> /app/public/config/config.production.js<<EOF
}

EOF



if [ ! -z $NAVBAR_LOGO_URL ]; then
  # navbar logo rebranding
  /usr/bin/wget --timeout=60 $NAVBAR_LOGO_URL -O /app/public/navbar_logo.svg
fi

if [ ! -z $NAVBAR_LOGO_DARK_URL ]; then
  # navbar logo rebranding
  /usr/bin/wget --timeout=60 $NAVBAR_LOGO_DARK_URL -O /app/public/navbar_logo_dark.svg
fi

if [ ! -z $LOGIN_LOGO_URL ]; then
  # login logo rebranding
  /usr/bin/wget --timeout=60 $LOGIN_LOGO_URL -O /app/public/login_logo.svg
fi

if [ ! -z $LOGIN_LOGO_DARK_URL ]; then
  # login logo rebranding
  /usr/bin/wget --timeout=60 $LOGIN_LOGO_DARK_URL -O /app/public/login_logo_dark.svg
fi

if [ ! -z $FAVICON_URL ]; then
  # favicon rebranding
  /usr/bin/wget --timeout=60 $FAVICON_URL -O /app/public/favicon.ico
fi

if [ ! -z $LOGIN_BACKGROUND_URL ]; then
  # login background image rebranding
  /usr/bin/wget --timeout=60 $LOGIN_BACKGROUND_URL -O /app/public/login_background.svg
fi

exec "$@"
