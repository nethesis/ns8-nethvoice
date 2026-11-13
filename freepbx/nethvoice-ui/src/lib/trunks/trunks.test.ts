//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  filterVoipTrunks,
  getAddedProviderCodecs,
  getEmptyVoipTrunkForm,
  getTrunkManagement,
  getTrunkRouteUsage,
  getVoipTrunkForm,
  getVoipTrunks,
  isEmptyUpdateTrunkRequest,
  parseTrunks,
  splitCodecs,
  toCreateTrunkRequest,
  toUpdateTrunkRequest,
  usesNameAsUsername,
  validateVoipTrunkForm,
  type Trunk,
  type VoipTrunkForm,
} from './trunks'

const rawTrunk = {
  trunkid: 2,
  tech: 'pjsip',
  channelid: 'main_trunk',
  name: 'main_trunk',
  outcid: '0721405516',
  provider: '',
  disabled: 'off',
  username: 'account_98765',
  details: {
    codecs: 'g729,alaw',
    sip_server: 'sip.example.org',
    secret: 'do-not-keep',
    username: 'account_98765',
  },
}

const trunk: Trunk = {
  id: 2,
  name: 'main_trunk',
  technology: 'pjsip',
  phoneNumber: '0721405516',
  username: 'account_98765',
  provider: '',
  sipServer: 'sip.example.org',
  codecs: ['g729', 'alaw'],
  disabled: false,
  context: '',
}

const filledForm: VoipTrunkForm = {
  provider: 'twt',
  name: 'main_trunk',
  phoneNumber: '0721405516',
  username: 'account_98765',
  password: 'Secret,1234',
  codecs: ['g729'],
  forceCodec: false,
}

describe('splitCodecs', () => {
  it('should split a comma separated list and drop empty items', () => {
    expect(splitCodecs('ulaw, alaw,,g729')).toEqual(['ulaw', 'alaw', 'g729'])
    expect(splitCodecs('')).toEqual([])
  })
})

describe('parseTrunks', () => {
  it('should map the legacy shape to the trunk model', () => {
    expect(parseTrunks([rawTrunk])).toEqual([trunk])
  })

  it('should never keep the SIP secret', () => {
    expect(JSON.stringify(parseTrunks([rawTrunk]))).not.toContain('do-not-keep')
  })

  it('should accept ids as strings and missing details', () => {
    const [parsed] = parseTrunks([
      { trunkid: '7', tech: 'PJSIP', name: 'backup', username: null, details: [] },
    ])

    expect(parsed).toMatchObject({
      id: 7,
      technology: 'pjsip',
      username: '',
      phoneNumber: '',
      codecs: [],
      sipServer: '',
    })
  })

  it('should sort trunks by name', () => {
    const names = parseTrunks([
      { ...rawTrunk, trunkid: 1, name: 'trunk10' },
      { ...rawTrunk, trunkid: 2, name: 'trunk2' },
      { ...rawTrunk, trunkid: 3, name: 'Backup' },
    ]).map((item) => item.name)

    expect(names).toEqual(['Backup', 'trunk2', 'trunk10'])
  })

  it('should flag a disabled trunk', () => {
    expect(parseTrunks([{ ...rawTrunk, disabled: 'on' }])[0].disabled).toBe(true)
  })

  it('should reject an unexpected shape', () => {
    expect(() => parseTrunks({ trunkid: 1 })).toThrow()
    expect(() => parseTrunks([{ trunkid: 'abc', tech: 'pjsip', name: 'x' }])).toThrow()
  })
})

describe('getVoipTrunks', () => {
  it('should keep SIP trunks that do not belong to a gateway', () => {
    const trunks: Trunk[] = [
      trunk,
      { ...trunk, id: 3, name: 'Patton_0b1cdd_isdn_0' },
      { ...trunk, id: 4, name: 'legacy', technology: 'sip' },
      { ...trunk, id: 5, name: 'dahdi_line', technology: 'dahdi' },
    ]

    expect(getVoipTrunks(trunks, [3]).map((item) => item.id)).toEqual([2, 4, 5])
  })

  it('should recognize the gateway trunks by name when the gateways are not available', () => {
    const trunks: Trunk[] = [
      trunk,
      { ...trunk, id: 3, name: 'Patton_0b1cdd_isdn_0' },
      { ...trunk, id: 6, name: 'Grandstream_a1b2c3_fxo_2' },
    ]

    expect(getVoipTrunks(trunks).map((item) => item.id)).toEqual([2])
  })
})

