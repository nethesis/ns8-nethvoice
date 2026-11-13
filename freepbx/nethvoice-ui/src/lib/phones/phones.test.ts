//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import { parseUsers } from '@/lib/users/users'
import { parsePhoneModels } from './models'
import {
  addPhone,
  buildPhones,
  deletePhone,
  filterPhones,
  getAssignableUsers,
  getPhoneStatus,
  getUserLabel,
  isPhoneAlreadyRegistered,
  isUserAtDeviceLimit,
  MissingWebPasswordError,
  parseProvisioningUrls,
  parseTancrediPhones,
  PhoneReassignmentError,
  UNASSIGNED_FILTER_ID,
  updatePhone,
  validateNewPhoneRows,
  type Phone,
} from './phones'
import { tancredi } from './tancrediClient'

vi.mock('@/lib/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}))

vi.mock('./tancrediClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tancrediClient')>()),
  tancredi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const serverError = (url: string) =>
  new ApiError({ status: 500, method: 'POST', url, body: { status: 'failed' } })

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

  it('should filter by registration status', () => {
    const registrations = {
      '93300': { registered: true, ip: '192.0.2.10', port: '5060', userAgent: 'Yealink' },
    }

    expect(
      filterPhones(phones, { ...noFilters, statuses: ['registered'] }, registrations),
    ).toHaveLength(1)
    expect(
      filterPhones(phones, { ...noFilters, statuses: ['unregistered'] }, registrations)[0].mac,
    ).toBe('0C-38-3E-00-00-02')
    expect(filterPhones(phones, { ...noFilters, statuses: ['registered'] })).toHaveLength(0)
  })
})

describe('getPhoneStatus', () => {
  it('should read the registration of the extension of the phone', () => {
    const registrations = {
      '93300': { registered: true, ip: '', port: '', userAgent: '' },
      '93301': { registered: false, ip: '', port: '', userAgent: '' },
    }

    expect(getPhoneStatus({ extension: '93300' }, registrations)).toBe('registered')
    expect(getPhoneStatus({ extension: '93301' }, registrations)).toBe('unregistered')
    expect(getPhoneStatus({ extension: '93302' }, registrations)).toBe('unregistered')
    expect(getPhoneStatus({ extension: '' }, registrations)).toBe('unregistered')
    expect(getPhoneStatus({ extension: '93300' }, undefined)).toBe('unknown')
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
          { mac: 'FF:FF:FF:FF:FF:FF', model: 'yealink-T46', mainExtension: '' },
        ],
        ['00-15-65-AB-CD-01'],
      ),
    ).toEqual([
      { mac: 'phones.inventory.mac_invalid' },
      { mac: 'phones.inventory.mac_already_exists' },
      { mac: 'phones.inventory.mac_duplicated', model: 'phones.inventory.model_required' },
      { mac: 'phones.inventory.mac_duplicated' },
      {},
      { mac: 'phones.inventory.mac_not_unicast' },
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

  it('should detect users that reached the device limit', () => {
    expect(isUserAtDeviceLimit(users[0])).toBe(false)
    expect(
      isUserAtDeviceLimit({
        devices: Array.from({ length: 9 }, (_, index) => ({ ...users[0].devices[0], id: index })),
      }),
    ).toBe(true)
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

describe('phone writes', () => {
  const calls: string[] = []
  const assigned: Phone = phones[0]
  const record =
    (name: string, result: unknown = { data: undefined }) =>
    async () => {
      calls.push(name)
      return result
    }

  beforeEach(() => {
    vi.clearAllMocks()
    calls.length = 0
    vi.mocked(api.POST).mockImplementation(async (path) => {
      calls.push(`POST ${path}`)
      return { data: undefined, response: new Response() }
    })
    vi.mocked(api.PATCH).mockImplementation(async (path) => {
      calls.push(`PATCH ${path}`)
      return { data: undefined, response: new Response() }
    })
    vi.mocked(api.DELETE).mockImplementation(async (path) => {
      calls.push(`DELETE ${path}`)
      return { data: undefined, response: new Response() }
    })
    vi.mocked(tancredi.patch).mockImplementation(record('tancredi PATCH'))
    vi.mocked(tancredi.post).mockImplementation(record('tancredi POST'))
    vi.mocked(tancredi.delete).mockImplementation(record('tancredi DELETE'))
  })

  it('should assign the new user before removing the extension of the previous one', async () => {
    await updatePhone(
      assigned,
      { model: assigned.model, mainExtension: '301', encrypted: true },
      'Secret-1x',
    )

    expect(calls).toEqual(['POST /physicalextensions', 'DELETE /physicalextensions/{id}'])
  })

  it('should keep the previous extension when the new assignment fails', async () => {
    vi.mocked(api.POST).mockRejectedValueOnce(serverError('/physicalextensions'))

    await expect(
      updatePhone(
        assigned,
        { model: assigned.model, mainExtension: '301', encrypted: true },
        'Secret-1x',
      ),
    ).rejects.toThrow(ApiError)
    expect(api.DELETE).not.toHaveBeenCalled()
  })

  it('should report a reassignment completed with errors', async () => {
    vi.mocked(api.DELETE).mockRejectedValueOnce(serverError('/physicalextensions/93300'))

    await expect(
      updatePhone(
        assigned,
        { model: assigned.model, mainExtension: '301', encrypted: true },
        'Secret-1x',
      ),
    ).rejects.toBeInstanceOf(PhoneReassignmentError)
  })

  it('should not assign a phone without the admin password of the phones', async () => {
    await expect(
      updatePhone(phones[1], { model: phones[1].model, mainExtension: '301', encrypted: true }, ''),
    ).rejects.toBeInstanceOf(MissingWebPasswordError)
    await expect(
      addPhone({ mac: '00:15:65:00:00:09', model: 'yealink-T46', mainExtension: '' }, 'Yealink', {
        webPassword: '',
        encrypted: true,
      }),
    ).rejects.toBeInstanceOf(MissingWebPasswordError)
    expect(calls).toEqual([])
  })

  it('should restore the Tancredi model when the PBX rejects it', async () => {
    vi.mocked(api.PATCH).mockRejectedValueOnce(serverError('/physicalextensions/mac'))

    await expect(
      updatePhone(
        assigned,
        { model: 'yealink-T54', mainExtension: '300', encrypted: true },
        'Secret-1x',
      ),
    ).rejects.toThrow(ApiError)
    expect(vi.mocked(tancredi.patch).mock.calls).toEqual([
      ['/phones/00-15-65-AB-CD-01', { model: 'yealink-T54' }],
      ['/phones/00-15-65-AB-CD-01', { model: 'yealink-T46' }],
    ])
  })

  it('should delete a phone from the PBX before Tancredi', async () => {
    await deletePhone(assigned)
    expect(calls).toEqual(['DELETE /physicalextensions/{id}', 'tancredi DELETE'])
  })

  it('should keep the phone in Tancredi when the PBX deletion fails', async () => {
    vi.mocked(api.DELETE).mockRejectedValueOnce(serverError('/physicalextensions/mac'))

    await expect(deletePhone(assigned)).rejects.toThrow(ApiError)
    expect(tancredi.delete).not.toHaveBeenCalled()
  })
})
