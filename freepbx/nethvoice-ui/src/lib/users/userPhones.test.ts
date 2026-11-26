//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updatePhone, type Phone } from '@/lib/phones/phones'
import {
  applyPhoneChanges,
  getAssignedPhoneMacs,
  getMaxPhones,
  getPhoneLabel,
  getPhonesWithoutMac,
  PhoneChangeError,
  planPhoneChanges,
} from './userPhones'

vi.mock('@/lib/phones/phones', () => ({ updatePhone: vi.fn() }))

const phone = (mac: string, username: string | null): Phone => ({
  mac,
  model: 'acme-T1',
  modelLabel: 'Acme T1',
  vendor: 'Acme',
  user: username ? { username, displayName: username, mainExtension: '300' } : null,
  extension: username ? '91300' : '',
  encrypted: false,
})

const PHONES = [
  phone('00-11-22-33-44-01', 'a.miller'),
  phone('00-11-22-33-44-02', 'a.miller'),
  phone('00-11-22-33-44-03', null),
]

const macs = (items: Phone[]) => items.map((item) => item.mac.slice(-2))

describe('getAssignedPhoneMacs', () => {
  it('converts the MAC of the devices and skips the ones without a MAC', () => {
    expect(
      getAssignedPhoneMacs([
        {
          id: 1,
          type: 'physical',
          extension: '91300',
          mac: '00:11:22:33:44:01',
          vendor: '',
          model: '',
          line: 1,
          registered: false,
        },
        {
          id: 2,
          type: 'physical',
          extension: '92300',
          mac: '00:11:22:33:44:01',
          vendor: '',
          model: '',
          line: 2,
          registered: false,
        },
        {
          id: 3,
          type: 'temporaryphysical',
          extension: '93300',
          mac: '',
          vendor: '',
          model: '',
          line: null,
          registered: false,
        },
      ]),
    ).toEqual(['00-11-22-33-44-01'])
  })
})

describe('getMaxPhones', () => {
  it('leaves the slots not used by the other devices', () => {
    expect(getMaxPhones(3)).toBe(6)
    expect(getMaxPhones(12)).toBe(0)
  })
})

describe('planPhoneChanges', () => {
  const current = ['00-11-22-33-44-01', '00-11-22-33-44-02']

  it('assigns the new phones and frees the removed ones', () => {
    const plan = planPhoneChanges(
      PHONES,
      current,
      ['00-11-22-33-44-02', '00-11-22-33-44-03', ''],
      false,
    )

    expect(macs(plan.unassign)).toEqual(['01'])
    expect(macs(plan.assign)).toEqual(['03'])
  })

  it('does nothing when the selection did not change', () => {
    expect(planPhoneChanges(PHONES, current, [...current].reverse(), false)).toEqual({
      unassign: [],
      assign: [],
    })
  })

  it('assigns again every phone after an extension change, as unassigned phones', () => {
    const plan = planPhoneChanges(PHONES, current, ['00-11-22-33-44-01'], true)

    expect(plan.unassign).toEqual([])
    expect(plan.assign).toEqual([{ ...PHONES[0], user: null, extension: '' }])
  })
})

describe('getPhonesWithoutMac', () => {
  it('keeps the physical devices that have no valid MAC', () => {
    const base = { vendor: '', model: '', line: 1, registered: false, type: 'physical' as const }

    expect(
      getPhonesWithoutMac([
        { ...base, id: 1, extension: '91300', mac: '00:11:22:33:44:01' },
        { ...base, id: 2, extension: '93205', mac: '' },
      ]).map((device) => device.extension),
    ).toEqual(['93205'])
  })
})

describe('getPhoneLabel', () => {
  it('names the phone by model and MAC address', () => {
    expect(getPhoneLabel(PHONES[2])).toBe('Acme T1 (00:11:22:33:44:03)')
    expect(getPhoneLabel({ ...PHONES[2], modelLabel: '' })).toBe('Acme (00:11:22:33:44:03)')
    expect(getPhoneLabel({ ...PHONES[2], modelLabel: '', vendor: '' })).toBe('00:11:22:33:44:03')
  })
})

describe('applyPhoneChanges', () => {
  const free = (mac: string) => phone(mac, null)

  beforeEach(() => {
    vi.mocked(updatePhone).mockReset()
  })

  it('assigns the phones to the main extension with the given web password', async () => {
    vi.mocked(updatePhone).mockResolvedValue()

    await applyPhoneChanges(
      { unassign: [], assign: [free('00-11-22-33-44-03')] },
      '301',
      null,
      true,
    )

    expect(updatePhone).toHaveBeenCalledWith(
      free('00-11-22-33-44-03'),
      { model: 'acme-T1', mainExtension: '301', encrypted: true },
      null,
    )
  })

  it('names the phone that failed and the ones already changed', async () => {
    const failure = new Error('boom')
    vi.mocked(updatePhone)
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(failure)

    const error = await applyPhoneChanges(
      {
        unassign: [PHONES[0]],
        assign: [free('00-11-22-33-44-03'), free('00-11-22-33-44-04'), free('00-11-22-33-44-05')],
      },
      '301',
      'secret',
      false,
    ).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(PhoneChangeError)
    const change = error as PhoneChangeError
    expect(change.kind).toBe('assign')
    expect(change.phone.mac).toBe('00-11-22-33-44-04')
    expect(macs(change.completed)).toEqual(['01', '03'])
    expect(change.cause).toBe(failure)
    expect(updatePhone).toHaveBeenCalledTimes(3)
  })

  it('tells when releasing a phone failed', async () => {
    vi.mocked(updatePhone).mockRejectedValueOnce(new Error('boom'))

    const error = await applyPhoneChanges(
      { unassign: [PHONES[0]], assign: [free('00-11-22-33-44-03')] },
      '301',
      null,
      false,
    ).catch((reason: unknown) => reason)

    expect(error).toMatchObject({ kind: 'release', completed: [] })
    expect(updatePhone).toHaveBeenCalledTimes(1)
  })
})
