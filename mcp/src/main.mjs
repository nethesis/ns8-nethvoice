#!/usr/bin/env node
//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { createServer as createHttpServer } from 'node:http'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.mjs'
import { createHttpHandler } from './http.mjs'
import { createServer, describeError } from './server.mjs'
import { prepareStdio } from './stdio.mjs'

const log = (message) => process.stderr.write(`${message}\n`)

const runStdio = async (config) => {
  const { cti, pbx, identities, adminPermissions } = await prepareStdio({ config, log })
  const { server, toolNames } = createServer({
    cti,
    pbx,
    enableWrites: config.enableWrites,
    adminPermissions,
    identities,
    timeoutMs: config.timeoutMs,
  })

  await server.connect(new StdioServerTransport())
  log(`nethvoice-mcp ready on stdio with tools: ${toolNames.join(', ')}`)
}

const runHttp = async (config) => {
  if (!config.ctiUrl) {
    throw new Error('NETHVOICE_CTI_URL is required in HTTP mode')
  }

  if (!config.allowedHosts.length) {
    throw new Error('set NETHVOICE_MCP_ALLOWED_HOSTS when listening on every interface')
  }
  const httpServer = createHttpServer(createHttpHandler({ config, log }))

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(config.httpPort, config.httpHost, resolve)
  })
  log(
    `nethvoice-mcp ready on http://${config.httpHost}:${config.httpPort}/mcp, allowed hosts: ${config.allowedHosts.join(', ')}`,
  )
}

try {
  const config = loadConfig()

  if (process.argv.includes('--http')) {
    await runHttp(config)
  } else {
    await runStdio(config)
  }
} catch (error) {
  log(`nethvoice-mcp: ${describeError(error)}`)
  process.exit(1)
}
