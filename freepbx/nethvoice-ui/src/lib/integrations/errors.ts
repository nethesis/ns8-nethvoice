//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { isApiError } from '@/lib/api/errors'

export const getLegacyStatusMessage = (error: unknown): string => {
  if (!isApiError(error) || typeof error.body !== 'object' || error.body === null) {
    return ''
  }
  const status: unknown = 'status' in error.body ? error.body.status : undefined

  return typeof status === 'string' ? status.trim() : ''
}
