//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { compareNatural } from '@/lib/common'
import { tancredi } from './tancrediClient'

export const PHONE_MODELS_KEY = 'phoneModels'
export const PHONE_MODEL_KEY = 'phoneModel'

export const MODEL_NAME_MAX_LENGTH = 64

const CUSTOM_MODEL_NAME_EXCEPTIONS = ['fanvil-X3SG-PRO']

export type ModelVariables = Record<string, string>

export type ModelVariablesPatch = Record<string, string | null>

export type PhoneModel = {
  name: string
  displayName: string
  brand: string
  custom: boolean
}

export type PhoneModelDetail = PhoneModel & {
  variables: ModelVariables
}

export type PhoneModelRow = PhoneModel & {
  phones: number
}

export type PhoneModelType = 'default' | 'custom'

const VariableValueSchema = v.nullable(v.union([v.string(), v.number(), v.boolean()]))

export const VariablesSchema = v.pipe(
  v.nullish(v.union([v.array(v.unknown()), v.record(v.string(), VariableValueSchema)]), {}),
  v.transform((variables): ModelVariables => {
    const result: ModelVariables = {}

    if (Array.isArray(variables)) {
      return result
    }

    for (const [name, value] of Object.entries(variables)) {
      result[name] = value === null ? '' : String(value)
    }
    return result
  }),
)

const ModelSummarySchema = v.object({
  name: v.string(),
  display_name: v.nullish(v.string(), ''),
})

const ModelsResponseSchema = v.array(ModelSummarySchema)

const ModelDetailSchema = v.object({
  name: v.string(),
  display_name: v.nullish(v.string(), ''),
  variables: VariablesSchema,
})

export const NewPhoneModelSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('phones.models.name_required'),
    v.maxLength(MODEL_NAME_MAX_LENGTH, 'phones.models.name_too_long'),
  ),
  baseModel: v.pipe(v.string(), v.nonEmpty('phones.models.base_model_required')),
})

export type NewPhoneModel = v.InferOutput<typeof NewPhoneModelSchema>

export const getModelBrand = (name: string): string => {
  const prefix = name.split('-')[0] ?? ''
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

export const isCustomModelName = (name: string): boolean =>
  name.split('-').length > 2 && !CUSTOM_MODEL_NAME_EXCEPTIONS.includes(name)

export const sanitizeModelName = (name: string): string => name.replace(/[^A-Za-z0-9._-]/g, '_')

export const buildCustomModelName = (baseModel: string, label: string): string =>
  sanitizeModelName(`${baseModel}-${label.trim()}`)

const toPhoneModel = (model: v.InferOutput<typeof ModelSummarySchema>): PhoneModel => ({
  name: model.name,
  displayName: model.display_name.trim().replace(/;+$/, '').trim() || model.name,
  brand: getModelBrand(model.name),
  custom: isCustomModelName(model.name),
})

export const parsePhoneModels = (raw: unknown): PhoneModel[] =>
  v
    .parse(ModelsResponseSchema, raw)
    .map(toPhoneModel)
    .sort((a, b) => compareNatural(a.displayName, b.displayName))

export const parsePhoneModelDetail = (raw: unknown): PhoneModelDetail => {
  const model = v.parse(ModelDetailSchema, raw)
  return { ...toPhoneModel(model), variables: model.variables }
}

export const filterModelsByVendor = (models: PhoneModel[], vendor: string): PhoneModel[] => {
  const prefix = vendor.trim().toLowerCase()

  if (!prefix) {
    return models
  }
  const matching = models.filter((model) => model.name.toLowerCase().startsWith(`${prefix}-`))

  return matching.length > 0 ? matching : models
}

const NETHESIS_MODELS_BY_MAC_BYTE: Record<string, string> = {
  '00': 'nethesis-NPX3',
  '01': 'nethesis-NPX5',
  '02': 'nethesis-NPX210',
  '03': 'nethesis-NPV61',
  '04': 'nethesis-NPX5',
  '05': 'nethesis-NPV64',
}

export const guessModelName = (mac: string, vendor: string, models: PhoneModel[]): string => {
  const candidates = filterModelsByVendor(models, vendor)

  if (vendor.toLowerCase() === 'nethesis') {
    const byte = mac.replace(/[:.-]/g, '').toUpperCase().slice(6, 8)
    const name = NETHESIS_MODELS_BY_MAC_BYTE[byte]

    if (name && candidates.some((model) => model.name === name)) {
      return name
    }
  }
  return vendor && candidates.length === 1 ? (candidates[0]?.name ?? '') : ''
}

export const buildModelRows = (models: PhoneModel[], phoneModels: string[]): PhoneModelRow[] => {
  const phonesByModel = new Map<string, number>()

  for (const name of phoneModels) {
    phonesByModel.set(name, (phonesByModel.get(name) ?? 0) + 1)
  }

  return models
    .filter((model) => model.custom || phonesByModel.has(model.name))
    .map((model) => ({ ...model, phones: phonesByModel.get(model.name) ?? 0 }))
}

export const isDisplayNameTaken = (models: PhoneModel[], displayName: string): boolean => {
  const needle = displayName.trim().toLowerCase()
  return models.some((model) => model.displayName.toLowerCase() === needle)
}

export const getDuplicateDisplayName = (
  models: PhoneModel[],
  displayName: string,
  copyLabel: string,
): string => {
  const base = `${displayName} ${copyLabel}`
  let candidate = base
  let index = 2

  while (isDisplayNameTaken(models, candidate)) {
    candidate = `${base} ${index}`
    index += 1
  }
  return candidate
}

export const buildResetVariables = (
  current: ModelVariables,
  original: ModelVariables,
): ModelVariablesPatch => {
  const patch: ModelVariablesPatch = { ...original }

  for (const name of Object.keys(current)) {
    if (!(name in original)) {
      patch[name] = null
    }
  }
  return patch
}

const modelPath = (name: string) => `/models/${encodeURIComponent(name)}`

export const getPhoneModels = async (): Promise<PhoneModel[]> =>
  parsePhoneModels(await tancredi.get('/models'))

export const getPhoneModel = async (name: string): Promise<PhoneModelDetail> =>
  parsePhoneModelDetail(await tancredi.get(modelPath(name)))

export const getOriginalPhoneModel = async (name: string): Promise<PhoneModelDetail> =>
  parsePhoneModelDetail(await tancredi.get(`${modelPath(name)}/version/original`))

export const patchPhoneModelVariables = async (
  name: string,
  variables: ModelVariablesPatch,
): Promise<void> => {
  await tancredi.patch(modelPath(name), { variables })
}

export const deletePhoneModel = async (name: string): Promise<void> => {
  await tancredi.delete(modelPath(name))
}

export const createPhoneModelFrom = async (newModel: NewPhoneModel): Promise<PhoneModel> => {
  const base = await getPhoneModel(newModel.baseModel)
  const created = await tancredi.post('/models', {
    name: buildCustomModelName(newModel.baseModel, newModel.name),
    display_name: newModel.name.trim(),
    variables: base.variables,
  })

  return parsePhoneModelDetail(created)
}

export const resetPhoneModel = async (name: string): Promise<void> => {
  const [current, original] = await Promise.all([getPhoneModel(name), getOriginalPhoneModel(name)])
  await patchPhoneModelVariables(name, buildResetVariables(current.variables, original.variables))
}
