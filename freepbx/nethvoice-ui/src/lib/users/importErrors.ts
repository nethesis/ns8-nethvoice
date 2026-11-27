//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { CsvImportProblem } from '@/lib/users/csv'

export const IMPORT_PROBLEMS_SHOWN = 5

export const KNOWN_IMPORT_PROBLEMS = [
  'control_characters',
  'missing_name',
  'provider_unavailable',
  'protected_account',
  'create_failed',
  'sync_failed',
  'user_not_found',
  'extension_failed',
  'device_failed',
  'mobile_failed',
  'voicemail_failed',
  'webrtc_failed',
  'groups_failed',
  'group_name_invalid',
  'profile_failed',
  'nethlink_failed',
  'invalid_input',
  'stopped',
] as const

type Translate = (key: string, values?: Record<string, unknown>) => string

const problemKey = (code: string): string =>
  (KNOWN_IMPORT_PROBLEMS as readonly string[]).includes(code)
    ? `users.import_problem_${code}`
    : 'users.import_problem_import_failed'

export const describeImportProblem = (
  problem: CsvImportProblem,
  t: Translate,
  rowOfLine: (line: number) => number | undefined = (line) => line,
): string => {
  const reason = t(problemKey(problem.code), {
    extension: problem.extension ?? '',
    group: problem.group ?? '',
    profile: problem.profile ?? '',
  })
  const row = problem.line === undefined ? undefined : rowOfLine(problem.line)

  if (row !== undefined && problem.username) {
    return t('users.import_problem_row_user', { row, username: problem.username, reason })
  }
  if (row !== undefined) {
    return t('users.import_problem_row', { row, reason })
  }
  if (problem.username) {
    return t('users.import_problem_user', { username: problem.username, reason })
  }
  return reason
}

export const describeImportProblems = (
  problems: CsvImportProblem[],
  t: Translate,
  rowOfLine?: (line: number) => number | undefined,
): string => {
  const shown = problems
    .slice(0, IMPORT_PROBLEMS_SHOWN)
    .map((problem) => describeImportProblem(problem, t, rowOfLine))
  const hidden = problems.length - shown.length

  return [...shown, ...(hidden > 0 ? [t('common.plus_n_more', { count: hidden })] : [])].join(' ')
}
