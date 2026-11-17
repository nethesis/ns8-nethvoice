//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { z } from 'zod'
import { limitList, sanitize } from './redact.mjs'

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const pick = (source, keys) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]))

const pickFilled = (source, keys) =>
  Object.fromEntries(Object.entries(pick(source, keys)).filter(([, value]) => value !== '' && value !== null))

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const unexpected = (source, expected) => new Error(`unexpected response from ${source}: expected ${expected}`)

export const expectArray = (value, source) => {
  if (!Array.isArray(value)) {
    throw unexpected(source, 'a list')
  }
  return value
}

export const expectRecord = (value, source) => {
  if (!isRecord(value)) {
    throw unexpected(source, 'an object')
  }
  return value
}

const values = (record, source) => Object.values(expectRecord(record, source))

const listOrEmpty = (value) => (Array.isArray(value) ? value : [])

const isCount = (value) => Number.isInteger(value) && value >= 0

export const summarizeExtension = (extension) => ({
  ...pick(extension, ['exten', 'name', 'status', 'dnd', 'cf', 'username', 'context']),
  online: extension?.status !== 'offline',
  inConversation: Object.keys(extension?.conversations ?? {}).length > 0,
})

export const summarizeTrunk = (trunk) => ({
  ...pick(trunk, ['name', 'exten', 'status', 'registration', 'chanType', 'maxChannels']),
  activeCalls: Object.keys(trunk?.conversations ?? {}).length,
})

export const summarizeQueue = (queue) => {
  const members = isRecord(queue?.members) ? Object.values(queue.members) : []

  return {
    ...pick(queue, ['queue', 'name', 'avgHoldTime', 'avgTalkTime', 'completedCallsCount', 'abandonedCallsCount']),
    waitingCallers: Object.keys(queue?.waitingCallers ?? {}).length,
    members: members.length,
    loggedInMembers: members.filter((member) => member?.loggedIn).length,
    pausedMembers: members.filter((member) => member?.paused).length,
  }
}

export const summarizeContact = (contact) =>
  pickFilled(contact, [
    'id',
    'name',
    'company',
    'title',
    'type',
    'workphone',
    'cellphone',
    'homephone',
    'extension',
    'workemail',
    'homeemail',
    'speeddial_num',
  ])

export const summarizeUser = (user) => ({
  username: user?.username,
  displayName: user?.displayname,
  mainExtension: user?.default_extension && user.default_extension !== 'none' ? user.default_extension : null,
  profileId: user?.profile ?? null,
  devices: listOrEmpty(user?.devices).map((device) => ({
    type: device?.type,
    extension: device?.extension,
    model: device?.model ?? null,
  })),
})

export const summarizeProfile = (me) => ({
  ...pick(me, ['name', 'username', 'mainPresence', 'presence', 'presenceOnBusy', 'presenceOnUnavailable']),
  profile: me?.profile ? pick(me.profile, ['id', 'name']) : null,
  mainExtension: me?.endpoints?.mainextension?.[0]?.id ?? null,
  extensions: listOrEmpty(me?.endpoints?.extension).map((extension) => ({
    id: extension?.id,
    type: typeof extension?.type === 'string' && extension.type ? extension.type : null,
  })),
})

const summarizeOutboundRoute = (route) => ({
  id: route?.route_id,
  name: route?.name,
  trunks: listOrEmpty(route?.trunks).map((trunk) => trunk?.name),
})

export const summarizeTodayCalls = (summary, source) => {
  const calls = expectRecord(summary, source)
  const byHour = expectArray(calls.calls_by_hour, source)

  if (!['total', 'answered', 'missed', 'invalid'].every((key) => isCount(calls[key])) || !byHour.every(isCount)) {
    throw unexpected(source, 'call counters')
  }

  return {
    total: calls.total,
    answered: calls.answered,
    missed: calls.missed,
    invalid: calls.invalid,
    callsByHour: byHour.map((count, hour) => ({ hour, calls: count })),
  }
}

