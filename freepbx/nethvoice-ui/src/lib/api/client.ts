//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'
import { REST_API_URL } from '@/lib/config'
import { ApiError, isAuthenticationFailure } from './errors'

export type Credentials = { user: string; hash: string }

type ClientHooks = {
  getCredentials: () => Credentials | null
  onAuthenticationFailure: () => void
}

let hooks: ClientHooks = {
  getCredentials: () => null,
  onAuthenticationFailure: () => undefined,
}

export const configureApiClient = (clientHooks: ClientHooks) => {
  hooks = clientHooks
}

const UNAUTHENTICATED_PATHS = ['/testauth']

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const authMiddleware: Middleware = {
  onRequest({ request, schemaPath }) {
    if (UNAUTHENTICATED_PATHS.includes(schemaPath)) {
      return request
    }

    const credentials = hooks.getCredentials()

    if (credentials) {
      request.headers.set('User', credentials.user)
      request.headers.set('Secretkey', credentials.hash)
    }
    return request
  },

  async onResponse({ request, response, schemaPath }) {
    if (response.ok) {
      if (response.status === 204 || response.status === 205) {
        return response
      }
      const text = await response.clone().text()

      return text.trim()
        ? response
        : new Response(null, {
            status: 204,
            statusText: response.statusText,
            headers: response.headers,
          })
    }

    const body = await readBody(response.clone())

    if (
      !UNAUTHENTICATED_PATHS.includes(schemaPath) &&
      isAuthenticationFailure(response.status, body)
    ) {
      hooks.onAuthenticationFailure()
    }

    throw new ApiError({
      status: response.status,
      method: request.method,
      url: new URL(request.url).pathname,
      body,
    })
  },
}

export const api = createClient<paths>({
  baseUrl: REST_API_URL,
  headers: { Accept: 'application/json' },
  fetch: (request) => globalThis.fetch(request),
})

api.use(authMiddleware)
