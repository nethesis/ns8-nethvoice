#!/usr/bin/env node
//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { createServer as createHttpServer } from 'node:http'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { hasAdminCredentials, hasCtiCredentials, loadConfig } from './config.mjs'
import { CtiClient } from './ctiClient.mjs'
import { PbxClient } from './pbxClient.mjs'
import { createServer } from './server.mjs'

const MAX_BODY_BYTES = 1024 * 1024

const log = (message) => process.stderr.write(`${message}\n`)

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

const runStdio = async (config) => {
  const cti = hasCtiCredentials(config)
    ? new CtiClient({
        baseUrl: config.ctiUrl,
        username: config.ctiUsername,
        password: config.ctiPassword,
        token: config.ctiToken,
        timeoutMs: config.timeoutMs,
      })
    : undefined
  const pbx = hasAdminCredentials(config)
    ? new PbxClient({
        baseUrl: config.pbxUrl,
        username: config.adminUsername,
        password: config.adminPassword,
        timeoutMs: config.timeoutMs,
      })
    : undefined

  if (!cti && !pbx) {
    throw new Error('no credentials: set NETHVOICE_CTI_* for user tools or NETHVOICE_ADMIN_* for admin tools')
  }
  const { server, toolNames } = createServer({
    cti,
    pbx,
    enableWrites: config.enableWrites,
    identity: config.ctiUsername || config.adminUsername,
  })

  await server.connect(new StdioServerTransport())
  log(`nethvoice-mcp ready on stdio with tools: ${toolNames.join(', ')}`)
}

const runHttp = async (config) => {
  if (!config.ctiUrl) {
    throw new Error('NETHVOICE_CTI_URL is required in HTTP mode')
  }

  const httpServer = createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (url.pathname !== '/mcp') {
      sendJson(response, 404, { error: 'not found' })
      return
    }

    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'method not allowed' }, { Allow: 'POST' })
      return
    }
    const token = /^Bearer (.+)$/i.exec(request.headers.authorization ?? '')?.[1]?.trim()

    if (!token) {
      sendJson(response, 401, { error: 'missing bearer token' }, { 'WWW-Authenticate': 'Bearer' })
      return
    }

    try {
      const body = JSON.parse(await readBody(request))
      const cti = new CtiClient({ baseUrl: config.ctiUrl, token, timeoutMs: config.timeoutMs })
      const { server } = createServer({ cti, enableWrites: config.enableWrites, identity: 'bearer' })
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

      response.on('close', () => {
        transport.close()
        server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(request, response, body)
    } catch (error) {
      log(`request failed: ${error instanceof Error ? error.message : String(error)}`)

      if (!response.headersSent) {
        sendJson(response, 400, { error: 'bad request' })
      }
    }
  })

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(config.httpPort, config.httpHost, resolve)
  })
  log(`nethvoice-mcp ready on http://${config.httpHost}:${config.httpPort}/mcp`)
}

try {
  const config = loadConfig()

  if (process.argv.includes('--http')) {
    await runHttp(config)
  } else {
    await runStdio(config)
  }
} catch (error) {
  log(`nethvoice-mcp: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
