//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { tancredi } from './tancrediClient'
import { VariablesSchema, type ModelVariables, type ModelVariablesPatch } from './models'

export const PHONE_DEFAULTS_KEY = 'phoneDefaults'

export const PHONE_LANGUAGES = ['en', 'it']

export const PHONE_TONE_ZONES = ['us', 'it', 'es', 'uk']

export const PROVISIONING_FREQUENCIES = ['everyday', 'never'] as const

export type ProvisioningFrequency = (typeof PROVISIONING_FREQUENCIES)[number]

export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_SPECIAL_CHARACTERS = '!@#^&_?-'

const FALLBACK_WEB_PASSWORD = 'admin'

const TONE_ZONE_REGIONS: Record<string, string> = { uk: 'GB' }

export type PhoneDefaults = {
  variables: ModelVariables
  language: string
  toneZone: string
  provisioningFrequency: ProvisioningFrequency
  adminPassword: string
  userPassword: string
  encryptionByDefault: boolean
}

export type PhonePasswordKind = 'admin' | 'user'

export const DefaultPhoneConfigurationSchema = v.object({
  language: v.pipe(v.string(), v.nonEmpty('phones.settings.language_required')),
  toneZone: v.pipe(v.string(), v.nonEmpty('phones.settings.tone_zone_required')),
  provisioningFrequency: v.picklist(PROVISIONING_FREQUENCIES),
})

export type DefaultPhoneConfiguration = v.InferOutput<typeof DefaultPhoneConfigurationSchema>

export const PASSWORD_REQUIREMENTS = [
  {
    id: 'min_length',
    test: (password: string) => password.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'uppercase', test: (password: string) => /[A-Z]/.test(password) },
  { id: 'lowercase', test: (password: string) => /[a-z]/.test(password) },
  { id: 'number', test: (password: string) => /[0-9]/.test(password) },
  { id: 'special', test: (password: string) => /[!@#^&_?-]/.test(password) },
] as const

export type PasswordRequirementId = (typeof PASSWORD_REQUIREMENTS)[number]['id']

export const getUnmetPasswordRequirements = (password: string): PasswordRequirementId[] =>
  PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(password)).map(
    (requirement) => requirement.id,
  )

export const PhonePasswordSchema = v.pipe(
  v.object({
    password: v.pipe(
      v.string(),
      v.nonEmpty('phones.settings.password_required'),
      v.check(
        (password) => getUnmetPasswordRequirements(password).length === 0,
        'phones.settings.password_requirements_not_met',
      ),
    ),
    confirmPassword: v.pipe(v.string(), v.nonEmpty('phones.settings.confirm_password_required')),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'phones.settings.passwords_do_not_match',
    ),
    ['confirmPassword'],
  ),
)

export const parsePhoneDefaults = (raw: unknown): PhoneDefaults => {
  const variables = v.parse(VariablesSchema, raw)

  return {
    variables,
    language: variables.language ?? '',
    toneZone: variables.tonezone ?? '',
    provisioningFrequency: variables.provisioning_freq === 'never' ? 'never' : 'everyday',
    adminPassword: variables.adminpw ?? '',
    userPassword: variables.userpw ?? '',
    encryptionByDefault: variables.provisioning_url_scheme === 'https',
  }
}

export const getPhoneWebPassword = (defaults: PhoneDefaults | undefined): string =>
  defaults?.adminPassword || FALLBACK_WEB_PASSWORD

export const withCurrentOption = (options: string[], current: string): string[] =>
  current && !options.includes(current) ? [...options, current] : options

export const getToneZoneLabel = (toneZone: string, uiLocale: string): string => {
  const region = TONE_ZONE_REGIONS[toneZone] ?? toneZone.toUpperCase()

  try {
    return new Intl.DisplayNames([uiLocale], { type: 'region' }).of(region) ?? toneZone
  } catch {
    return toneZone
  }
}

export const getPhoneDefaults = async (): Promise<PhoneDefaults> =>
  parsePhoneDefaults(await tancredi.get('/defaults'))

export const patchPhoneDefaults = async (variables: ModelVariablesPatch): Promise<void> => {
  await tancredi.patch('/defaults', variables)
}

export const saveDefaultPhoneConfiguration = async (
  configuration: DefaultPhoneConfiguration,
): Promise<void> => {
  await patchPhoneDefaults({
    language: configuration.language,
    tonezone: configuration.toneZone,
    provisioning_freq: configuration.provisioningFrequency,
  })
}

export const changePhonePassword = async (
  kind: PhonePasswordKind,
  password: string,
): Promise<void> => {
  if (kind === 'user') {
    await patchPhoneDefaults({ userpw: password })
    return
  }
  await patchPhoneDefaults({ adminpw: password })
  await api.POST('/physicalextensions/adminpw', { body: { password } })
}
