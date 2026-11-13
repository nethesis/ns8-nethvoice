//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  ApiError,
  getApiErrorDetail,
  getApiErrorMessage,
  isApiError,
  isAuthenticationFailure,
  isServiceUnavailable,
} from './errors'

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
    expect(getApiErrorMessage('')).toBe('')
    expect(getApiErrorMessage({ status: false })).toBe('')
    expect(getApiErrorMessage({ status: 'false', errors: [] })).toBe('')
    expect(getApiErrorMessage([])).toBe('')
  })

  it('should join the errors array of the legacy envelope', () => {
    expect(
      getApiErrorMessage({
        status: false,
        errors: ['Missing gateway field mac', 'Missing gateway field ipv4'],
        warnings: ['Ignored warning'],
        infos: [],
      }),
    ).toBe('Missing gateway field mac; Missing gateway field ipv4')
  })

  it('should not repeat the same error twice', () => {
    expect(
      getApiErrorMessage({ errors: ['Unable to save gateway', 'Unable to save gateway'] }),
    ).toBe('Unable to save gateway')
  })

  it('should read errors sent as a single string', () => {
    expect(
      getApiErrorMessage({ status: false, progress: 40, errors: 'CDR migration failed' }),
    ).toBe('CDR migration failed')
  })

  it('should read errors keyed by field', () => {
    expect(
      getApiErrorMessage({ errors: { mac: 'Invalid MAC address', ports: ['Too many', 'Busy'] } }),
    ).toBe('mac: Invalid MAC address; ports: Too many, Busy')
  })

  it('should read errors sent as objects', () => {
    expect(getApiErrorMessage({ errors: [{ message: 'Invalid MAC address' }, { foo: 1 }] })).toBe(
      'Invalid MAC address',
    )
  })

  it('should read the error of the legacy envelope', () => {
    expect(getApiErrorMessage({ status: false, error: 'Invalid request body' })).toBe(
      'Invalid request body',
    )
  })

  it('should ignore warnings when there are no errors', () => {
    expect(getApiErrorMessage({ status: 'false', warnings: ['No cdr migration active'] })).toBe('')
  })

  it('should read a status used as message', () => {
    expect(getApiErrorMessage({ status: 'ERROR: community version is limited to 8 users' })).toBe(
      'ERROR: community version is limited to 8 users',
    )
  })

  it('should read a result used as message', () => {
    expect(getApiErrorMessage({ result: 'User name or full name invalid' })).toBe(
      'User name or full name invalid',
    )
  })

  it('should prefer the problem title to its numeric status', () => {
    expect(getApiErrorMessage({ type: 'about:blank', title: 'Not Found', status: 404 })).toBe(
      'Not Found',
    )
  })

  it('should read a plain string body', () => {
    expect(getApiErrorMessage('An error occurred')).toBe('An error occurred')
  })

  it('should collapse whitespace and newlines', () => {
    expect(getApiErrorMessage({ status: 'Error creating user e.johnson:\n  users-admin\n' })).toBe(
      'Error creating user e.johnson: users-admin',
    )
  })

  it('should strip markup from an HTML body', () => {
    expect(
      getApiErrorMessage(
        '<!DOCTYPE html><html><head><title>502</title><style>p{}</style></head>' +
          '<body><h1>Proxy Error</h1><p>Invalid response &nbsp;from upstream</p>' +
          '<script>alert(1)</script></body></html>',
      ),
    ).toBe('Proxy Error Invalid response from upstream')
  })

  it('should keep comparison signs that are not markup', () => {
    expect(getApiErrorMessage({ error: 'value must be < 10' })).toBe('value must be < 10')
  })

  it('should truncate long messages', () => {
    const message = getApiErrorMessage('x'.repeat(1000))

    expect(message).toHaveLength(300)
    expect(message.endsWith('…')).toBe(true)
  })
})

describe('getApiErrorDetail', () => {
  const apiError = (status: number, body: unknown) =>
    new ApiError({ status, method: 'POST', url: '/freepbx/rest/trunks', body })

  it('should hide the HTML or PHP dumps of a server error', () => {
    expect(
      getApiErrorDetail(apiError(500, '<br /><b>Fatal error</b>: Uncaught PDOException: SQLSTATE')),
    ).toBe('')
    expect(getApiErrorDetail(apiError(502, 'PHP Fatal error: Uncaught Error in /x.php'))).toBe('')
  })

  it('should hide the body of a proxy or gateway error', () => {
    expect(getApiErrorDetail(apiError(502, 'Bad Gateway'))).toBe('')
    expect(getApiErrorDetail(apiError(503, { message: 'Service Unavailable' }))).toBe('')
    expect(getApiErrorDetail(apiError(504, '<html><body>Gateway Timeout</body></html>'))).toBe('')
  })

  it('should keep the plain and structured messages', () => {
    expect(getApiErrorDetail(apiError(500, 'An error occurred'))).toBe('An error occurred')
    expect(getApiErrorDetail(apiError(500, { error: 'Missing codecs' }))).toBe('Missing codecs')
    expect(getApiErrorDetail(apiError(400, '<b>Wrong value</b>'))).toBe('Wrong value')
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

  it('should fall back to the status code when the envelope has no text', () => {
    const error = new ApiError({
      status: 400,
      method: 'POST',
      url: '/freepbx/rest/devices/gateways',
      body: { status: false, errors: [], warnings: ['ignored'] },
    })

    expect(error.message).toBe('Request failed with status code 400')
  })

  it('should expose the errors array of the legacy envelope', () => {
    const error = new ApiError({
      status: 400,
      method: 'POST',
      url: '/freepbx/rest/devices/gateways',
      body: { status: false, errors: ['Gateway model not found'] },
    })

    expect(error.message).toBe('Gateway model not found')
  })
})

describe('isServiceUnavailable', () => {
  it('should match the proxy and gateway errors only', () => {
    expect([500, 501, 502, 503, 504, 505].map(isServiceUnavailable)).toEqual([
      false,
      false,
      true,
      true,
      true,
      false,
    ])
  })
})
