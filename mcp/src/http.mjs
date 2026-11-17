//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CtiClient } from './ctiClient.mjs'
import { UpstreamError } from './httpError.mjs'
import { createServer, describeError } from './server.mjs'

const MAX_BODY_BYTES = 1024 * 1024
export const TOKEN_CACHE_MS = 60_000
const TOKEN_CACHE_SIZE = 1000

export class InvalidTokenError extends Error {
  constructor(message = 'invalid token') {
    super(message)
    this.name = 'InvalidTokenError'
  }
}

const hashToken = (token) => createHash('sha256').update(token, 'utf8').digest('hex')

export const createTokenValidator = ({ ctiUrl, timeoutMs, fetch, ttlMs = TOKEN_CACHE_MS, now = Date.now }) => {
  const cache = new Map()
  const pending = new Map()

  const prune = () => {
    const time = now()

    for (const [key, entry] of cache) {
      if (entry.expiresAt <= time) {
        cache.delete(key)
      }
    }

    while (cache.size >= TOKEN_CACHE_SIZE) {
      cache.delete(cache.keys().next().value)
    }
  }

  const lookup = async (token, key) => {
    let me

    try {
      me = await new CtiClient({ baseUrl: ctiUrl, token, timeoutMs, fetch }).get('/user/me')
    } catch (error) {
      if (error instanceof UpstreamError && (error.status === 401 || error.status === 403)) {
        throw new InvalidTokenError()
      }
      throw error
    }

    if (typeof me?.username !== 'string' || !me.username) {
      throw new InvalidTokenError('the token does not identify a user')
    }
    prune()
    cache.set(key, { username: me.username, expiresAt: now() + ttlMs })
    return me.username
  }

  return async (token) => {
    const key = hashToken(token)
    const cached = cache.get(key)

    if (cached && cached.expiresAt > now()) {
      return cached.username
    }
    cache.delete(key)

    if (!pending.has(key)) {
      pending.set(
        key,
        lookup(token, key).finally(() => pending.delete(key)),
      )
    }
    return pending.get(key)
  }
}

export const checkRequestHeaders = (headers, { allowedHosts = [], allowedOrigins = [] }) => {
  const host = headers.host ?? ''

  if (!allowedHosts.includes(host)) {
    return `host ${host || '(none)'} is not allowed`
  }
  const origin = headers.origin

  if (origin !== undefined && !allowedOrigins.includes(origin)) {
    return `origin ${origin} is not allowed`
  }
  return ''
}

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length

      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })

const sendJson = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  response.end(JSON.stringify(body))
}

export const createHttpHandler = ({ config, fetch, log = () => {}, audit, validateToken }) => {
  const validate = validateToken ?? createTokenValidator({ ctiUrl: config.ctiUrl, timeoutMs: config.timeoutMs, fetch })

  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (url.pathname !== '/mcp') {
      sendJson(response, 404, { error: 'not found' })
      return
    }

    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'method not allowed' }, { Allow: 'POST' })
      return
    }
    const rejected = checkRequestHeaders(request.headers, config)

    if (rejected) {
      log(`nethvoice-mcp: request rejected, ${rejected}`)
      sendJson(response, 403, { error: 'forbidden' })
      return
    }
    const token = /^Bearer (.+)$/i.exec(request.headers.authorization ?? '')?.[1]?.trim()

    if (!token) {
      sendJson(response, 401, { error: 'missing bearer token' }, { 'WWW-Authenticate': 'Bearer' })
      return
    }
    let username

    try {
      username = await validate(token)
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        log('nethvoice-mcp: request rejected, invalid bearer token')
        sendJson(
          response,
          401,
          { error: 'invalid token' },
          { 'WWW-Authenticate': 'Bearer error="invalid_token", error_description="The token is invalid or expired"' },
        )
        return
      }
      log(`nethvoice-mcp: cannot validate the bearer token: ${describeError(error)}`)
      sendJson(response, 502, { error: 'NethVoice CTI is not reachable' })
      return
    }

    try {
      const body = JSON.parse(await readBody(request))
      const cti = new CtiClient({ baseUrl: config.ctiUrl, token, timeoutMs: config.timeoutMs, fetch })
      const { server } = createServer({
        cti,
        enableWrites: config.enableWrites,
        identities: { cti: username },
        timeoutMs: config.timeoutMs,
        ...(audit ? { audit } : {}),
      })
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableDnsRebindingProtection: true,
        allowedHosts: config.allowedHosts,
        ...(config.allowedOrigins.length ? { allowedOrigins: config.allowedOrigins } : {}),
      })

      response.on('close', () => {
        transport.close()
        server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(request, response, body)
    } catch (error) {
      log(`nethvoice-mcp: request failed: ${describeError(error)}`)

      if (!response.headersSent) {
        sendJson(response, 400, { error: 'bad request' })
      }
    }
  }
}
