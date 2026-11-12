//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { z } from 'zod'
import { limitList, sanitize } from './redact.mjs'

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const pick = (source, keys) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]))

const pickFilled = (source, keys) =>
  Object.fromEntries(Object.entries(pick(source, keys)).filter(([, value]) => value !== '' && value !== null))

const values = (record) => (record && typeof record === 'object' ? Object.values(record) : [])

const DEVICE_TYPE_BY_PREFIX = { 91: 'mobile', 92: 'nethlink', 93: 'physical' }

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
  const members = values(queue?.members)

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
  mainExtension: user?.default_extension ?? null,
  profileId: user?.profile ?? null,
  devices: (user?.devices ?? []).map((device) => ({
    type: device?.type,
    extension: device?.extension,
    model: device?.model ?? null,
  })),
})

export const summarizeProfile = (me) => ({
  ...pick(me, ['name', 'username', 'mainPresence', 'presence', 'presenceOnBusy', 'presenceOnUnavailable']),
  profile: me?.profile ? pick(me.profile, ['id', 'name']) : null,
  mainExtension: me?.endpoints?.mainextension?.[0]?.id ?? null,
  extensions: (me?.endpoints?.extension ?? []).map((extension) => ({
    id: extension?.id,
    type: extension?.type ?? DEVICE_TYPE_BY_PREFIX[String(extension?.id ?? '').slice(0, 2)] ?? null,
  })),
})

const summarizeOutboundRoute = (route) => ({
  id: route?.route_id,
  name: route?.name,
  trunks: (route?.trunks ?? []).map((trunk) => trunk?.name),
})

const ctiReadTools = (cti) => [
  {
    name: 'get_my_profile',
    title: 'My profile and presence',
    description:
      'Profile of the signed-in NethVoice user: name, presence (online, dnd, callforward, voicemail, cellphone), CTI profile and extensions.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async () => summarizeProfile(await cti.get('/user/me')),
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
    handler: async ({ search = '', onlyOnline = false, limit = 50 }) => {
      const needle = search.trim().toLowerCase()
      const extensions = values(await cti.get('/astproxy/extensions'))
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
    handler: async () => ({ trunks: values(await cti.get('/astproxy/trunks')).map(summarizeTrunk) }),
  },
  {
    name: 'get_queues_status',
    title: 'Queues status',
    description: 'Call queues with waiting callers, logged-in and paused agents and call statistics.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async () => ({ queues: values(await cti.get('/astproxy/queues')).map(summarizeQueue) }),
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
    handler: async ({ term, limit = 10 }) => {
      const query = new URLSearchParams({ view: 'all', limit: String(limit), offset: '0' })
      const result = await cti.get(`/phonebook/search/${encodeURIComponent(term)}?${query}`)

      return {
        total: result?.count ?? 0,
        contacts: (result?.rows ?? []).map(summarizeContact),
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
    handler: async ({ status, to }) => {
      if (status === 'callforward' && !to) {
        throw new Error('"to" is required when status is callforward')
      }
      await cti.post('/user/presence', status === 'callforward' ? { status, to } : { status })

      return { presence: status, ...(status === 'callforward' ? { to } : {}) }
    },
  },
]

const adminReadTools = (pbx) => [
  {
    name: 'get_system_overview',
    title: 'PBX configuration overview',
    description:
      'Administrator view of the PBX configuration: number of users, trunks, inbound and outbound routes, user provider, licence limits and whether the first configuration wizard is complete.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async () => {
      const [users, trunks, inboundRoutes, outboundRoutes, provider, limits, wizard] = await Promise.all([
        pbx.get('/users/count'),
        pbx.get('/trunks/count'),
        pbx.get('/inboundroutes/count'),
        pbx.get('/outboundroutes/count'),
        pbx.get('/configuration/userprovider'),
        pbx.get('/mainextensions/userlimits'),
        pbx.get('/configuration/wizard'),
      ])
      const wizardRow = Array.isArray(wizard) ? wizard[0] : undefined

      return {
        users,
        trunks,
        inboundRoutes,
        outboundRoutes,
        userProvider: pick(provider, ['configured', 'type', 'local', 'domain']),
        userLimits: pick(limits, ['configured', 'limit', 'configurable']),
        setupWizardCompleted: wizardRow ? String(wizardRow.status) !== 'true' : false,
      }
    },
  },
  {
    name: 'list_users',
    title: 'PBX users',
    description:
      'Administrator list of PBX users with main extension, CTI profile id and device types. Credentials are never returned.',
    inputSchema: {
      search: z.string().max(64).optional().describe('Text contained in the username, name or extension'),
      limit: z.number().int().min(1).max(200).optional().describe('Maximum number of rows, default 50'),
    },
    annotations: READ_ONLY,
    handler: async ({ search = '', limit = 50 }) => {
      const needle = search.trim().toLowerCase()
      const users = (await pbx.get('/users/true'))
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
    title: 'Outbound routes',
    description: 'Administrator list of outbound routes with their trunks in priority order.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: async () => ({ routes: (await pbx.get('/outboundroutes')).map(summarizeOutboundRoute) }),
  },
]

export const buildTools = ({ cti, pbx, enableWrites = false }) => [
  ...(cti ? ctiReadTools(cti) : []),
  ...(cti && enableWrites ? ctiWriteTools(cti) : []),
  ...(pbx ? adminReadTools(pbx) : []),
]

export const runTool = async (tool, args) => sanitize(await tool.handler(args ?? {}))
