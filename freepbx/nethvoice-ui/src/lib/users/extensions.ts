//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { User } from '@/lib/users/users'

export const USER_LIMITS_KEY = 'userLimits'

export type UserLimits = {
  configured: number
  limit: number | null
  configurable: number | null
}

export type ExtensionIssue = 'invalid' | 'duplicate'

export type ExtensionStep = {
  user: User
  extension: string
}

export type ExtensionErrorKind = 'in_use' | 'users_limit' | 'user_not_found' | 'unknown'

const LimitSchema = v.pipe(
  v.union([v.number(), v.boolean(), v.null()]),
  v.transform((value) => (typeof value === 'number' ? value : null)),
)

const UserLimitsSchema = v.object({
  configured: v.number(),
  limit: LimitSchema,
  configurable: LimitSchema,
})

export const parseUserLimits = (raw: unknown): UserLimits => v.parse(UserLimitsSchema, raw)

export const getUserLimits = async (): Promise<UserLimits> => {
  const { data } = await api.GET('/mainextensions/userlimits')
  return parseUserLimits(data)
}

export const postMainExtension = async (username: string, extension: string): Promise<void> => {
  await api.POST('/mainextensions', { body: { username, extension }, parseAs: 'text' })
}

export const isValidExtension = (extension: string): boolean => /^[0-9]+$/.test(extension)

export const validateExtensionDrafts = (
  drafts: Record<string, string>,
): Record<string, ExtensionIssue> => {
  const issues: Record<string, ExtensionIssue> = {}
  const owners = new Map<string, string[]>()

  for (const [username, draft] of Object.entries(drafts)) {
    const extension = draft.trim()

    if (extension === '') {
      continue
    }

    if (!isValidExtension(extension)) {
      issues[username] = 'invalid'
      continue
    }
    owners.set(extension, [...(owners.get(extension) ?? []), username])
  }

  for (const usernames of owners.values()) {
    if (usernames.length > 1) {
      for (const username of usernames.slice(1)) {
        issues[username] = 'duplicate'
      }
    }
  }
  return issues
}

export const countConfiguredDrafts = (drafts: Record<string, string>): number => {
  const issues = validateExtensionDrafts(drafts)

  return Object.entries(drafts).filter(
    ([username, draft]) => draft.trim() !== '' && !issues[username],
  ).length
}

export const planExtensionSteps = (
  users: User[],
  drafts: Record<string, string>,
): ExtensionStep[] => {
  const current = new Map(users.map((user) => [user.username, user.mainExtension]))
  const pending = users
    .map((user) => ({ user, extension: (drafts[user.username] ?? user.mainExtension).trim() }))
    .filter(({ user, extension }) => extension !== user.mainExtension)
  const steps: ExtensionStep[] = []

  const isHeldByAnotherUser = (step: ExtensionStep) =>
    [...current.entries()].some(
      ([username, extension]) => username !== step.user.username && extension === step.extension,
    )

  while (pending.length > 0) {
    const index = pending.findIndex((step) => step.extension === '' || !isHeldByAnotherUser(step))

    if (index >= 0) {
      const [step] = pending.splice(index, 1)
      steps.push(step)
      current.set(step.user.username, step.extension)
      continue
    }
    const blocked = pending[0]

    if (current.get(blocked.user.username) === '') {
      pending.shift()
      steps.push(blocked)
      current.set(blocked.user.username, blocked.extension)
      continue
    }
    steps.push({ user: blocked.user, extension: '' })
    current.set(blocked.user.username, '')
  }
  return steps
}

export const getExtensionErrorKind = (error: unknown): ExtensionErrorKind => {
  if (!isApiError(error)) {
    return 'unknown'
  }

  switch (error.status) {
    case 422:
      return 'in_use'
    case 403:
      return 'users_limit'
    case 404:
      return 'user_not_found'
    default:
      return 'unknown'
  }
}
