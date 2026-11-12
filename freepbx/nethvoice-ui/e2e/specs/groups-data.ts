//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

const device = (id: number, type: string, extension: string, vendor = '', model = '') => ({
  id,
  user_id: id,
  mac: null,
  vendor: vendor || null,
  model: model || null,
  line: null,
  extension,
  type,
  registered: false,
})

const pbxUser = (
  id: number,
  username: string,
  displayname: string,
  extension: string,
  profile: number | null,
  devices: ReturnType<typeof device>[] = [],
) => ({
  id: String(id),
  username,
  displayname,
  default_extension: extension,
  email: '',
  profile,
  devices,
})

export const PBX_USERS = [
  pbxUser(2, 'a.miller', 'Anna Miller', '300', 3, [
    device(1, 'webrtc', '300'),
    device(2, 'mobile', '92300'),
    device(3, 'physical', '93300', 'Fanvil', 'fanvil-X4U'),
  ]),
  pbxUser(3, 'b.smith', 'Bob Smith', '301', 1, [device(4, 'webrtc', '301')]),
  pbxUser(4, 'c.rossi', 'Carla Rossi', '302', 3, [device(5, 'webrtc', '302')]),
  pbxUser(5, 'd.bianchi', 'Dario Bianchi', 'none', null),
]

export const GROUPS = [
  { id: 1, name: 'Support' },
  { id: 2, name: 'Sales' },
]

export const GROUP_MEMBERS: Record<string, { user_id: number; name: string }[]> = {
  '1': [{ user_id: 4, name: 'Support' }],
  '2': [
    { user_id: 2, name: 'Sales' },
    { user_id: 3, name: 'Sales' },
  ],
}

export const USER_GROUPS: Record<string, number[]> = {
  '2': [2],
  '3': [2],
  '4': [1],
}
