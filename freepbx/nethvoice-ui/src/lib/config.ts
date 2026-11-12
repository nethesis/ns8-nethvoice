//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const PRODUCT_NAME = 'NethVoice'

export const APP_BASE_PATH = import.meta.env.BASE_URL

export const REST_API_URL = '/freepbx/rest'

export const CTI_API_URL = '/api'

export const TANCREDI_API_URL = '/tancredi/api/v1'

export const LEGACY_WIZARD_URL = '/'

export const FREEPBX_ADMIN_URL = '/freepbx/admin/'

export const VISUAL_PLAN_URL = '/freepbx/visualplan'

export const OUTBOUND_ROUTE_ADVANCED_URL = '/freepbx/admin/config.php?display=routing&view=form&id='

export const OUTBOUND_ROUTES_ADVANCED_URL = '/freepbx/admin/config.php?display=routing'

export const RUNTIME_CONFIG_URL = `${APP_BASE_PATH}config.json`

export const CREDENTIALS_STORAGE_KEY = 'secretkey'

export const IS_E2E = import.meta.env.VITE_E2E === 'true'
