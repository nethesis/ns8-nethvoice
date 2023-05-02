#!/usr/bin/env sh

set -e

# if it's nginx, configure app and wait for api container
if [ "$1" = "nginx" ]; then
  mkdir -p /var/www/html/pbx-report/config

  cat > /var/www/html/pbx-report/config/config.production.js <<EOF
window.CONFIG = {
  APP_NAME: "${REPORTS_UI_APP_NAME}",
  HELP_URL: "${REPORTS_UI_HELP_URL}",
  COMPANY_NAME: "${REPORTS_UI_COMPANY_NAME}",
  API_ENDPOINT: "${NETHVOICE_HOST}/pbx-report-api",
  API_SCHEME: "https://",
};
EOF

  wait-for -t 30 "${APP_HOST?:APP_HOST missing}:${APP_PORT?:APP_PORT missing}"
fi
