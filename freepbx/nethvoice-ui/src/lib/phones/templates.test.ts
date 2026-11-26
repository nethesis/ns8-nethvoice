//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import type { PhoneModel } from './models'
import {
  getBaseModelName,
  getTemplateFileIssue,
  getTemplateImportIssue,
  isValidTemplateName,
  parsePhoneTemplates,
  readTemplateContent,
  TEMPLATE_MAX_SIZE,
} from './templates'

const model = (name: string, custom: boolean): PhoneModel => ({
  name,
  displayName: name,
  brand: '',
  custom,
  lastUpdate: null,
})

const problem = (status: number, type: string, extra: Record<string, unknown> = {}) =>
  new ApiError({
    status,
    method: 'POST',
    url: '/tancredi/api/v1/templates',
    body: { type: `https://nethesis.github.io/tancredi/problems/#${type}`, title: 'x', ...extra },
  })

const file = (name: string, content: BlobPart = 'x', size?: number) => {
  const result = new File([content], name)

  if (size !== undefined) {
    Object.defineProperty(result, 'size', { value: size })
  }
  return result
}

describe('isValidTemplateName', () => {
  it('accepts the names Tancredi stores as custom templates', () => {
    expect(isValidTemplateName('custom.tmpl')).toBe(true)
    expect(isValidTemplateName('Yealink_T46-reception.v2.tmpl')).toBe(true)
    expect(isValidTemplateName(`${'a'.repeat(95)}.tmpl`)).toBe(true)
  })

  it('refuses paths, hidden files, other extensions and long names', () => {
    for (const name of [
      '',
      '.tmpl',
      '.hidden.tmpl',
      '../custom.tmpl',
      'dir/custom.tmpl',
      'custom.macros',
      'custom.tmpl.txt',
      'cust om.tmpl',
      'cüstom.tmpl',
      `${'a'.repeat(96)}.tmpl`,
    ]) {
      expect(isValidTemplateName(name), name).toBe(false)
    }
  })
})

describe('getTemplateFileIssue', () => {
  it('accepts a template within the limits', () => {
    expect(getTemplateFileIssue(file('custom.tmpl', 'x', TEMPLATE_MAX_SIZE))).toBe('')
  })

  it('reports a wrong name, an empty file and a file too large', () => {
    expect(getTemplateFileIssue(file('custom.txt'))).toBe('phones.templates.invalid_name')
    expect(getTemplateFileIssue(file('custom.tmpl', ''))).toBe('phones.templates.empty_file')
    expect(getTemplateFileIssue(file('custom.tmpl', 'x', TEMPLATE_MAX_SIZE + 1))).toBe(
      'phones.templates.file_too_large',
    )
  })
})

describe('readTemplateContent', () => {
  it('reads UTF-8 text', async () => {
    await expect(readTemplateContent(file('custom.tmpl', 'città = {{ x }}\n'))).resolves.toBe(
      'città = {{ x }}\n',
    )
  })

  it('refuses binary files and other encodings', async () => {
    await expect(
      readTemplateContent(file('custom.tmpl', new Uint8Array([0x61, 0xff]))),
    ).resolves.toBe(null)
    await expect(
      readTemplateContent(file('custom.tmpl', new Uint8Array([0x61, 0, 0x62]))),
    ).resolves.toBe(null)
  })
})

describe('getTemplateImportIssue', () => {
  it('shows the line and the message of a syntax error', () => {
    expect(
      getTemplateImportIssue(
        problem(400, 'template-syntax-error', { line: 3, detail: 'Unexpected "}".' }),
      ),
    ).toEqual({
      key: 'phones.templates.syntax_error',
      params: { line: 3, detail: 'Unexpected "}".' },
    })
  })

  it('maps the other problems of the file to a message', () => {
    expect(getTemplateImportIssue(problem(400, 'invalid-file-name'))?.key).toBe(
      'phones.templates.invalid_name',
    )
    expect(getTemplateImportIssue(problem(413, 'file-too-large'))?.key).toBe(
      'phones.templates.file_too_large',
    )
    expect(getTemplateImportIssue(problem(400, 'invalid-encoding'))?.key).toBe(
      'phones.templates.not_text',
    )
    expect(getTemplateImportIssue(problem(409, 'shipped-template'))?.key).toBe(
      'phones.templates.shipped_name',
    )
    expect(getTemplateImportIssue(problem(409, 'template-exists'))?.key).toBe(
      'phones.templates.name_exists',
    )
  })

  it('leaves the other errors to the error notification', () => {
    expect(getTemplateImportIssue(problem(403, 'forbidden'))).toBeNull()
    expect(getTemplateImportIssue(problem(500, 'template-syntax-error'))).toBeNull()
    expect(getTemplateImportIssue(new Error('offline'))).toBeNull()
  })
})

describe('parsePhoneTemplates', () => {
  it('sorts the templates and converts the time', () => {
    expect(
      parsePhoneTemplates([
        { name: 'b.tmpl', size: 10, mtime: 1767225600 },
        { name: 'a.tmpl', size: 5, mtime: null },
      ]),
    ).toEqual([
      { name: 'a.tmpl', size: 5, lastUpdate: null },
      { name: 'b.tmpl', size: 10, lastUpdate: 1767225600000 },
    ])
  })
})

describe('getBaseModelName', () => {
  const models = [
    model('yealink-T46', false),
    model('fanvil-X3SG', false),
    model('fanvil-X3SG-PRO', false),
    model('yealink-T46-Front-office', true),
  ]

  it('finds the shipped model a custom model was created from', () => {
    expect(getBaseModelName('yealink-T46-Front-office', models)).toBe('yealink-T46')
    expect(getBaseModelName('fanvil-X3SG-PRO-reception', models)).toBe('fanvil-X3SG-PRO')
  })

  it('returns a shipped model itself and nothing for an unknown base', () => {
    expect(getBaseModelName('yealink-T46', models)).toBe('yealink-T46')
    expect(getBaseModelName('snom-D785-desk', models)).toBe('')
  })
})
