//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { MockApi } from '../fixtures/mockApi'

export const PROVIDERS = [
  { id: 4, provider: 'messagenet', description: 'MessageNet', codecs: 'ulaw,alaw,g729' },
  { id: 13, provider: 'twt', description: 'TWT', codecs: 'ulaw,alaw' },
  { id: 32, provider: 'elevenlabs', description: 'ElevenLabs', codecs: 'ulaw,alaw,g722' },
]

export const CODECS = [
  { codec: 'alaw', enabled: true },
  { codec: 'ulaw', enabled: true },
  { codec: 'g729', enabled: true },
]

export const VOIP_TRUNK = {
  trunkid: 2,
  tech: 'pjsip',
  channelid: 'main_trunk',
  name: 'main_trunk',
  outcid: '0212345670',
  keepcid: 'off',
  maxchans: '',
  failscript: '',
  dialoutprefix: '',
  usercontext: '',
  provider: 'twt',
  disabled: 'off',
  continue: 'off',
  routedisplay: 'on',
  dialopts: false,
  username: 'account_98765',
  details: {
    username: 'account_98765',
    secret: 'invented-secret',
    sip_server: 'sip.example.org',
    codecs: 'g729',
    registration: 'send',
  },
}

export const BACKUP_TRUNK = {
  ...VOIP_TRUNK,
  trunkid: 3,
  channelid: 'backup_trunk',
  name: 'backup_trunk',
  outcid: '0212345671',
  provider: '',
  username: 'backup_user',
  details: { ...VOIP_TRUNK.details, sip_server: 'sip.backup.example.org', codecs: 'alaw,ulaw' },
}

export const GATEWAY_TRUNK = {
  ...VOIP_TRUNK,
  trunkid: 5,
  channelid: 'Patton_0b1cdd_isdn_0',
  name: 'Patton_0b1cdd_isdn_0',
  outcid: '',
  provider: '',
  username: 'Patton_0b1cdd_isdn_0',
  details: { ...VOIP_TRUNK.details, sip_server: '192.168.10.20', codecs: 'g729,alaw,ulaw' },
}

export const LIVE_STATE = {
  main_trunk: { name: 'main_trunk', status: 'online', registration: 'registered' },
  backup_trunk: { name: 'backup_trunk', status: 'offline', registration: 'rejected' },
  Patton_0b1cdd_isdn_0: { name: 'Patton_0b1cdd_isdn_0', status: 'online' },
}

const model = (
  id: number,
  name: string,
  manufacturer: string,
  description: string,
  ports: { isdn?: number; pri?: number; fxo?: number; fxs?: number },
) => ({
  id,
  model: name,
  manufacturer,
  tech: 'isdn',
  n_pri_trunks: ports.pri ?? 0,
  n_isdn_trunks: ports.isdn ?? 0,
  n_fxo_trunks: ports.fxo ?? 0,
  n_fxs_ext: ports.fxs ?? 0,
  description,
  proxy: 'sip:10.5.4.1:5060;lr',
  ipv4_green: 'voice.example.org',
})

export const GATEWAY_MODELS = {
  Patton: [
    model(11, 'TRI_FXO_2', 'Patton', 'TRINITY Analogico 2 Porte FXO', { fxo: 2 }),
    model(17, 'TRI_ISDN_2', 'Patton', 'TRINITY ISDN 2 Porte', { isdn: 2 }),
    model(19, 'TRI_PRI_1', 'Patton', 'TRINITY PRI 1 Porta', { pri: 1 }),
  ],
  Grandstream: [model(33, 'ht802', 'Grandstream', 'HT802 SIP 2 Porte FXS', { fxs: 2 })],
}

export const ISDN_GATEWAY = {
  id: 3,
  model_id: 17,
  name: 'Patton-TRINITY ISDN 2 Porte',
  ipv4: '',
  ipv4_new: '192.168.10.20',
  gateway: '192.168.10.1',
  ipv4_green: 'voice.example.org',
  netmask_green: '255.255.255.0',
  mac: '00:A0:BA:0B:1C:DD',
  proxy: 'proxy.example.org',
  model: 17,
  manufacturer: 'Patton',
  isConfigured: true,
  trunks_isdn: [{ name: 5, type: 'pmp' }],
  isConnected: false,
}

export const FXS_GATEWAY = {
  id: 4,
  model_id: 33,
  name: 'Grandstream-HT802 SIP 2 Porte FXS',
  ipv4: '',
  ipv4_new: '192.168.10.24',
  gateway: '192.168.10.1',
  ipv4_green: 'voice.example.org',
  netmask_green: '255.255.255.0',
  mac: '02:2A:3B:4C:5D:6E',
  proxy: 'proxy.example.org',
  model: 33,
  manufacturer: 'Grandstream',
  isConfigured: true,
  trunks_fxs: [{ linked_extension: '301' }],
  isConnected: false,
}

export const USERS = [
  { id: '1', username: 'a.miller', displayname: 'Anna Miller', default_extension: '300' },
  { id: '2', username: 'c.davis', displayname: 'Carl Davis', default_extension: '301' },
  { id: '3', username: 'guest', displayname: 'Guest', default_extension: 'none' },
]

export type TrunksMockData = {
  trunks?: unknown[]
  gateways?: unknown[]
  liveState?: unknown
}

export const mockTrunksApi = (mockApi: MockApi, data: TrunksMockData = {}) =>
  mockApi
    .on('GET', '/freepbx/rest/trunks', {
      json: data.trunks ?? [VOIP_TRUNK, BACKUP_TRUNK, GATEWAY_TRUNK],
    })
    .on('GET', '/freepbx/rest/providers', { json: PROVIDERS })
    .on('GET', '/freepbx/rest/codecs/voip', { json: CODECS })
    .on('GET', '/freepbx/rest/devices/gateways/list/:id', {
      json: data.gateways ?? [ISDN_GATEWAY, FXS_GATEWAY],
    })
    .on('GET', '/freepbx/rest/devices/gateways/manufacturers', { json: GATEWAY_MODELS })
    .on('GET', '/freepbx/rest/configuration/networks', { json: null })
    .on('GET', '/freepbx/rest/users/:all', { json: USERS })
    .on('GET', '/api/astproxy/trunks', { json: data.liveState ?? LIVE_STATE })
