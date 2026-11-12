//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { compareNatural, matchesText } from '@/lib/common'

export const TRUNKS_KEY = 'trunks'

const VOIP_TECHNOLOGIES = ['sip', 'pjsip']

const NAME_AS_USERNAME_PROVIDERS = ['elevenlabs']

const TRUNK_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/

const PHONE_NUMBER_PATTERN = /^\+?[0-9]+$/

const TrunkIdSchema = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.regex(/^\d+$/))]),
  v.transform(Number),
  v.integer(),
)

const TrunkDetailsSchema = v.object({
  codecs: v.nullish(v.string(), ''),
  sip_server: v.nullish(v.string(), ''),
})

const TrunkResponseSchema = v.object({
  trunkid: TrunkIdSchema,
  tech: v.string(),
  name: v.nullish(v.string(), ''),
  outcid: v.nullish(v.string(), ''),
  provider: v.nullish(v.string(), ''),
  disabled: v.nullish(v.string(), 'off'),
  username: v.nullish(v.string(), ''),
  details: v.nullish(v.union([TrunkDetailsSchema, v.literal(false)])),
})

const TrunksResponseSchema = v.array(TrunkResponseSchema)

export type Trunk = {
  id: number
  name: string
  technology: string
  phoneNumber: string
  username: string
  provider: string
  sipServer: string
  codecs: string[]
  disabled: boolean
}

export type VoipTrunkForm = {
  provider: string
  name: string
  phoneNumber: string
  username: string
  password: string
  codecs: string[]
  forceCodec: boolean
}

export type VoipTrunkField =
  'provider' | 'name' | 'phoneNumber' | 'username' | 'password' | 'codecs'

export type VoipTrunkValidationIssues = Partial<Record<VoipTrunkField, string>>

export type CreateTrunkRequest = components['schemas']['TrunkCreateRequest']

export type UpdateTrunkRequest = components['schemas']['TrunkUpdateRequest']

export const splitCodecs = (codecs: string): string[] =>
  codecs
    .split(',')
    .map((codec) => codec.trim())
    .filter((codec) => codec !== '')

export const parseTrunks = (raw: unknown): Trunk[] =>
  v
    .parse(TrunksResponseSchema, raw)
    .map((trunk) => {
      const details = trunk.details || { codecs: '', sip_server: '' }

      return {
        id: trunk.trunkid,
        name: trunk.name,
        technology: trunk.tech.toLowerCase(),
        phoneNumber: trunk.outcid,
        username: trunk.username,
        provider: trunk.provider,
        sipServer: details.sip_server,
        codecs: splitCodecs(details.codecs),
        disabled: trunk.disabled === 'on',
      }
    })
    .sort((a, b) => compareNatural(a.name, b.name))

export const getTrunks = async (): Promise<Trunk[]> => {
  const { data } = await api.GET('/trunks')
  return parseTrunks(data)
}

export const isVoipTrunk = (trunk: Trunk): boolean => VOIP_TECHNOLOGIES.includes(trunk.technology)

export const getVoipTrunks = (trunks: Trunk[], gatewayTrunkIds: number[]): Trunk[] =>
  trunks.filter((trunk) => isVoipTrunk(trunk) && !gatewayTrunkIds.includes(trunk.id))

export const filterVoipTrunks = (
  trunks: Trunk[],
  textFilter: string,
  getProviderLabel: (trunk: Trunk) => string,
): Trunk[] =>
  trunks.filter((trunk) =>
    matchesText(
      textFilter,
      trunk.name,
      trunk.phoneNumber,
      trunk.username,
      getProviderLabel(trunk),
      trunk.codecs.join(' '),
    ),
  )

export const usesNameAsUsername = (provider: string): boolean =>
  NAME_AS_USERNAME_PROVIDERS.includes(provider)

export const getEmptyVoipTrunkForm = (): VoipTrunkForm => ({
  provider: '',
  name: '',
  phoneNumber: '',
  username: '',
  password: '',
  codecs: [],
  forceCodec: false,
})

