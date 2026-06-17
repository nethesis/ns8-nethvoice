#!/usr/bin/env sh

set -e

mkdir -p /var/www/html/pbx-report/config
cat > /var/www/html/pbx-report/config/config.production.js <<EOF
window.CONFIG = {
  APP_NAME: "${REPORTS_UI_APP_NAME:-NethVoice Reports}",
  BRAND_NAME: "${REPORTS_UI_BRAND_NAME:-NethVoice Reports}",
  HELP_URL: "${REPORTS_UI_HELP_URL}",
  COMPANY_NAME: "${REPORTS_UI_COMPANY_NAME}",
  LOGIN_LOGO_URL: "${REPORTS_UI_LOGIN_LOGO_URL}",
  FAVICON_URL: "${REPORTS_UI_FAVICON_URL}",
  LOGIN_BACKGROUND_URL: "${REPORTS_UI_LOGIN_BACKGROUND_URL}",
  LOGIN_BACKGROUND_COLOR: "${REPORTS_UI_LOGIN_BACKGROUND_COLOR}",
  API_ENDPOINT: "${NETHVOICE_HOST}/pbx-report-api",
  API_SCHEME: "https://",
};
EOF
