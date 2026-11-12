//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { MockApi } from '../fixtures/mockApi'

export const REST = '/freepbx/rest'
export const TANCREDI = '/tancredi/api/v1'

export const PHONE_MAC = '00-15-65-AB-CD-01'
export const FREE_PHONE_MAC = '0C-38-3E-00-00-02'

const device = (id: number, type: string, extension: string, extra: object = {}) => ({
  id,
  user_id: null,
  mac: null,
  vendor: null,
  model: null,
  line: null,
  extension,
  secret: 'invented-sip-secret',
  web_user: null,
  web_password: null,
  type,
  srtp: null,
  registered: false,
  ...extra,
})

export const RAW_USERS = [
  {
    id: '11',
    username: 'a.miller',
    displayname: 'Anna Miller',
    default_extension: '300',
    email: '',
    password: null,
    profile: 2,
    devices: [
      device(1, 'webrtc', '300'),
      device(2, 'physical', '91300', {
        mac: '00:15:65:AB:CD:01',
        vendor: 'Yealink',
        model: 'yealink-T46',
        line: 1,
      }),
    ],
  },
  {
    id: '12',
    username: 'c.davis',
    displayname: 'Christopher Davis',
    default_extension: '301',
    email: '',
    password: null,
    profile: 1,
    devices: [device(3, 'webrtc', '301'), device(4, 'nethlink', '91301')],
  },
  {
    id: '13',
    username: 'd.jones',
    displayname: 'Daniel Jones',
    default_extension: 'none',
    email: '',
    password: null,
    profile: null,
    devices: [],
  },
]

export const GROUPS = [
  { id: 1, name: 'Sales' },
  { id: 2, name: 'Support' },
  { id: 3, name: 'Backoffice' },
]

export const GROUP_MEMBERS: Record<string, number[]> = {
  '1': [11, 12],
  '2': [12],
  '3': [12],
}

const rawProfile = (id: number, name: string) => ({
  id,
  name,
  macro_permissions: {},
  outbound_routes_permissions: [],
})

export const PROFILES = [
  rawProfile(1, 'Base'),
  rawProfile(2, 'Standard'),
  rawProfile(3, 'Advanced'),
]

export const TANCREDI_PHONES = [
  { mac: PHONE_MAC, model: 'yealink-T46', display_name: 'Yealink' },
  { mac: FREE_PHONE_MAC, model: 'fanvil-X4U', display_name: 'Fanvil' },
]

type UsersApiOptions = {
  users?: unknown
  usersStatus?: number
}

export const mockUsersApi = (mockApi: MockApi, options: UsersApiOptions = {}) =>
  mockApi
    .on('GET', `${REST}/users/sync`, { json: false })
    .on('POST', `${REST}/users/sync`, { status: 200 })
    .on('GET', `${REST}/users/:all`, {
      status: options.usersStatus ?? 200,
      json: options.users ?? RAW_USERS,
    })
    .on('GET', `${REST}/cti/groups`, { json: GROUPS })
    .on('GET', `${REST}/cti/users/groups/:id`, (request) => ({
      json: (GROUP_MEMBERS[request.path.split('/').pop() ?? ''] ?? []).map((userId) => ({
        user_id: userId,
        name: 'group',
      })),
    }))
    .on('GET', `${REST}/cti/profiles`, { json: PROFILES })
    .on('GET', `${REST}/voicemails`, { json: { '300': { name: 'Anna Miller' } } })
    .on('GET', `${REST}/mobiles`, {
      json: [
        { username: 'a.miller', mobile: '3331234567' },
        { username: 'c.davis', mobile: null },
      ],
    })
    .on('GET', `${REST}/mainextensions/userlimits`, {
      json: { configured: 2, limit: false, configurable: false },
    })

export const mockUserPhonesApi = (mockApi: MockApi) =>
  mockApi
    .on('GET', `${TANCREDI}/phones`, { json: TANCREDI_PHONES })
    .on('GET', `${TANCREDI}/models`, {
      json: [
        { name: 'yealink-T46', display_name: 'Yealink T46', model_url: '' },
        { name: 'fanvil-X4U', display_name: 'Fanvil X4U', model_url: '' },
      ],
    })
    .on('GET', `${TANCREDI}/defaults`, { json: { adminpw: 'invented-admin-pw' } })

export const mockWrites = (mockApi: MockApi) =>
  mockApi
    .on('POST', `${REST}/mainextensions`, { status: 201 })
    .on('POST', `${REST}/mobiles`, { status: 200 })
    .on('POST', `${REST}/voicemails`, { json: { status: true } })
    .on('POST', `${REST}/cti/profiles/users/:id`, { json: { status: true } })
    .on('POST', `${REST}/cti/groups/users/:id`, { status: 200 })
    .on('POST', `${REST}/webrtc`, { json: { extension: '9x', mobile_extension: null } })
    .on('DELETE', `${REST}/webrtc/:ext`, { status: 200 })
    .on('POST', `${REST}/nethlink`, { json: { extension: '9x', mobile_extension: null } })
    .on('DELETE', `${REST}/nethlink/:ext`, { status: 200 })
    .on('POST', `${REST}/mobileapp`, { status: 201, json: { extension: '9x' } })
    .on('DELETE', `${REST}/mobileapp/:ext`, { status: 204 })
    .on('POST', `${REST}/bulk/:exts`, { json: { status: true } })

export const csvImportMock = (mockApi: MockApi, finalStatus: { status: number; json: unknown }) => {
  let polls = 0

  return mockApi
    .on('POST', `${REST}/csv/csvimport`, { status: 200 })
    .on('GET', `${REST}/csv/csvimport`, () => {
      polls += 1
      return polls === 1 ? { json: { result: 50 } } : finalStatus
    })
}
