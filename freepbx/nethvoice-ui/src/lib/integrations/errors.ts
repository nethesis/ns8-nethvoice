//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import i18n from '@/i18n'
import { isApiError } from '@/lib/api/errors'
import { describeError } from '@/stores/notifications'

export const getLegacyStatusMessage = (error: unknown): string => {
  if (
    !isApiError(error) ||
    error.status >= 500 ||
    typeof error.body !== 'object' ||
    error.body === null
  ) {
    return ''
  }
  const status: unknown = 'status' in error.body ? error.body.status : undefined

  return typeof status === 'string' ? status.trim() : ''
}

const SERVER_MESSAGE_KEYS: Record<string, string> = {
  'Enter the password to connect to a different server':
    'integrations.password_server_changed_error',
  'Invalid customer card preview fields': 'integrations.cards.preview_invalid_fields',
  'The CTI server is not reachable': 'integrations.cti_server_unreachable',
  'Cannot reach the CTI server': 'integrations.cti_server_unreachable',
  'The CTI server cannot show the preview': 'integrations.cards.preview_failed_description',
  'The query cannot be run': 'integrations.cards.preview_failed_description',
  'Database connection not found': 'integrations.cards.connection_not_found',
  'Invalid database connection fields': 'integrations.invalid_fields',
  'Invalid template preview fields': 'integrations.invalid_fields',
  'Invalid customer card filter': 'integrations.invalid_fields',
  'Customer card name already in use': 'integrations.cards.card_name_in_use',
  'Invalid customer card name': 'integrations.cards.card_name_invalid',
  'A database connection with the same server, user and database already exists':
    'integrations.cards.database_connection_duplicate',
  'Built-in templates cannot be deleted': 'integrations.cards.template_built_in_not_deletable',
  'The template is used by customer cards': 'integrations.cards.template_in_use',
  'Bad request: invalid parameters': 'integrations.invalid_fields',
}

const errorBody = (error: unknown): Record<string, unknown> | undefined =>
  isApiError(error) && error.status < 500 && typeof error.body === 'object' && error.body !== null
    ? (error.body as Record<string, unknown>)
    : undefined

export const getServerErrorField = (error: unknown): string => {
  const field = errorBody(error)?.field

  return typeof field === 'string' ? field : ''
}

export const getServerMessageKey = (error: unknown): string => {
  const body = errorBody(error)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (SERVER_MESSAGE_KEYS[message]) {
    return SERVER_MESSAGE_KEYS[message]
  }
  if (/^Missing value: \w+$/.test(message)) {
    return 'integrations.missing_value'
  }
  if (/^Value too long or invalid: \w+$/.test(message)) {
    return 'integrations.cards.database_value_too_long_server'
  }
  return ''
}

export const describeIntegrationError = (error: unknown): string => {
  const key = getServerMessageKey(error)

  return key ? i18n.global.t(key) : getLegacyStatusMessage(error) || describeError(error)
}
