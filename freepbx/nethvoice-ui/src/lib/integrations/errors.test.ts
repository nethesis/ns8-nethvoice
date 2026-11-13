//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { getLegacyStatusMessage } from './errors'

const apiError = (body: unknown) =>
  new ApiError({ status: 400, method: 'POST', url: '/freepbx/rest/phonebook/config', body })

describe('getLegacyStatusMessage', () => {
  it('should read the message of a legacy error body', () => {
    expect(getLegacyStatusMessage(apiError({ status: 'Missing value: host' }))).toBe(
      'Missing value: host',
    )
  })

  it('should ignore a boolean status', () => {
    expect(getLegacyStatusMessage(apiError({ status: false }))).toBe('')
  })

  it('should ignore other errors and bodies', () => {
    expect(getLegacyStatusMessage(apiError(null))).toBe('')
    expect(getLegacyStatusMessage(apiError('plain text'))).toBe('')
    expect(getLegacyStatusMessage(new Error('Missing value: host'))).toBe('')
  })
})