describe('getTrunkManagement', () => {
  it('should mark the trunks of the voice agents', () => {
    expect(getTrunkManagement({ ...trunk, provider: 'satellite-agent' })).toBe('voice_agents')
    expect(getTrunkManagement({ ...trunk, context: 'voice-agent-trunk-hangup' })).toBe(
      'voice_agents',
    )
  })

  it('should mark the trunks of other technologies', () => {
    expect(getTrunkManagement({ ...trunk, technology: 'iax2' })).toBe('other_technology')
    expect(getTrunkManagement(trunk)).toBe('editable')
  })
})

describe('getTrunkRouteUsage', () => {
  const routes = [
    { id: 1, trunks: [{ id: 2 }, { id: 3 }] },
    { id: 2, trunks: [{ id: 2 }] },
    { id: 3, trunks: [{ id: 3 }] },
    { id: 4, trunks: [] },
  ]

  it('should split the routes that keep other trunks from those left without trunks', () => {
    const usage = getTrunkRouteUsage(routes, [2])

    expect(usage.remaining.map((route) => route.id)).toEqual([1])
    expect(usage.orphaned.map((route) => route.id)).toEqual([2])
  })

  it('should consider all the trunks of a gateway together', () => {
    const usage = getTrunkRouteUsage(routes, [2, 3])

    expect(usage.remaining).toEqual([])
    expect(usage.orphaned.map((route) => route.id)).toEqual([1, 2, 3])
  })
})

describe('filterVoipTrunks', () => {
  const trunks: Trunk[] = [trunk, { ...trunk, id: 3, name: 'backup', phoneNumber: '0612345678' }]
  const getProviderLabel = (item: Trunk) => (item.id === 3 ? 'TWT' : '')

  it('should return every trunk with an empty filter', () => {
    expect(filterVoipTrunks(trunks, ' ', getProviderLabel)).toHaveLength(2)
  })

  it('should match name, phone number and provider', () => {
    expect(filterVoipTrunks(trunks, 'MAIN', getProviderLabel).map((item) => item.id)).toEqual([2])
    expect(filterVoipTrunks(trunks, '0612', getProviderLabel).map((item) => item.id)).toEqual([3])
    expect(filterVoipTrunks(trunks, 'twt', getProviderLabel).map((item) => item.id)).toEqual([3])
  })
  it('should match the codecs by the label shown in the list', () => {
    const getLabel = (codec: string) => (codec === 'g729' ? 'G.729' : codec)

    expect(filterVoipTrunks(trunks, 'g.729', getProviderLabel, getLabel)).toHaveLength(2)
    expect(filterVoipTrunks(trunks, 'g729', getProviderLabel)).toHaveLength(2)
  })
})

describe('getVoipTrunkForm', () => {
  it('should start from an empty form', () => {
    expect(getEmptyVoipTrunkForm()).toEqual({
      provider: '',
      name: '',
      phoneNumber: '',
      username: '',
      password: '',
      codecs: [],
      forceCodec: false,
    })
  })

  it('should prefill everything but the password', () => {
    expect(getVoipTrunkForm(trunk)).toEqual({
      provider: '',
      name: 'main_trunk',
      phoneNumber: '0721405516',
      username: 'account_98765',
      password: '',
      codecs: ['g729', 'alaw'],
      forceCodec: false,
    })
  })
})

