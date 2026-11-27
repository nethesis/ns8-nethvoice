//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/en/translation.json'
import it_ from '@/i18n/it/translation.json'
import {
  describeImportProblem,
  describeImportProblems,
  IMPORT_PROBLEMS_SHOWN,
  KNOWN_IMPORT_PROBLEMS,
} from './importErrors'

const translator = (locale: 'en' | 'it') => {
  const i18n = createI18n({ legacy: false, locale, messages: { en, it: it_ } })
  return (key: string, values?: Record<string, unknown>) => i18n.global.t(key, values ?? {})
}

describe('describeImportProblem', () => {
  const t = translator('en')

  it('names the row of the file and the user, never the raw server text', () => {
    const rows = [4, 7, 9]

    expect(
      describeImportProblem(
        { code: 'extension_failed', line: 2, username: 'a.miller', extension: '201' },
        t,
        (line) => rows[line - 1],
      ),
    ).toBe('Row 7 (a.miller): extension 201 could not be assigned.')
    expect(
      describeImportProblem({ code: 'missing_name', line: 3 }, t, (line) => rows[line - 1]),
    ).toBe('Row 9: username and name are required.')
    expect(
      describeImportProblem(
        { code: 'protected_account', line: 5, username: 'd.jones' },
        t,
        () => undefined,
      ),
    ).toBe("d.jones: this account can't be managed here.")
    expect(describeImportProblem({ code: 'sync_failed' }, t)).toBe(
      'the users could not be synchronized with the PBX, try again',
    )
  })

  it('falls back to a generic reason for an unknown code', () => {
    expect(describeImportProblem({ code: 'something_new', username: 'a.b' }, t)).toBe(
      'a.b: the import ended with an error.',
    )
  })

  it('has a translation of every known problem in English and Italian', () => {
    for (const locale of ['en', 'it'] as const) {
      const translate = translator(locale)

      for (const code of KNOWN_IMPORT_PROBLEMS) {
        const text = describeImportProblem({ code, group: 'Sales', profile: 'Base' }, translate)

        expect(text).not.toContain('users.import_problem')
        expect(text).not.toMatch(/Error|CSV line/)
      }
    }
    expect(describeImportProblem({ code: 'missing_name', line: 1 }, translator('it'))).toBe(
      'Riga 1: nome utente e nome sono obbligatori.',
    )
  })
})

describe('describeImportProblems', () => {
  it('shows the first problems and counts the others', () => {
    const t = translator('en')
    const problems = Array.from({ length: IMPORT_PROBLEMS_SHOWN + 2 }, (_, index) => ({
      code: 'create_failed',
      line: index + 1,
      username: `u${index + 1}`,
    }))
    const text = describeImportProblems(problems, t)

    expect(text).toContain('Row 1 (u1): the account provider did not create the user.')
    expect(text).not.toContain('(u6)')
    expect(text.endsWith('+ 2 more')).toBe(true)
  })
})
