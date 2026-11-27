//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, configureApiClient } from './client'
import { ApiError } from './errors'

vi.mock('@/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config')>()),
  REST_API_URL: 'https://voice.example.org/freepbx/rest',
}))

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('api client', () => {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>()
  const onAuthenticationFailure = vi.fn()
  const onPermissionDenied = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    configureApiClient({
      getCredentials: () => ({ user: 'admin', hash: 'secret-key' }),
      onAuthenticationFailure,
      onPermissionDenied,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    onAuthenticationFailure.mockReset()
    onPermissionDenied.mockReset()
  })

  it('should send the credentials headers on authenticated calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ step: 13, status: 'false' }]))

    await api.GET('/configuration/wizard')

    const request = fetchMock.mock.calls[0][0]
    expect(new URL(request.url).pathname).toBe('/freepbx/rest/configuration/wizard')
    expect(request.headers.get('User')).toBe('admin')
    expect(request.headers.get('Secretkey')).toBe('secret-key')
  })

  it('should not send credentials to the login endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 'shared' }))

    await api.POST('/testauth', { body: { username: 'admin', password: 'pw' } })

    const request = fetchMock.mock.calls[0][0]
    expect(request.headers.get('User')).toBeNull()
    expect(request.headers.get('Secretkey')).toBeNull()
  })

  it('should accept the empty 200 answers of the legacy handlers', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }))

    const { data, error } = await api.POST('/configuration/wizard', {
      body: { step: 1, status: 'true' },
    })

    expect(data).toBeUndefined()
    expect(error).toBeUndefined()
  })

  it('should throw an ApiError carrying the message of the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'An error occurred' }, 500))

    const failure = await api.GET('/configuration/wizard').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({
      status: 500,
      method: 'GET',
      url: '/freepbx/rest/configuration/wizard',
      message: 'An error occurred',
    })
    expect(onAuthenticationFailure).not.toHaveBeenCalled()
  })

  it('should report rejected credentials to the session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Forbidden: wrong secret key' }, 403))

    await expect(api.GET('/configuration/wizard')).rejects.toBeInstanceOf(ApiError)
    expect(onAuthenticationFailure).toHaveBeenCalledOnce()
  })

  it('should report a refused section call without ending the session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Forbidden: missing permission' }, 403))

    await expect(api.GET('/configuration/wizard')).rejects.toMatchObject({ status: 403 })
    expect(onPermissionDenied).toHaveBeenCalledOnce()
    expect(onAuthenticationFailure).not.toHaveBeenCalled()
  })

  it('should not report the rejected credentials nor the permissions call as a refused section', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Forbidden: wrong secret key' }, 403))
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, 403))
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))

    await expect(api.GET('/configuration/wizard')).rejects.toBeInstanceOf(ApiError)
    await expect(api.GET('/me')).rejects.toBeInstanceOf(ApiError)
    await expect(api.GET('/configuration/wizard')).rejects.toBeInstanceOf(ApiError)
    expect(onPermissionDenied).not.toHaveBeenCalled()
  })

  it('should not end the session on a failed login', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))

    await expect(
      api.POST('/testauth', { body: { username: 'admin', password: 'wrong' } }),
    ).rejects.toMatchObject({ status: 401 })
    expect(onAuthenticationFailure).not.toHaveBeenCalled()
  })
})