describe('validateVoipTrunkForm', () => {
  it('should accept a complete new trunk', () => {
    expect(validateVoipTrunkForm(filledForm, { existingNames: ['backup'] })).toEqual({})
  })

  it('should require every field of a new trunk', () => {
    expect(validateVoipTrunkForm(getEmptyVoipTrunkForm(), { existingNames: [] })).toEqual({
      provider: 'trunks.voip.provider_required',
      name: 'trunks.voip.name_required',
      password: 'trunks.voip.password_required',
      phoneNumber: 'trunks.voip.phone_number_required',
      username: 'trunks.voip.username_required',
    })
  })

  it('should reject a name that cannot be a SIP endpoint name', () => {
    expect(
      validateVoipTrunkForm({ ...filledForm, name: 'Main trunk' }, { existingNames: [] }).name,
    ).toBe('trunks.voip.name_invalid')
  })

  it('should reject a name used by another trunk, ignoring case', () => {
    expect(validateVoipTrunkForm(filledForm, { existingNames: ['MAIN_TRUNK'] }).name).toBe(
      'trunks.voip.name_already_used',
    )
  })

  it('should accept spaces, dots and dashes in the phone number and reject letters', () => {
    expect(
      validateVoipTrunkForm(
        { ...filledForm, phoneNumber: '+39 02-123.4567' },
        { existingNames: [] },
      ).phoneNumber,
    ).toBeUndefined()
    expect(
      validateVoipTrunkForm({ ...filledForm, phoneNumber: '+39 02 abc' }, { existingNames: [] })
        .phoneNumber,
    ).toBe('trunks.voip.phone_number_invalid')
  })

  it('should reject a name longer than 50 characters', () => {
    expect(
      validateVoipTrunkForm({ ...filledForm, name: 'a'.repeat(51) }, { existingNames: [] }).name,
    ).toBe('trunks.voip.name_too_long')
    expect(
      validateVoipTrunkForm({ ...filledForm, name: 'a'.repeat(50) }, { existingNames: [] }).name,
    ).toBeUndefined()
  })

  it('should reject a password made only of spaces', () => {
    expect(
      validateVoipTrunkForm({ ...filledForm, password: '   ' }, { existingNames: [] }).password,
    ).toBe('trunks.voip.password_only_spaces')
    expect(
      validateVoipTrunkForm(
        { ...getVoipTrunkForm(trunk), password: '  ' },
        { trunk, existingNames: [] },
      ).password,
    ).toBe('trunks.voip.password_only_spaces')
  })

  it('should not ask a username to providers that use the trunk name', () => {
    expect(
      validateVoipTrunkForm(
        { ...filledForm, provider: 'elevenlabs', username: '' },
        { existingNames: [] },
      ),
    ).toEqual({})
  })

  it('should require a codec when codecs are forced', () => {
    expect(
      validateVoipTrunkForm({ ...filledForm, codecs: [], forceCodec: true }, { existingNames: [] }),
    ).toEqual({ codecs: 'trunks.voip.codecs_required_when_forced' })
  })

  it('should not ask name, provider and password when editing', () => {
    expect(
      validateVoipTrunkForm(getVoipTrunkForm(trunk), { trunk, existingNames: ['main_trunk'] }),
    ).toEqual({})
  })

  it('should keep an unchanged phone number of an existing trunk as it is', () => {
    const existing = { ...trunk, phoneNumber: '"Company" <0721405516>' }

    expect(
      validateVoipTrunkForm(getVoipTrunkForm(existing), { trunk: existing, existingNames: [] }),
    ).toEqual({})
  })

  it('should validate a changed phone number and a cleared username when editing', () => {
    expect(
      validateVoipTrunkForm(
        { ...getVoipTrunkForm(trunk), phoneNumber: '', username: ' ' },
        { trunk, existingNames: [] },
      ),
    ).toEqual({
      phoneNumber: 'trunks.voip.phone_number_required',
      username: 'trunks.voip.username_required',
    })
  })
})

describe('toCreateTrunkRequest', () => {
  it('should build the payload of POST /trunks', () => {
    expect(toCreateTrunkRequest({ ...filledForm, name: ' main_trunk ', forceCodec: true })).toEqual(
      {
        provider: 'twt',
        name: 'main_trunk',
        username: 'account_98765',
        password: 'Secret,1234',
        phone: '0721405516',
        codecs: ['g729'],
        forceCodec: true,
      },
    )
  })

  it('should send the phone number without separators', () => {
    expect(toCreateTrunkRequest({ ...filledForm, phoneNumber: '+39 02-123.4567' }).phone).toBe(
      '+39021234567',
    )
  })

  it('should always send codecs and forceCodec, which the API requires', () => {
    const request = toCreateTrunkRequest({ ...filledForm, codecs: [] })

    expect(request.codecs).toEqual([])
    expect(request.forceCodec).toBe(false)
  })

  it('should use the trunk name as username when the provider wants it', () => {
    expect(usesNameAsUsername('elevenlabs')).toBe(true)
    expect(usesNameAsUsername('twt')).toBe(false)
    expect(
      toCreateTrunkRequest({ ...filledForm, provider: 'elevenlabs', username: '' }).username,
    ).toBe('main_trunk')
  })
})

