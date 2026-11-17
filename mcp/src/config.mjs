//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']
const WILDCARD_HOSTS = ['0.0.0.0', '::', '[::]']

const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const readUrl = (env, name) => {
  const value = (env[name] ?? '').trim()

  if (!value) {
    return ''
  }

  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} is not a valid URL`)
  }

  if (url.protocol !== 'https:' && !LOOPBACK_HOSTNAMES.includes(url.hostname)) {
    throw new Error(`${name} must use https`)
  }
  return trimTrailingSlash(url.href)
}

const readPositiveInteger = (env, name, fallback) => {
  const raw = (env[name] ?? '').trim()

  if (!raw) {
    return fallback
  }
  const value = Number(raw)

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

const readList = (env, name) =>
  (env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const formatHost = (host) => (host.includes(':') && !host.startsWith('[') ? `[${host}]` : host)

export const defaultAllowedHosts = (host, port) => {
  const formatted = formatHost(host)

  if (WILDCARD_HOSTS.includes(formatted)) {
    return []
  }

  if (LOOPBACK_HOSTNAMES.includes(formatted)) {
    return LOOPBACK_HOSTNAMES.map((name) => `${name}:${port}`)
  }
  return [`${formatted}:${port}`]
}

export const loadConfig = (env = process.env) => {
  const httpHost = (env.NETHVOICE_MCP_HOST ?? '127.0.0.1').trim()
  const httpPort = readPositiveInteger(env, 'NETHVOICE_MCP_PORT', 8765)
  const allowedHosts = readList(env, 'NETHVOICE_MCP_ALLOWED_HOSTS')
  const config = {
    ctiUrl: readUrl(env, 'NETHVOICE_CTI_URL'),
    pbxUrl: readUrl(env, 'NETHVOICE_PBX_URL'),
    ctiUsername: (env.NETHVOICE_CTI_USERNAME ?? '').trim(),
    ctiPassword: env.NETHVOICE_CTI_PASSWORD ?? '',
    ctiToken: (env.NETHVOICE_CTI_TOKEN ?? '').trim(),
    adminUsername: (env.NETHVOICE_ADMIN_USERNAME ?? '').trim(),
    adminPassword: env.NETHVOICE_ADMIN_PASSWORD ?? '',
    enableWrites: env.NETHVOICE_MCP_ENABLE_WRITES === '1',
    httpHost,
    httpPort,
    allowedHosts: allowedHosts.length ? allowedHosts : defaultAllowedHosts(httpHost, httpPort),
    allowedOrigins: readList(env, 'NETHVOICE_MCP_ALLOWED_ORIGINS'),
    timeoutMs: readPositiveInteger(env, 'NETHVOICE_MCP_TIMEOUT_MS', 15000),
  }

  if (!config.ctiUrl && !config.pbxUrl) {
    throw new Error('set NETHVOICE_CTI_URL, NETHVOICE_PBX_URL or both')
  }

  if (config.adminUsername && !config.pbxUrl) {
    throw new Error('NETHVOICE_ADMIN_USERNAME needs NETHVOICE_PBX_URL')
  }
  return config
}

export const hasCtiCredentials = (config) =>
  Boolean(config.ctiUrl && (config.ctiToken || (config.ctiUsername && config.ctiPassword)))

export const hasAdminCredentials = (config) => Boolean(config.pbxUrl && config.adminUsername && config.adminPassword)