const OVERVIEW_SOURCES = [
  ['users', '/users/count', (value) => value],
  ['trunks', '/trunks/count', (value) => value],
  ['inboundRoutes', '/inboundroutes/count', (value) => value],
  ['outboundRoutes', '/outboundroutes/count', (value) => value],
  ['userProvider', '/configuration/userprovider', (value) => pick(value, ['configured', 'type', 'local', 'domain'])],
  ['userLimits', '/mainextensions/userlimits', (value) => pick(value, ['configured', 'limit', 'configurable'])],
  [
    'setupWizardCompleted',
    '/configuration/wizard',
    (value) => (Array.isArray(value) && value[0] ? String(value[0].status) !== 'true' : false),
  ],
]

const ctiReadTools = (cti) => [
  {
    name: 'get_my_profile',
    title: 'My profile and presence',
    description:
      'Profile of the signed-in NethVoice user: name, presence (online, dnd, callforward, voicemail, cellphone), CTI profile and extensions.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async (_args, { signal }) => summarizeProfile(await cti.get('/user/me', { signal })),
  },
  {
    name: 'list_extensions_status',
    title: 'Extensions status',
    description:
      'Registration and call state of the PBX extensions. Optionally filter by a text contained in the name or number, or return only extensions that are online.',
    inputSchema: {
      search: z.string().max(64).optional().describe('Text contained in the extension name or number'),
      onlyOnline: z.boolean().optional().describe('Return only registered extensions'),
      limit: z.number().int().min(1).max(200).optional().describe('Maximum number of rows, default 50'),
    },
    annotations: READ_ONLY,
    handler: async ({ search = '', onlyOnline = false, limit = 50 }, { signal }) => {
      const needle = search.trim().toLowerCase()
      const extensions = values(await cti.get('/astproxy/extensions', { signal }), 'GET /api/astproxy/extensions')
        .map(summarizeExtension)
        .filter((extension) => !onlyOnline || extension.online)
        .filter(
          (extension) =>
            !needle ||
            String(extension.exten ?? '').includes(needle) ||
            String(extension.name ?? '').toLowerCase().includes(needle),
        )

      return limitList(extensions, limit)
    },
  },
  {
    name: 'get_trunks_status',
    title: 'Trunks status',
    description: 'Status and registration of the PBX trunks, with the number of calls in progress on each.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async (_args, { signal }) => ({
      trunks: values(await cti.get('/astproxy/trunks', { signal }), 'GET /api/astproxy/trunks').map(summarizeTrunk),
    }),
  },
  {
    name: 'get_queues_status',
    title: 'Queues status',
    description: 'Call queues with waiting callers, logged-in and paused agents and call statistics.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async (_args, { signal }) => ({
      queues: values(await cti.get('/astproxy/queues', { signal }), 'GET /api/astproxy/queues').map(summarizeQueue),
    }),
  },
  {
    name: 'search_contacts',
    title: 'Search the phonebook',
    description: 'Search the centralized and personal phonebook by name, company or number.',
    inputSchema: {
      term: z.string().min(2).max(64).describe('Text to search for'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum number of contacts, default 10'),
    },
    annotations: READ_ONLY,
    handler: async ({ term, limit = 10 }, { signal }) => {
      const query = new URLSearchParams({ view: 'all', limit: String(limit), offset: '0' })
      const source = 'GET /api/phonebook/search'
      const path = `/phonebook/search/${encodeURIComponent(term)}?${query}`
      const result = expectRecord(await cti.get(path, { signal }), source)
      const rows = result.rows === undefined || result.rows === null ? [] : expectArray(result.rows, source)

      return {
        total: isCount(result.count) ? result.count : rows.length,
        contacts: rows.map(summarizeContact),
      }
    },
  },
]

