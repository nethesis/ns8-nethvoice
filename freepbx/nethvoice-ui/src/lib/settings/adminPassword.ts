//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { postTestAuth } from '@/lib/auth'

export const ADMIN_USERNAME = 'admin'

export const ADMIN_PASSWORD_MIN_LENGTH = 8

export const ADMIN_PASSWORD_REQUIREMENTS = [
  {
    key: 'min_length',
    validate: (password: string) => password.length >= ADMIN_PASSWORD_MIN_LENGTH,
  },
  { key: 'uppercase', validate: (password: string) => /[A-Z]/.test(password) },
  { key: 'lowercase', validate: (password: string) => /[a-z]/.test(password) },
  { key: 'number', validate: (password: string) => /[0-9]/.test(password) },
  {
    key: 'special_character',
    validate: (password: string) => /[^\p{L}\p{N}\s]/u.test(password),
  },
] as const

export const isStrongAdminPassword = (password: string): boolean =>
  ADMIN_PASSWORD_REQUIREMENTS.every((requirement) => requirement.validate(password))

export const ChangeAdminPasswordSchema = v.pipe(
  v.object({
    currentPassword: v.pipe(v.string(), v.nonEmpty('settings.current_password_required')),
    newPassword: v.pipe(
      v.string(),
      v.nonEmpty('settings.new_password_required'),
      v.check(isStrongAdminPassword, 'settings.new_password_requirements_not_met'),
    ),
    confirmPassword: v.pipe(v.string(), v.nonEmpty('settings.confirm_password_required')),
  }),
  v.forward(
    v.partialCheck(
      [['currentPassword'], ['newPassword']],
      (input) => input.currentPassword !== input.newPassword,
      'settings.new_password_must_be_different',
    ),
    ['newPassword'],
  ),
  v.forward(
    v.partialCheck(
      [['newPassword'], ['confirmPassword']],
      (input) => input.newPassword === input.confirmPassword,
      'settings.passwords_do_not_match',
    ),
    ['confirmPassword'],
  ),
)

export type ChangeAdminPasswordForm = v.InferOutput<typeof ChangeAdminPasswordSchema>

export type ChangeAdminPasswordField = keyof ChangeAdminPasswordForm

export class WrongCurrentPasswordError extends Error {
  constructor() {
    super('settings.current_password_wrong')
    this.name = 'WrongCurrentPasswordError'
  }
}

export const isWrongCurrentPasswordError = (error: unknown): error is WrongCurrentPasswordError =>
  error instanceof WrongCurrentPasswordError

export const getChangeAdminPasswordIssues = (
  form: ChangeAdminPasswordForm,
): Partial<Record<ChangeAdminPasswordField, string>> => {
  const result = v.safeParse(ChangeAdminPasswordSchema, form)
  const issues: Partial<Record<ChangeAdminPasswordField, string>> = {}

  if (result.success) {
    return issues
  }

  for (const issue of result.issues) {
    const field = issue.path?.[0].key

    if (
      (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword') &&
      !issues[field]
    ) {
      issues[field] = issue.message
    }
  }
  return issues
}

const verifyAdminPassword = async (password: string): Promise<void> => {
  try {
    await postTestAuth(ADMIN_USERNAME, password)
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      await api.GET('/login').catch(() => undefined)
      throw new WrongCurrentPasswordError()
    }
    throw error
  }
}

export const changeAdminPassword = async (form: ChangeAdminPasswordForm): Promise<void> => {
  await verifyAdminPassword(form.currentPassword)
  await api.POST('/users/{username}/password', {
    params: { path: { username: ADMIN_USERNAME } },
    body: { password: form.newPassword },
  })
}
