//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from 'vitest'
import {
  buildCustomModelName,
  buildModelRows,
  buildResetVariables,
  createPhoneModelFrom,
  filterModelsByVendor,
  getDuplicateDisplayName,
  getModelBrand,
  guessModelName,
  isCustomModelName,
  parsePhoneModelDetail,
  parsePhoneModels,
} from './models'
import { tancredi } from './tancrediClient'

vi.mock('./tancrediClient', () => ({ tancredi: { get: vi.fn(), post: vi.fn() } }))

const models = parsePhoneModels([
  { name: 'yealink-T46', display_name: 'Yealink T46', model_url: '/x' },
  { name: 'fanvil-X4U', display_name: 'Fanvil X4U', model_url: '/x' },
  { name: 'fanvil-X4U-reception', display_name: 'Reception', model_url: '/x' },
  { name: 'fanvil-X3SG-PRO', display_name: 'Fanvil X3SG Pro', model_url: '/x' },
  { name: 'snom-D785', display_name: null, model_url: '/x' },
])

describe('parsePhoneModels', () => {
  it('should sort by display name and derive brand and type', () => {
    expect(models.map((model) => model.displayName)).toEqual([
      'Fanvil X3SG Pro',
      'Fanvil X4U',
      'Reception',
      'snom-D785',
      'Yealink T46',
    ])
    expect(models.find((model) => model.name === 'fanvil-X4U-reception')).toMatchObject({
      brand: 'Fanvil',
      custom: true,
    })
    expect(models.find((model) => model.name === 'fanvil-X3SG-PRO')?.custom).toBe(false)
  })

  it('should reject an unexpected shape', () => {
    expect(() => parsePhoneModels([{ display_name: 'x' }])).toThrow()
  })

  it('should drop the trailing semicolon of a display name', () => {
    expect(
      parsePhoneModels([{ name: 'fanvil-X301P', display_name: 'Fanvil X301P/G/W;' }])[0]
        .displayName,
    ).toBe('Fanvil X301P/G/W')
  })
})

describe('parsePhoneModelDetail', () => {
  it('should stringify variables and accept an empty PHP array', () => {
    expect(
      parsePhoneModelDetail({ name: 'snom-D785', display_name: 'Snom D785', variables: [] })
        .variables,
    ).toEqual({})
    expect(
      parsePhoneModelDetail({
        name: 'snom-D785',
        display_name: 'Snom D785',
        variables: { contrast: 4, ringtone: '1', vlan_id_phone: null },
      }).variables,
    ).toEqual({ contrast: '4', ringtone: '1', vlan_id_phone: '' })
  })
})

describe('model names', () => {
  it('should read the brand from the prefix', () => {
    expect(getModelBrand('yealink-T46U')).toBe('Yealink')
  })

  it('should tell custom models apart', () => {
    expect(isCustomModelName('yealink-T46')).toBe(false)
    expect(isCustomModelName('yealink-T46-office')).toBe(true)
  })

  it('should build a technical name with allowed characters only', () => {
    expect(buildCustomModelName('fanvil-X4U', ' Front desk / 2 ')).toBe('fanvil-X4U-Front_desk___2')
  })
})

describe('filterModelsByVendor', () => {
  it('should keep the models of the vendor', () => {
    expect(filterModelsByVendor(models, 'fanvil').map((model) => model.name)).toEqual([
      'fanvil-X3SG-PRO',
      'fanvil-X4U',
      'fanvil-X4U-reception',
    ])
  })

  it('should fall back to all models for an unknown vendor', () => {
    expect(filterModelsByVendor(models, 'polycom')).toHaveLength(models.length)
    expect(filterModelsByVendor(models, '')).toHaveLength(models.length)
  })
})

describe('buildModelRows', () => {
  it('should list used and custom models with their phone count', () => {
    expect(
      buildModelRows(models, ['fanvil-X4U', 'fanvil-X4U', 'snom-D785']).map((row) => [
        row.name,
        row.phones,
      ]),
    ).toEqual([
      ['fanvil-X4U', 2],
      ['fanvil-X4U-reception', 0],
      ['snom-D785', 1],
    ])
  })
})

describe('getDuplicateDisplayName', () => {
  it('should append the copy label and a counter when taken', () => {
    expect(getDuplicateDisplayName(models, 'Snom D785', 'copy')).toBe('Snom D785 copy')
    expect(getDuplicateDisplayName(models, 'Fanvil X4U', 'copy')).toBe('Fanvil X4U copy')
    expect(
      getDuplicateDisplayName(
        [...models, { ...models[0], displayName: 'Fanvil X4U copy' }],
        'Fanvil X4U',
        'copy',
      ),
    ).toBe('Fanvil X4U copy 2')
  })
})

describe('buildResetVariables', () => {
  it('should restore originals and clear the variables added later', () => {
    expect(
      buildResetVariables({ contrast: '2', ringtone: '3' }, { contrast: '4', brightness: '5' }),
    ).toEqual({ contrast: '4', brightness: '5', ringtone: null })
  })
})

describe('guessModelName', () => {
  const nethesis = parsePhoneModels([
    { name: 'nethesis-NPX3', display_name: 'NPX3' },
    { name: 'nethesis-NPX5', display_name: 'NPX5' },
    { name: 'snom-D785', display_name: 'Snom D785' },
  ])

  it('should read the Nethesis model from the MAC address', () => {
    expect(guessModelName('E0:E6:56:01:00:01', 'nethesis', nethesis)).toBe('nethesis-NPX5')
    expect(guessModelName('E0:E6:56:04:00:01', 'nethesis', nethesis)).toBe('nethesis-NPX5')
  })

  it('should pick the only model of a vendor and nothing otherwise', () => {
    expect(guessModelName('00:04:13:00:00:01', 'snom', nethesis)).toBe('snom-D785')
    expect(guessModelName('E0:E6:56:09:00:01', 'nethesis', nethesis)).toBe('')
    expect(guessModelName('AA:BB:CC:00:00:01', '', nethesis)).toBe('')
  })
})

describe('createPhoneModelFrom', () => {
  it('copies the customized variables of the duplicated model', async () => {
    const variables = { tmpl_phone: 'fanvil-X5.tmpl', cap_linekey_count: 21, ldap_server: '' }
    vi.mocked(tancredi.get).mockResolvedValue({
      name: 'fanvil-X4U-reception',
      display_name: 'Reception',
      variables,
    })
    vi.mocked(tancredi.post).mockResolvedValue({
      name: 'fanvil-X4U-reception-Reception_copy',
      display_name: 'Reception copy',
      variables,
    })

    const created = await createPhoneModelFrom({
      name: 'Reception copy',
      baseModel: 'fanvil-X4U-reception',
    })

    expect(tancredi.get).toHaveBeenCalledWith('/models/fanvil-X4U-reception')
    expect(tancredi.post).toHaveBeenCalledWith('/models', {
      name: 'fanvil-X4U-reception-Reception_copy',
      display_name: 'Reception copy',
      variables: { tmpl_phone: 'fanvil-X5.tmpl', cap_linekey_count: '21', ldap_server: '' },
    })
    expect(created.displayName).toBe('Reception copy')
  })
})