describe('toUpdateTrunkRequest', () => {
  const form = getVoipTrunkForm(trunk)

  it('should send nothing when nothing changed', () => {
    const request = toUpdateTrunkRequest(form, trunk)

    expect(request).toEqual({})
    expect(isEmptyUpdateTrunkRequest(request)).toBe(true)
  })

  it('should never send an empty password, which would clear the secret', () => {
    expect(toUpdateTrunkRequest({ ...form, username: 'other' }, trunk)).toEqual({
      username: 'other',
    })
  })

  it('should send the new password only when typed', () => {
    expect(toUpdateTrunkRequest({ ...form, password: 'New,5678' }, trunk)).toEqual({
      password: 'New,5678',
    })
  })

  it('should send the username with a new phone number, to keep it as SIP user', () => {
    expect(toUpdateTrunkRequest({ ...form, phoneNumber: '0612345678' }, trunk)).toEqual({
      username: 'account_98765',
      phone: '0612345678',
    })
  })

  it('should not send an empty username with a new phone number', () => {
    const withoutUsername = { ...trunk, username: '' }

    expect(
      toUpdateTrunkRequest(
        { ...getVoipTrunkForm(withoutUsername), phoneNumber: '0612345678' },
        withoutUsername,
      ),
    ).toEqual({ phone: '0612345678' })
  })

  it('should send codecs when they change or when they are forced', () => {
    expect(toUpdateTrunkRequest({ ...form, codecs: ['alaw'] }, trunk)).toEqual({
      codecs: ['alaw'],
      forceCodec: false,
    })
    expect(toUpdateTrunkRequest({ ...form, forceCodec: true }, trunk)).toEqual({
      codecs: ['g729', 'alaw'],
      forceCodec: true,
    })
  })

  it('should keep the forced codecs of a trunk without the provider defaults', () => {
    const forced = { ...trunk, codecs: ['alaw'] }
    const defaults = ['ulaw', 'alaw']
    const forcedForm = getVoipTrunkForm(forced, defaults)

    expect(forcedForm.forceCodec).toBe(true)
    expect(toUpdateTrunkRequest(forcedForm, forced, defaults)).toEqual({})
    expect(toUpdateTrunkRequest({ ...forcedForm, codecs: ['g729'] }, forced, defaults)).toEqual({
      codecs: ['g729'],
      forceCodec: true,
    })
    expect(toUpdateTrunkRequest({ ...forcedForm, forceCodec: false }, forced, defaults)).toEqual({
      codecs: ['alaw'],
      forceCodec: false,
    })
  })

  it('should not force the codecs of a trunk that has all the provider defaults', () => {
    const merged = { ...trunk, codecs: ['g729', 'ulaw', 'alaw'] }

    expect(getVoipTrunkForm(merged, ['ulaw', 'alaw']).forceCodec).toBe(false)
    expect(getVoipTrunkForm(merged).forceCodec).toBe(false)
  })

  it('should send a new phone number without separators', () => {
    expect(toUpdateTrunkRequest({ ...form, phoneNumber: '06 1234-5678' }, trunk)).toEqual({
      username: 'account_98765',
      phone: '0612345678',
    })
  })
})

describe('getAddedProviderCodecs', () => {
  it('should list the provider codecs the backend adds when the codecs are not forced', () => {
    const form = { ...filledForm, codecs: ['g729'] }

    expect(getAddedProviderCodecs(form, ['ulaw', 'alaw', 'g729'])).toEqual(['ulaw', 'alaw'])
    expect(getAddedProviderCodecs({ ...form, forceCodec: true }, ['ulaw'])).toEqual([])
    expect(getAddedProviderCodecs({ ...form, codecs: [] }, ['ulaw'])).toEqual([])
  })
})
