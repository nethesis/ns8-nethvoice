//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'

export const PBX_LANGUAGES_KEY = 'pbxLanguages'
export const PBX_COUNTRIES_KEY = 'pbxCountries'

const LanguagesResponseSchema = v.record(v.string(), v.object({ default: v.boolean() }))

const CountriesResponseSchema = v.array(v.string())

export type PbxLanguages = {
  languages: string[]
  defaultLanguage: string
}

export const SystemSettingsSchema = v.object({
  country: v.pipe(v.string(), v.nonEmpty('setup.system.country_required')),
  language: v.pipe(v.string(), v.nonEmpty('setup.system.language_required')),
})

export type SystemSettings = v.InferOutput<typeof SystemSettingsSchema>

export const parsePbxLanguages = (raw: unknown): PbxLanguages => {
  const entries = Object.entries(v.parse(LanguagesResponseSchema, raw))

  return {
    languages: entries.map(([language]) => language),
    defaultLanguage: entries.find(([, value]) => value.default)?.[0] ?? '',
  }
}

export const getPbxLanguages = async (): Promise<PbxLanguages> => {
  const { data } = await api.GET('/settings/languages')
  return parsePbxLanguages(data)
}

export const postPbxDefaultLanguage = async (language: string): Promise<void> => {
  await api.POST('/settings/defaultlanguage', { body: { lang: language } })
}

export const getPbxCountries = async (): Promise<string[]> => {
  const { data } = await api.GET('/outboundroutes/supportedLocales')
  return v.parse(CountriesResponseSchema, data)
}

const COUNTRY_REGION_BY_LOCALE: Record<string, string> = {
  en: 'US',
}

export const getCountryLabel = (pbxLocale: string, uiLocale: string): string => {
  const region = COUNTRY_REGION_BY_LOCALE[pbxLocale] ?? pbxLocale.toUpperCase()

  try {
    return new Intl.DisplayNames([uiLocale], { type: 'region' }).of(region) ?? pbxLocale
  } catch {
    return pbxLocale
  }
}

export const getLanguageLabel = (language: string): string => {
  try {
    const label = new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch {
    return language
  }
}
