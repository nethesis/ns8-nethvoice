//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { MockApi } from '../fixtures/mockApi'

export const TANCREDI = '/tancredi/api/v1'
export const REST = '/freepbx/rest'

export const ASSIGNED_MAC = '00-15-65-AB-CD-01'
export const UNASSIGNED_MAC = '0C-38-3E-00-00-02'

export const TANCREDI_PHONES = [
  {
    mac: ASSIGNED_MAC,
    model: 'yealink-T46',
    display_name: 'Yealink',
    model_url: `${TANCREDI}/models/yealink-T46`,
    phone_url: `${TANCREDI}/phones/${ASSIGNED_MAC}`,
  },
  {
    mac: UNASSIGNED_MAC,
    model: 'fanvil-X4U',
    display_name: 'Fanvil',
    model_url: `${TANCREDI}/models/fanvil-X4U`,
    phone_url: `${TANCREDI}/phones/${UNASSIGNED_MAC}`,
  },
]

export const TANCREDI_MODELS = [
  { name: 'yealink-T46', display_name: 'Yealink T46', model_url: '' },
  { name: 'yealink-T54', display_name: 'Yealink T54', model_url: '' },
  { name: 'fanvil-X4U', display_name: 'Fanvil X4U', model_url: '' },
  { name: 'fanvil-X4U-reception', display_name: 'Reception desk', model_url: '' },
  { name: 'snom-D785', display_name: 'Snom D785', model_url: '' },
]

export const USERS = [
  {
    id: '1',
    username: 'a.miller',
    displayname: 'Anna Miller',
    default_extension: '300',
    email: '',
    profile: 3,
    devices: [
      { id: 1, type: 'webrtc', extension: '300', srtp: null },
      {
        id: 2,
        type: 'physical',
        extension: '91300',
        mac: '00:15:65:AB:CD:01',
        vendor: 'Yealink',
        model: 'yealink-T46',
        line: 1,
        srtp: 0,
        secret: 'invented-sip-secret',
      },
    ],
  },
  {
    id: '2',
    username: 'j.smith',
    displayname: 'John Smith',
    default_extension: '301',
    email: '',
    profile: 3,
    devices: [{ id: 3, type: 'webrtc', extension: '301', srtp: null }],
  },
]

export const DEFAULTS = {
  language: 'it',
  tonezone: 'it',
  provisioning_freq: 'everyday',
  provisioning_url_scheme: 'https',
  adminpw: 'invented-admin',
  userpw: 'invented-user',
  ringtone: '1',
  screensaver_time: '600',
  backlight_time: '30',
  ntp_server: 'pool.ntp.org',
  ldap_server: 'pbx.example.com',
}

export const MODEL_VARIABLES = {
  tmpl_phone: 'yealink.tmpl',
  cap_softkey_count: '2',
  cap_linekey_count: '2',
  cap_ringtone_count: '5',
  cap_ringtone_blacklist: '-1',
  cap_brightness: '1',
  cap_contrast: '',
  cap_background_file: '',
  softkey_type_1: 'history',
  linekey_type_1: 'line',
  ringtone: '2',
  brightness: '5',
}

export const MAC_VENDORS = { '001565': 'yealink', '0C383E': 'fanvil', E0E656: 'nethesis' }

type PhonesApiOptions = {
  phones?: unknown
  phonesStatus?: number
}

export const mockPhonesApi = (mockApi: MockApi, options: PhonesApiOptions = {}) =>
  mockApi
    .on('GET', `${TANCREDI}/phones`, {
      status: options.phonesStatus ?? 200,
      json: options.phones ?? TANCREDI_PHONES,
    })
    .on('GET', `${TANCREDI}/models`, { json: TANCREDI_MODELS })
    .on('GET', `${TANCREDI}/defaults`, { json: DEFAULTS })
    .on('GET', `${TANCREDI}/macvendors`, { json: MAC_VENDORS })
    .on('GET', `${REST}/users/:all`, { json: USERS })
    .on('GET', `${TANCREDI}/firmware`, { json: [] })
    .on('GET', `${TANCREDI}/backgrounds`, {
      json: [{ name: 'company-logo.png', size: 2048, mtime: 1767225600 }],
    })
