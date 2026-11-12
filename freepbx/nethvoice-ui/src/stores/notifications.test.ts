//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeAll, describe, expect, it } from 'vitest'
import i18n, { loadLocaleMessages } from '@/i18n'
import { ApiError } from '@/lib/api/errors'
import { describeError, isNetworkError } from './notifications'

const apiError = (status: number, body: unknown = null) =>
  new ApiError({ status, method: 'POST', url: '/freepbx/rest/cti/profiles/4', body })

describe('describeError', () => {
  beforeAll(async () => {
    await loadLocaleMessages('en')
    i18n.global.locale.value = 'en'
  })

  it('shows the server message without the request', () => {
    expect(describeError(apiError(500, { message: 'users-admin is unavailable' }))).toBe(
      'users-admin is unavailable',
    )
  })

  it('explains an error without message', () => {
    expect(describeError(apiError(500))).toBe(
      'The server could not complete the request (error 500). Try again later.',
    )
  })

  it('translates the conflict, validation and lock errors and keeps the server message', () => {
    expect(describeError(apiError(423, { message: 'Another profile change is in progress' }))).toBe(
      'Another change is in progress. Wait a few seconds and try again. Server message: Another profile change is in progress',
    )
    expect(describeError(apiError(409))).toBe(
      'This name or value is already in use. Change it and try again.',
    )
    expect(describeError(apiError(422, { result: 'User name or full name invalid' }))).toContain(
      'Some values are not valid.',
    )
  })

  it('translates the network errors', () => {
    const offline = new TypeError('Failed to fetch')

    expect(isNetworkError(offline)).toBe(true)
    expect(describeError(offline)).toBe(
      'Cannot reach the server. Check the connection and try again.',
    )
    expect(describeError(new Error('boom'))).toBe('boom')
  })
})
