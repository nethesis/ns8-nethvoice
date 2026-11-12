//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { parseUsers } from '@/lib/users/users'
import { parsePhoneModels } from './models'
import {
  buildPhones,
  filterPhones,
  getAssignableUsers,
  getUserLabel,
  isPhoneAlreadyRegistered,
  parseProvisioningUrls,
  parseTancrediPhones,
  UNASSIGNED_FILTER_ID,
  validateNewPhoneRows,
} from './phones'

const users = parseUsers([
  {
    id: 1,
    username: 'a.miller',
    displayname: 'Anna Miller',
    default_extension: '300',
    devices: [
      { id: 1, type: 'webrtc', extension: '300' },
      { id: 2, type: 'physical', extension: '93300', mac: '00:15:65:AB:CD:01', model: 'x' },
    ],
  },
  { id: 2, username: 'j.smith', displayname: 'John Smith', default_extension: '301', devices: [] },
  { id: 3, username: 'nobody', displayname: '', default_extension: 'none', devices: [] },
])

const models = parsePhoneModels([
  { name: 'yealink-T46', display_name: 'Yealink T46' },
  { name: 'fanvil-X4U', display_name: 'Fanvil X4U' },
])

const tancrediPhones = parseTancrediPhones([
  { mac: '0C-38-3E-00-00-02', model: 'fanvil-X4U', display_name: 'Fanvil' },
  { mac: '00-15-65-AB-CD-01', model: 'yealink-T46', display_name: '' },
])

const phones = buildPhones(tancrediPhones, models, users, { '93300': true })

describe('buildPhones', () => {
  it('should join Tancredi phones with models, users and encryption', () => {
    expect(phones).toEqual([
      {
        mac: '00-15-65-AB-CD-01',
        model: 'yealink-T46',
        modelLabel: 'Yealink T46',
        vendor: 'Yealink',
        user: { username: 'a.miller', displayName: 'Anna Miller', mainExtension: '300' },
        extension: '93300',
        encrypted: true,
      },
      {
        mac: '0C-38-3E-00-00-02',
        model: 'fanvil-X4U',
        modelLabel: 'Fanvil X4U',
        vendor: 'Fanvil',
        user: null,
        extension: '',
        encrypted: false,
      },
    ])
  })

  it('should reject an unexpected Tancredi shape', () => {
    expect(() => parseTancrediPhones([{ model: 'x' }])).toThrow()
  })
})

describe('filterPhones', () => {
  const noFilters = { text: '', models: [], users: [] }

  it('should match MAC in any format, model and user', () => {
    expect(filterPhones(phones, { ...noFilters, text: '00:15:65' })).toHaveLength(1)
    expect(filterPhones(phones, { ...noFilters, text: '0c383e' })).toHaveLength(1)
    expect(filterPhones(phones, { ...noFilters, text: 'miller' })[0].mac).toBe('00-15-65-AB-CD-01')
    expect(filterPhones(phones, { ...noFilters, text: 'fanvil x4u' })).toHaveLength(1)
  })

  it('should filter by model and by user, unassigned included', () => {
    expect(filterPhones(phones, { ...noFilters, models: ['fanvil-X4U'] })).toHaveLength(1)
    expect(filterPhones(phones, { ...noFilters, users: [UNASSIGNED_FILTER_ID] })[0].user).toBe(null)
    expect(filterPhones(phones, { ...noFilters, users: ['a.miller'] })).toHaveLength(1)
  })
})

describe('validateNewPhoneRows', () => {
  it('should flag invalid, existing and repeated MACs and missing models', () => {
    expect(
      validateNewPhoneRows(
        [
          { mac: 'xx', model: 'yealink-T46', mainExtension: '' },
          { mac: '00:15:65:ab:cd:01', model: 'yealink-T46', mainExtension: '' },
          { mac: '00:15:65:ab:cd:02', model: '', mainExtension: '' },
          { mac: '001565ABCD02', model: 'yealink-T46', mainExtension: '300' },
          { mac: '00:15:65:ab:cd:03', model: 'yealink-T46', mainExtension: '' },
        ],
        ['00-15-65-AB-CD-01'],
      ),
    ).toEqual([
      { mac: 'phones.inventory.mac_invalid' },
      { mac: 'phones.inventory.mac_already_exists' },
      { mac: 'phones.inventory.mac_duplicated', model: 'phones.inventory.model_required' },
      { mac: 'phones.inventory.mac_duplicated' },
      {},
    ])
  })
})

describe('users helpers', () => {
  it('should offer only users with a main extension', () => {
    expect(getAssignableUsers(users).map((user) => user.username)).toEqual(['a.miller', 'j.smith'])
  })

  it('should label a user with name and username', () => {
    expect(getUserLabel(users[0])).toBe('Anna Miller (a.miller)')
  })
})

describe('parseProvisioningUrls', () => {
  it('should read both provisioning URLs', () => {
    expect(
      parseProvisioningUrls({
        mac: '00-15-65-AB-CD-01',
        provisioning_url1: null,
        provisioning_url2: 'https://pbx.example.com/provisioning/token/001565abcd01.cfg',
      }),
    ).toEqual({
      firstAccess: '',
      permanent: 'https://pbx.example.com/provisioning/token/001565abcd01.cfg',
    })
  })
})

describe('isPhoneAlreadyRegistered', () => {
  it('should recognize the Tancredi phone-exists problem', () => {
    const conflict = new ApiError({
      status: 409,
      method: 'POST',
      url: '/tancredi/api/v1/phones',
      body: {
        type: 'https://nethesis.github.io/tancredi/problems/#phone-exists',
        title: 'The phone mac address is already registered',
      },
    })

    expect(isPhoneAlreadyRegistered(conflict)).toBe(true)
    expect(isPhoneAlreadyRegistered(new Error('x'))).toBe(false)
  })
})