const ctiWriteTools = (cti) => [
  {
    name: 'set_my_presence',
    title: 'Set my presence',
    description:
      'Change the presence of the signed-in user: online, dnd (do not disturb), voicemail, cellphone, or callforward to a number. It changes how incoming calls are handled until it is changed again.',
    inputSchema: {
      status: z.enum(['online', 'dnd', 'voicemail', 'cellphone', 'callforward']),
      to: z
        .string()
        .regex(/^[0-9+*#]{1,32}$/)
        .optional()
        .describe('Destination number, required when status is callforward'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: async ({ status, to }, { signal }) => {
      if (status === 'callforward' && !to) {
        throw new Error('"to" is required when status is callforward')
      }
      await cti.post('/user/presence', status === 'callforward' ? { status, to } : { status }, { signal })

      return { presence: status, ...(status === 'callforward' ? { to } : {}) }
    },
  },
]

const adminReadTools = (pbx) => [
  {
    name: 'get_system_overview',
    section: 'lookup',
    title: 'PBX configuration overview',
    description:
      'Administrator view of the PBX configuration: number of users, trunks, inbound and outbound routes, user provider, licence limits and whether the first configuration wizard is complete. Fields the administrator cannot read are null and listed in "unavailable".',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async (_args, { signal }) => {
      const results = await Promise.allSettled(OVERVIEW_SOURCES.map(([, path]) => pbx.get(path, { signal })))

      if (results.every((result) => result.status === 'rejected')) {
        throw results[0].reason
      }
      const overview = {}
      const unavailable = {}

      OVERVIEW_SOURCES.forEach(([field, , shape], index) => {
        const result = results[index]

        if (result.status === 'fulfilled') {
          overview[field] = shape(result.value)
          return
        }
        overview[field] = null
        unavailable[field] = result.reason instanceof Error ? result.reason.message : String(result.reason)
      })

      return Object.keys(unavailable).length ? { ...overview, unavailable } : overview
    },
  },
  {
    name: 'list_users',
    section: 'lookup',
    title: 'PBX users',
    description:
      'Administrator list of PBX users with main extension, CTI profile id and device types. Credentials are never returned.',
    inputSchema: {
      search: z.string().max(64).optional().describe('Text contained in the username, name or extension'),
      limit: z.number().int().min(1).max(200).optional().describe('Maximum number of rows, default 50'),
    },
    annotations: READ_ONLY,
    handler: async ({ search = '', limit = 50 }, { signal }) => {
      const needle = search.trim().toLowerCase()
      const users = expectArray(await pbx.get('/users/all', { signal }), 'GET /freepbx/rest/users/all')
        .map(summarizeUser)
        .filter(
          (user) =>
            !needle ||
            [user.username, user.displayName, user.mainExtension].some((value) =>
              String(value ?? '').toLowerCase().includes(needle),
            ),
        )

      return limitList(users, limit)
    },
  },
  {
    name: 'list_outbound_routes',
    section: 'lookup',
    title: 'Outbound routes',
    description: 'Administrator list of outbound routes with their trunks in priority order.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async (_args, { signal }) => ({
      routes: expectArray(await pbx.get('/outboundroutes', { signal }), 'GET /freepbx/rest/outboundroutes').map(
        summarizeOutboundRoute,
      ),
    }),
  },
  {
    name: 'get_today_calls',
    section: 'dashboard',
    title: 'Calls of today',
    description:
      'Calls handled by the PBX since midnight: total, answered, missed, invalid and calls per hour of the day (hour 0 is 00:00-00:59). Calls of the administrator phone and feature codes are not counted.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async (_args, { signal }) =>
      summarizeTodayCalls(await pbx.get('/dashboard/calls', { signal }), 'GET /freepbx/rest/dashboard/calls'),
  },
]

export const isAdminToolAllowed = (section, permissions = []) =>
  permissions.length > 0 &&
  (section === 'lookup' || permissions.includes('superadmin') || permissions.includes(section))

const withBackend = (backend) => (tool) => ({ ...tool, backend })

export const buildTools = ({ cti, pbx, enableWrites = false, adminPermissions = [] }) => [
  ...(cti ? ctiReadTools(cti).map(withBackend('cti')) : []),
  ...(cti && enableWrites ? ctiWriteTools(cti).map(withBackend('cti')) : []),
  ...(pbx
    ? adminReadTools(pbx)
        .filter((tool) => isAdminToolAllowed(tool.section, adminPermissions))
        .map(withBackend('pbx'))
    : []),
]

export const runTool = async (tool, args, context = {}) => sanitize(await tool.handler(args ?? {}, context))
