//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'

export type FieldIssues = Record<string, string>

export const requiredText = (message: string) => v.pipe(v.string(), v.trim(), v.nonEmpty(message))

export const PortSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('integrations.port_required'),
  v.regex(/^\d{1,5}$/, 'integrations.port_invalid'),
  v.check((port) => Number(port) >= 1 && Number(port) <= 65535, 'integrations.port_invalid'),
)

export const HttpUrlSchema = (requiredMessage: string, invalidMessage: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(requiredMessage),
    v.regex(/^https?:\/\/[^\s/]+\S*$/i, invalidMessage),
  )

export const collectFieldIssues = (
  issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]],
): FieldIssues => {
  const fieldIssues: FieldIssues = {}

  for (const [field, messages] of Object.entries(v.flatten(issues).nested ?? {})) {
    const [message] = messages ?? []

    if (message) {
      fieldIssues[field] = message
    }
  }
  return fieldIssues
}

export const validateForm = <TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown,
): FieldIssues => {
  const result = v.safeParse(schema, input)
  return result.success ? {} : collectFieldIssues(result.issues)
}
