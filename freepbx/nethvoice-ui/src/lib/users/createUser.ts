//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { runCsvImport, serializeCsv, USERNAME_REGEX } from '@/lib/users/csv'
import { isValidExtension } from '@/lib/users/extensions'
import {
  applyUserSettingsSteps,
  planUserSettingsUpdate,
  type UserSettings,
} from '@/lib/users/userSettings'
import {
  findUserByExtension,
  findUserByUsername,
  getSoftwareDeviceTypes,
  getUsers,
  type User,
} from '@/lib/users/users'

export const PASSWORD_MIN_LENGTH = 8

export type PasswordRuleKey = 'min_length' | 'uppercase' | 'lowercase' | 'number' | 'special'

export const PASSWORD_RULES: { key: PasswordRuleKey; validate: (password: string) => boolean }[] = [
  { key: 'min_length', validate: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', validate: (password) => /[A-Z]/.test(password) },
  { key: 'lowercase', validate: (password) => /[a-z]/.test(password) },
  { key: 'number', validate: (password) => /[0-9]/.test(password) },
  { key: 'special', validate: (password) => /[^A-Za-z0-9\s]/.test(password) },
]

export const isValidPassword = (password: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.validate(password))

const MOBILE_NUMBER_REGEX = /^\+?[0-9 ().-]*$/

export const NewUserSchema = v.pipe(
  v.object({
    username: v.pipe(
      v.string(),
      v.trim(),
      v.toLowerCase(),
      v.nonEmpty('users.username_required'),
      v.regex(USERNAME_REGEX, 'users.username_invalid'),
    ),
    name: v.pipe(v.string(), v.trim(), v.nonEmpty('users.name_required')),
    surname: v.pipe(v.string(), v.trim(), v.nonEmpty('users.surname_required')),
    password: v.pipe(
      v.string(),
      v.nonEmpty('users.password_required'),
      v.check(isValidPassword, 'users.password_invalid'),
    ),
    confirmPassword: v.pipe(v.string(), v.nonEmpty('users.confirm_password_required')),
    extension: v.pipe(
      v.string(),
      v.trim(),
      v.check((value) => value === '' || isValidExtension(value), 'users.extension_invalid'),
    ),
    mobile: v.pipe(v.string(), v.trim(), v.regex(MOBILE_NUMBER_REGEX, 'users.mobile_invalid')),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'users.passwords_do_not_match',
    ),
    ['confirmPassword'],
  ),
)

export type NewUser = v.InferOutput<typeof NewUserSchema>

export type NewUserField = keyof NewUser

export class CreatedUserNotFoundError extends Error {
  constructor(username: string) {
    super(username)
    this.name = 'CreatedUserNotFoundError'
  }
}

export const getNewUserConflicts = (
  newUser: Pick<NewUser, 'username' | 'extension'>,
  users: User[],
  reservedExtensions: string[] = [],
): Partial<Record<NewUserField, string>> => {
  const conflicts: Partial<Record<NewUserField, string>> = {}

  if (findUserByUsername(users, newUser.username)) {
    conflicts.username = 'users.username_already_exists'
  }

  if (
    newUser.extension !== '' &&
    (findUserByExtension(users, newUser.extension) ||
      reservedExtensions.includes(newUser.extension))
  ) {
    conflicts.extension = 'users.extension_already_assigned'
  }
  return conflicts
}

export const getFullName = (newUser: Pick<NewUser, 'name' | 'surname'>): string =>
  [newUser.name.trim(), newUser.surname.trim()].filter(Boolean).join(' ')

export const buildNewUserCsv = (newUser: NewUser, extension: string): string =>
  serializeCsv([[newUser.username, getFullName(newUser), extension, newUser.password]])

export const createUser = async (newUser: NewUser, settings: UserSettings): Promise<User> => {
  await runCsvImport(buildNewUserCsv(newUser, settings.extension))
  const user = findUserByUsername(await getUsers(), newUser.username)

  if (!user) {
    throw new CreatedUserNotFoundError(newUser.username)
  }
  const current: UserSettings = {
    extension: user.mainExtension,
    mobile: '',
    voicemail: false,
    profileId: user.profileId,
    groupIds: [],
    devices: getSoftwareDeviceTypes(user),
  }
  await applyUserSettingsSteps(user, planUserSettingsUpdate(current, settings))
  return user
}
