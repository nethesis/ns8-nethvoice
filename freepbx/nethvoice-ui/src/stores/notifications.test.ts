//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeAll, describe, expect, it } from 'vitest'
import * as v from 'valibot'
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

  it('can show a fixed text instead of the message of a server error', () => {
    const options = { serverDetail: false }

    expect(describeError(apiError(503, { message: 'users-admin is unavailable' }), options)).toBe(
      'The server could not complete the request (error 503). Try again later.',
    )
    expect(describeError(apiError(400, { message: 'Bad extension' }), options)).toBe(
      'Bad extension',
    )
  })

  it('hides the technical message of an unexpected response', () => {
    const result = v.safeParse(v.object({ destinations: v.string() }), {})
    const error = result.success ? null : new v.ValiError(result.issues)

    expect(describeError(error)).toBe(
      'The server sent an unexpected response. Reload the page and try again.',
    )
  })

  it('explains an error without message', () => {
    expect(describeError(apiError(500))).toBe(
      'The server could not complete the request (error 500). Try again later.',
    )
  })

  it('hides the HTML page of a server error', () => {
    expect(
      describeError(apiError(500, '<br /><b>Fatal error</b>: Uncaught PDOException: SQLSTATE')),
    ).toBe('The server could not complete the request (error 500). Try again later.')
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