export const getVoipTrunkForm = (trunk: Trunk): VoipTrunkForm => ({
  provider: trunk.provider,
  name: trunk.name,
  phoneNumber: trunk.phoneNumber,
  username: trunk.username,
  password: '',
  codecs: [...trunk.codecs],
  forceCodec: false,
})

const hasSameCodecs = (first: string[], second: string[]): boolean =>
  first.length === second.length && first.every((codec, index) => codec === second[index])

export const validateVoipTrunkForm = (
  form: VoipTrunkForm,
  options: { trunk?: Trunk; existingNames: string[] },
): VoipTrunkValidationIssues => {
  const issues: VoipTrunkValidationIssues = {}
  const { trunk, existingNames } = options
  const name = form.name.trim()
  const phoneNumber = form.phoneNumber.trim()

  if (!trunk) {
    if (!form.provider) {
      issues.provider = 'trunks.voip.provider_required'
    }

    if (!name) {
      issues.name = 'trunks.voip.name_required'
    } else if (!TRUNK_NAME_PATTERN.test(name)) {
      issues.name = 'trunks.voip.name_invalid'
    } else if (existingNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      issues.name = 'trunks.voip.name_already_used'
    }

    if (!form.password) {
      issues.password = 'trunks.voip.password_required'
    }
  }

  if (!trunk || phoneNumber !== trunk.phoneNumber) {
    if (!phoneNumber) {
      issues.phoneNumber = 'trunks.voip.phone_number_required'
    } else if (!PHONE_NUMBER_PATTERN.test(phoneNumber)) {
      issues.phoneNumber = 'trunks.voip.phone_number_invalid'
    }
  }

  const usernameRequired = trunk ? trunk.username !== '' : !usesNameAsUsername(form.provider)

  if (usernameRequired && !form.username.trim()) {
    issues.username = 'trunks.voip.username_required'
  }

  if (form.forceCodec && form.codecs.length === 0) {
    issues.codecs = 'trunks.voip.codecs_required_when_forced'
  }
  return issues
}

export const toCreateTrunkRequest = (form: VoipTrunkForm): CreateTrunkRequest => {
  const name = form.name.trim()

  return {
    provider: form.provider,
    name,
    username: usesNameAsUsername(form.provider) ? name : form.username.trim(),
    password: form.password,
    phone: form.phoneNumber.trim(),
    codecs: form.codecs,
    forceCodec: form.forceCodec,
  }
}

export const toUpdateTrunkRequest = (form: VoipTrunkForm, trunk: Trunk): UpdateTrunkRequest => {
  const request: UpdateTrunkRequest = {}
  const username = form.username.trim()
  const phoneNumber = form.phoneNumber.trim()
  const phoneNumberChanged = phoneNumber !== trunk.phoneNumber

  if (username !== trunk.username || (phoneNumberChanged && username !== '')) {
    request.username = username
  }

  if (form.password) {
    request.password = form.password
  }

  if (phoneNumberChanged) {
    request.phone = phoneNumber
  }

  if (form.forceCodec || !hasSameCodecs(form.codecs, trunk.codecs)) {
    request.codecs = form.codecs
    request.forceCodec = form.forceCodec
  }
  return request
}

export const isEmptyUpdateTrunkRequest = (request: UpdateTrunkRequest): boolean =>
  Object.keys(request).length === 0

export const postTrunk = async (request: CreateTrunkRequest): Promise<void> => {
  await api.POST('/trunks', { body: request })
}

export const patchTrunk = async (trunkId: number, request: UpdateTrunkRequest): Promise<void> => {
  await api.PATCH('/trunks/{trunkid}', {
    params: { path: { trunkid: String(trunkId) } },
    body: request,
  })
}

export const deleteTrunk = async (trunkId: number): Promise<void> => {
  await api.DELETE('/trunks/{trunkid}', { params: { path: { trunkid: String(trunkId) } } })
}
