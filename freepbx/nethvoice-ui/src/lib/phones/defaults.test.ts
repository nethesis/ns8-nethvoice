//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { api } from '@/lib/api/client'
import {
  changePhonePassword,
  getPhoneWebPassword,
  getToneZoneLabel,
  getUnmetPasswordRequirements,
  isDefaultAdminPassword,
  parsePhoneDefaults,
  PhonePasswordSchema,
  saveDefaultPhoneConfiguration,
  withCurrentOption,
} from './defaults'
import { PhoneSettingsNotSavedError } from './persistence'
import { tancredi } from './tancrediClient'

vi.mock('@/lib/api/client', () => ({ api: { POST: vi.fn() } }))

vi.mock('./tancrediClient', () => ({ tancredi: { get: vi.fn(), patch: vi.fn() } }))

describe('parsePhoneDefaults', () => {
  it('should read the variables used by the settings tab', () => {
    const defaults = parsePhoneDefaults({
      language: 'it',
      tonezone: 'it',
      provisioning_freq: 'never',
      adminpw: 'Secret-1x',
      userpw: 'user',
      provisioning_url_scheme: 'https',
      ldap_port: 20014,
    })

    expect(defaults).toMatchObject({
      language: 'it',
      toneZone: 'it',
      provisioningFrequency: 'never',
      adminPassword: 'Secret-1x',
      userPassword: 'user',
      encryptionByDefault: true,
    })
    expect(defaults.variables.ldap_port).toBe('20014')
  })

  it('should fall back to every day and empty values', () => {
    expect(parsePhoneDefaults({})).toMatchObject({
      language: '',
      provisioningFrequency: 'everyday',
      encryptionByDefault: false,
    })
  })
})

describe('getPhoneWebPassword', () => {
  it('should use the admin password of the defaults', () => {
    expect(getPhoneWebPassword(parsePhoneDefaults({ adminpw: 'Abc' }))).toBe('Abc')
    expect(getPhoneWebPassword(undefined)).toBe('')
  })
})

describe('password policy', () => {
  it('should list the unmet requirements', () => {
    expect(getUnmetPasswordRequirements('abc')).toEqual([
      'min_length',
      'uppercase',
      'number',
      'special',
    ])
    expect(getUnmetPasswordRequirements('Abcdefg1!')).toEqual([])
  })

  it('should require matching confirmation', () => {
    const result = v.safeParse(PhonePasswordSchema, {
      password: 'Abcdefg1!',
      confirmPassword: 'Abcdefg1?',
    })

    expect(result.success).toBe(false)
    expect(result.issues?.[0].message).toBe('phones.settings.passwords_do_not_match')
    expect(result.issues?.[0].path?.[0].key).toBe('confirmPassword')
  })

  it('should accept a valid password', () => {
    expect(
      v.safeParse(PhonePasswordSchema, { password: 'Abcdefg1!', confirmPassword: 'Abcdefg1!' })
        .success,
    ).toBe(true)
  })
})

describe('options helpers', () => {
  it('should keep an unknown current value among the options', () => {
    expect(withCurrentOption(['en', 'it'], 'de')).toEqual(['en', 'it', 'de'])
    expect(withCurrentOption(['en', 'it'], 'it')).toEqual(['en', 'it'])
  })

  it('should name tone zones as countries', () => {
    expect(getToneZoneLabel('it', 'en')).toBe('Italy')
    expect(getToneZoneLabel('uk', 'en')).toBe('United Kingdom')
  })
})

describe('isDefaultAdminPassword', () => {
  it('should flag the generated password that misses the requirements', () => {
    expect(isDefaultAdminPassword('k3j9x0q2ab')).toBe(true)
    expect(isDefaultAdminPassword('Secret-123')).toBe(false)
  })
})

describe('default settings writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tancredi.patch).mockResolvedValue(null)
    vi.mocked(api.POST).mockResolvedValue({ data: undefined, response: new Response() })
  })

  it('reads the default settings back after saving them', async () => {
    vi.mocked(tancredi.get).mockResolvedValue({
      language: 'it',
      tonezone: 'it',
      provisioning_freq: 'never',
      account_password_1: '',
    })

    await saveDefaultPhoneConfiguration({
      language: 'it',
      toneZone: 'it',
      provisioningFrequency: 'never',
    })

    expect(tancredi.get).toHaveBeenCalledWith('/defaults')
  })

  it('fails a save of the default settings that was not stored', async () => {
    vi.mocked(tancredi.get).mockResolvedValue({
      language: 'en',
      tonezone: 'it',
      provisioning_freq: 'never',
    })

    await expect(
      saveDefaultPhoneConfiguration({
        language: 'it',
        toneZone: 'it',
        provisioningFrequency: 'never',
      }),
    ).rejects.toBeInstanceOf(PhoneSettingsNotSavedError)
  })

  it('does not change the PBX admin password when Tancredi did not store it', async () => {
    vi.mocked(tancredi.get).mockResolvedValue({ adminpw: 'Old-secret1' })

    await expect(changePhonePassword('admin', 'New-secret1', 'Old-secret1')).rejects.toBeInstanceOf(
      PhoneSettingsNotSavedError,
    )
    expect(api.POST).not.toHaveBeenCalled()
  })

  it('fails a user password change that was not stored', async () => {
    vi.mocked(tancredi.get).mockResolvedValue({ userpw: 'old' })

    await expect(changePhonePassword('user', 'new')).rejects.toBeInstanceOf(
      PhoneSettingsNotSavedError,
    )
  })

  it('changes the PBX admin password after Tancredi stored it', async () => {
    vi.mocked(tancredi.get).mockResolvedValue({ adminpw: 'New-secret1' })

    await changePhonePassword('admin', 'New-secret1', 'Old-secret1')

    expect(api.POST).toHaveBeenCalledWith('/physicalextensions/adminpw', {
      body: { password: 'New-secret1' },
    })
  })
})
