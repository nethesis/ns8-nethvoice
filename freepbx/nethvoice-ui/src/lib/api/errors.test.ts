//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError, getApiErrorMessage, isApiError, isAuthenticationFailure } from './errors'

describe('getApiErrorMessage', () => {
  it('should read the legacy error field', () => {
    expect(getApiErrorMessage({ error: 'Forbidden: wrong secret key' })).toBe(
      'Forbidden: wrong secret key',
    )
  })

  it('should prefer the envelope message', () => {
    expect(getApiErrorMessage({ code: 422, message: 'validation failed', error: 'x' })).toBe(
      'validation failed',
    )
  })

  it('should return an empty string when the body explains nothing', () => {
    expect(getApiErrorMessage(null)).toBe('')
    expect(getApiErrorMessage({ status: false })).toBe('')
    expect(getApiErrorMessage([])).toBe('')
  })
})

describe('isAuthenticationFailure', () => {
  it('should treat 401 as an authentication failure', () => {
    expect(isAuthenticationFailure(401, null)).toBe(true)
  })

  it('should treat the credential 403 of the REST API as an authentication failure', () => {
    expect(isAuthenticationFailure(403, { error: 'Forbidden: no credentials' })).toBe(true)
    expect(isAuthenticationFailure(403, { error: 'Forbidden: invalid user' })).toBe(true)
    expect(isAuthenticationFailure(403, { error: 'Forbidden: wrong secret key' })).toBe(true)
  })

  it('should leave a business 403 alone', () => {
    expect(isAuthenticationFailure(403, { error: 'license limit reached' })).toBe(false)
    expect(isAuthenticationFailure(403, null)).toBe(false)
  })
})

describe('ApiError', () => {
  it('should expose the request and the message sent by the API', () => {
    const error = new ApiError({
      status: 409,
      method: 'POST',
      url: '/freepbx/rest/users',
      body: { error: 'user already exists' },
    })

    expect(isApiError(error)).toBe(true)
    expect(error.message).toBe('user already exists')
    expect(error.status).toBe(409)
  })

  it('should fall back to the status code', () => {
    const error = new ApiError({ status: 500, method: 'GET', url: '/x', body: null })

    expect(error.message).toBe('Request failed with status code 500')
  })
})
