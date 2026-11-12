//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  getCodecLabel,
  getProviderName,
  getSelectableCodecs,
  getTrunkLabel,
  getTrunkLabelById,
  parseTrunkCodecs,
  parseTrunkProviders,
  type TrunkProvider,
} from './providers'
import type { Trunk } from './trunks'

const providers: TrunkProvider[] = [
  { id: 'messagenet', name: 'MessageNet', defaultCodecs: ['ulaw', 'alaw', 'g729'] },
  { id: 'twt', name: 'TWT', defaultCodecs: ['ulaw', 'alaw'] },
]

const trunk: Trunk = {
  id: 2,
  name: 'main_trunk',
  technology: 'pjsip',
  phoneNumber: '0721405516',
  username: 'account_98765',
  provider: 'twt',
  sipServer: '',
  codecs: [],
  disabled: false,
}

describe('parseTrunkProviders', () => {
  it('should map and sort the providers by name', () => {
    expect(
      parseTrunkProviders([
        { id: 13, provider: 'twt', description: 'TWT', codecs: 'ulaw,alaw' },
        { id: 4, provider: 'messagenet', description: 'MessageNet', codecs: 'ulaw,alaw,g729' },
      ]),
    ).toEqual(providers)
  })

  it('should fall back to the identifier and tolerate missing codecs', () => {
    expect(
      parseTrunkProviders([{ id: 1, provider: 'custom', description: '', codecs: null }]),
    ).toEqual([{ id: 'custom', name: 'custom', defaultCodecs: [] }])
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseTrunkProviders('An error occurred')).toThrow()
  })
})

describe('parseTrunkCodecs', () => {
  it('should keep the enabled codecs in the given order', () => {
    expect(
      parseTrunkCodecs([
        { codec: 'alaw', enabled: true },
        { codec: 'ulaw', enabled: false },
        { codec: 'g729', enabled: true },
      ]),
    ).toEqual(['alaw', 'g729'])
  })
})

describe('getProviderName', () => {
  it('should name the provider of a trunk', () => {
    expect(getProviderName(trunk, providers)).toBe('TWT')
  })

  it('should be empty when the trunk has no known provider', () => {
    expect(getProviderName({ ...trunk, provider: '' }, providers)).toBe('')
    expect(getProviderName({ ...trunk, provider: 'satellite-agent' }, providers)).toBe('')
  })
})

describe('getTrunkLabel', () => {
  it('should join provider and phone number', () => {
    expect(getTrunkLabel(trunk, providers)).toBe('TWT–0721405516')
  })

  it('should fall back to the trunk name without a known provider or a phone number', () => {
    expect(getTrunkLabel({ ...trunk, provider: '' }, providers)).toBe('main_trunk')
    expect(getTrunkLabel({ ...trunk, phoneNumber: '' }, providers)).toBe('main_trunk')
  })
})

describe('getTrunkLabelById', () => {
  it('should label the trunk with the given id', () => {
    expect(getTrunkLabelById(2, 'main_trunk', [trunk], providers)).toBe('TWT–0721405516')
  })

  it('should fall back to the given name when the trunk is not found', () => {
    expect(getTrunkLabelById(5, 'Patton_0b1cdd_isdn_0', [trunk], providers)).toBe(
      'Patton_0b1cdd_isdn_0',
    )
    expect(getTrunkLabelById(2, 'main_trunk', [], [])).toBe('main_trunk')
  })
})

describe('getCodecLabel', () => {
  it('should format the codecs that have a standard name', () => {
    expect(getCodecLabel('g729')).toBe('G.729')
    expect(getCodecLabel('G722')).toBe('G.722')
  })

  it('should leave the other codecs untouched', () => {
    expect(getCodecLabel('alaw')).toBe('alaw')
  })
})

describe('getSelectableCodecs', () => {
  it('should merge PBX codecs, provider defaults and current selection without duplicates', () => {
    expect(getSelectableCodecs(['alaw', 'ulaw', 'g729'], providers[1], ['g722', 'alaw'])).toEqual([
      'alaw',
      'ulaw',
      'g729',
      'g722',
    ])
  })

  it('should work without a provider', () => {
    expect(getSelectableCodecs(['alaw'], undefined, [])).toEqual(['alaw'])
  })
})
