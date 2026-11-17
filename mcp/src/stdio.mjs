//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { hasAdminCredentials, hasCtiCredentials } from './config.mjs'
import { CtiClient } from './ctiClient.mjs'
import { PbxClient } from './pbxClient.mjs'
import { describeError } from './server.mjs'

const readAdmin = (me) => {
  const permissions = Array.isArray(me?.permissions) ? me.permissions.filter((item) => typeof item === 'string') : []

  if (typeof me?.username !== 'string' || !me.username || !permissions.length) {
    throw new Error('unexpected response from GET /freepbx/rest/me: expected a username and its sections')
  }
  return { username: me.username, permissions }
}

const resolveCtiIdentity = async (cti, config, log) => {
  if (config.ctiUsername) {
    return config.ctiUsername
  }

  try {
    const me = await cti.get('/user/me')

    if (typeof me?.username === 'string' && me.username) {
      return me.username
    }
    log('nethvoice-mcp: GET /api/user/me returned no username')
  } catch (error) {
    log(`nethvoice-mcp: cannot read the CTI user: ${describeError(error)}`)
  }
  return ''
}

export const prepareStdio = async ({ config, fetch, log = () => {} }) => {
  const cti = hasCtiCredentials(config)
    ? new CtiClient({
        baseUrl: config.ctiUrl,
        username: config.ctiUsername,
        password: config.ctiPassword,
        token: config.ctiToken,
        timeoutMs: config.timeoutMs,
        fetch,
      })
    : undefined
  let pbx = hasAdminCredentials(config)
    ? new PbxClient({
        baseUrl: config.pbxUrl,
        username: config.adminUsername,
        password: config.adminPassword,
        timeoutMs: config.timeoutMs,
        fetch,
      })
    : undefined

  if (!cti && !pbx) {
    throw new Error('no credentials: set NETHVOICE_CTI_* for user tools or NETHVOICE_ADMIN_* for admin tools')
  }
  const identities = {}
  let adminPermissions = []

  if (pbx) {
    try {
      const admin = readAdmin(await pbx.get('/me'))

      identities.pbx = admin.username
      adminPermissions = admin.permissions
    } catch (error) {
      if (!cti) {
        throw new Error(`cannot read the administrator permissions: ${describeError(error)}`)
      }
      log(`nethvoice-mcp: admin tools disabled, cannot read the administrator permissions: ${describeError(error)}`)
      pbx = undefined
    }
  }

  if (cti) {
    identities.cti = await resolveCtiIdentity(cti, config, log)
  }
  return { cti, pbx, identities, adminPermissions }
}
