//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { parseRetryAfter, parseSignInResult, postSignIn, toSignInError } from './auth'

vi.mock('@/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config')>()),
  REST_API_URL: 'https://voice.example.org/freepbx/rest',
}))

const apiError = (status: number, body: unknown = null) =>
  new ApiError({ status, method: 'POST', url: '/freepbx/rest/signin', body })

describe('parseSignInResult', () => {
  it('keeps the known permissions only', () => {
    expect(
      parseSignInResult({
        user: 'a.miller',
        secretkey: 'b'.repeat(40),
        permissions: ['users', 'unknown', 'phones'],
        source: 'domain',
      }),
    ).toEqual({
      user: 'a.miller',
      secretkey: 'b'.repeat(40),
      permissions: ['users', 'phones'],
      source: 'domain',
    })
  })

  it('rejects an answer without the key', () => {
    expect(() =>
      parseSignInResult({ user: 'admin', secretkey: '', permissions: [], source: 'local' }),
    ).toThrow()
    expect(() => parseSignInResult({ result: 'shared-secret' })).toThrow()
  })
})

describe('toSignInError', () => {
  it('maps each answer of the server', () => {
    const failure = (error: unknown, retryAfter: string | null = null) =>
      toSignInError(error, retryAfter).failure

    expect(failure(apiError(401, { code: 'invalid_credentials' }))).toBe('invalid_credentials')
    expect(failure(apiError(403, { code: 'password_expired' }))).toBe('password_expired')
    expect(failure(apiError(403, { code: 'account_conflict' }))).toBe('account_conflict')
    expect(failure(apiError(403, 'Forbidden'))).toBe('generic')
    expect(failure(apiError(429, { code: 'too_many_attempts' }))).toBe('too_many_attempts')
    expect(failure(apiError(503, { code: 'domain_unavailable' }))).toBe('domain_unavailable')
    expect(failure(apiError(503, { code: 'throttle_unavailable' }))).toBe('throttle_unavailable')
    expect(failure(apiError(503, null))).toBe('domain_unavailable')
    expect(failure(apiError(400, { code: 'invalid_request' }))).toBe('generic')
    expect(failure(apiError(500))).toBe('generic')
    expect(failure(new TypeError('Failed to fetch'))).toBe('generic')
  })

  it('reads the wait time of too many attempts', () => {
    expect(toSignInError(apiError(429), '120').retryAfter).toBe(120)
    expect(toSignInError(apiError(429), null).retryAfter).toBeNull()
    expect(toSignInError(apiError(401), '120').retryAfter).toBeNull()
  })
})

describe('parseRetryAfter', () => {
  it('reads seconds or a date', () => {
    const now = Date.parse('2026-11-23T10:00:00Z')

    expect(parseRetryAfter('300', now)).toBe(300)
    expect(parseRetryAfter('Mon, 23 Nov 2026 10:01:30 GMT', now)).toBe(90)
    expect(parseRetryAfter('Mon, 23 Nov 2026 09:59:00 GMT', now)).toBe(0)
    expect(parseRetryAfter('soon', now)).toBeNull()
    expect(parseRetryAfter('', now)).toBeNull()
    expect(parseRetryAfter(null, now)).toBeNull()
  })
})

describe('postSignIn', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the credentials and returns the key', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            user: 'admin',
            secretkey: 'c'.repeat(40),
            permissions: ['superadmin'],
            source: 'local',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(postSignIn('admin', 'Password,1')).resolves.toMatchObject({
      user: 'admin',
      secretkey: 'c'.repeat(40),
    })

    const request = (fetchMock.mock.calls[0] as unknown as [Request])[0]
    expect(new URL(request.url).pathname).toBe('/freepbx/rest/signin')
    expect(request.method).toBe('POST')
    expect(await request.json()).toEqual({ username: 'admin', password: 'Password,1' })
  })

  it('passes the wait time of the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'too_many_attempts' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '240' },
          }),
      ),
    )

    await expect(postSignIn('admin', 'wrong')).rejects.toMatchObject({
      failure: 'too_many_attempts',
      retryAfter: 240,
    })
  })
})
