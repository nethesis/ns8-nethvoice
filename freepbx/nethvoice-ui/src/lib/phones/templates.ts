//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { compareNatural } from '@/lib/common'
import { isApiError } from '@/lib/api/errors'
import { getOriginalPhoneModel, type PhoneModel } from './models'
import { getTancrediProblemType, tancredi } from './tancrediClient'

export const PHONE_TEMPLATES_KEY = 'phoneTemplates'
export const STANDARD_TEMPLATE_KEY = 'phoneStandardTemplate'

export const TEMPLATE_MAX_SIZE = 524288

const TEMPLATE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.tmpl$/

export type PhoneTemplate = {
  name: string
  size: number
  lastUpdate: number | null
}

export type TemplateImportIssue = {
  key: string
  params?: Record<string, unknown>
}

const TemplateSchema = v.object({
  name: v.string(),
  size: v.nullish(v.number(), 0),
  mtime: v.nullish(v.number(), null),
})

const TemplatesResponseSchema = v.array(TemplateSchema)

const toPhoneTemplate = (template: v.InferOutput<typeof TemplateSchema>): PhoneTemplate => ({
  name: template.name,
  size: template.size,
  lastUpdate: template.mtime === null ? null : template.mtime * 1000,
})

const FILE_PROBLEMS: Record<string, string> = {
  'invalid-file-name': 'phones.templates.invalid_name',
  'file-too-large': 'phones.templates.file_too_large',
  'invalid-encoding': 'phones.templates.not_text',
  'malformed-data': 'phones.templates.empty_file',
  'shipped-template': 'phones.templates.shipped_name',
  'template-exists': 'phones.templates.name_exists',
}

export const isValidTemplateName = (name: string): boolean => TEMPLATE_NAME_PATTERN.test(name)

export const getTemplateFileIssue = (file: File): string => {
  if (!isValidTemplateName(file.name)) {
    return 'phones.templates.invalid_name'
  }

  if (file.size === 0) {
    return 'phones.templates.empty_file'
  }
  return file.size > TEMPLATE_MAX_SIZE ? 'phones.templates.file_too_large' : ''
}

const readBytes = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })

export const readTemplateContent = async (file: File): Promise<string | null> => {
  try {
    const bytes = new Uint8Array(await readBytes(file))
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return content.includes('\0') ? null : content
  } catch {
    return null
  }
}

export const getTemplateImportIssue = (error: unknown): TemplateImportIssue | null => {
  if (!isApiError(error) || error.status >= 500) {
    return null
  }
  const type = getTancrediProblemType(error.body)

  if (type === 'template-syntax-error') {
    const body = error.body as { line?: unknown; detail?: unknown }
    return {
      key: 'phones.templates.syntax_error',
      params: {
        line: typeof body.line === 'number' ? body.line : '-',
        detail: typeof body.detail === 'string' ? body.detail : '',
      },
    }
  }
  const key = FILE_PROBLEMS[type]
  return key ? { key } : null
}

export const parsePhoneTemplates = (raw: unknown): PhoneTemplate[] =>
  v
    .parse(TemplatesResponseSchema, raw ?? [])
    .map(toPhoneTemplate)
    .sort((a, b) => compareNatural(a.name, b.name))

export const getBaseModelName = (name: string, models: PhoneModel[]): string =>
  models
    .filter((model) => !model.custom && (model.name === name || name.startsWith(`${model.name}-`)))
    .map((model) => model.name)
    .sort((a, b) => b.length - a.length)[0] ?? ''

export const getPhoneTemplates = async (): Promise<PhoneTemplate[]> =>
  parsePhoneTemplates(await tancredi.get('/templates'))

export const getStandardTemplate = async (modelName: string, models: PhoneModel[]) => {
  const base = getBaseModelName(modelName, models)
  return base ? ((await getOriginalPhoneModel(base)).variables.tmpl_phone ?? '') : ''
}

export class TemplateFileNotTextError extends Error {}

export const importPhoneTemplate = async (file: File, replace: boolean): Promise<PhoneTemplate> => {
  const content = await readTemplateContent(file)

  if (content === null) {
    throw new TemplateFileNotTextError()
  }
  return toPhoneTemplate(
    v.parse(
      TemplateSchema,
      await tancredi.post('/templates', { name: file.name, content, replace }),
    ),
  )
}
