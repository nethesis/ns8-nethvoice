//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { compareNatural, matchesText } from '@/lib/common'
import type { User } from '@/lib/users/users'

export const GROUPS_KEY = 'ctiGroups'

export const GROUP_NAME_MAX_LENGTH = 65

export const MAX_GROUP_USERS_SHOWN = 8

export const NumericIdSchema = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.regex(/^\d+$/))]),
  v.transform(Number),
  v.integer(),
)

const GroupsResponseSchema = v.array(v.object({ id: NumericIdSchema, name: v.string() }))

const GroupMembersResponseSchema = v.array(v.object({ user_id: NumericIdSchema }))

const UserGroupIdsResponseSchema = v.array(NumericIdSchema)

export type Group = {
  id: number
  name: string
  userIds: number[]
}

export type GroupForm = {
  name: string
  userIds: number[]
}

export type GroupMembersChange = {
  added: number[]
  removed: number[]
}

export const groupPermissionName = (name: string): string =>
  `grp_${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`

export const parseGroups = (raw: unknown): Omit<Group, 'userIds'>[] =>
  v.parse(GroupsResponseSchema, raw)

export const parseGroupUserIds = (raw: unknown): number[] =>
  v.parse(GroupMembersResponseSchema, raw).map((member) => member.user_id)

export const parseUserGroupIds = (raw: unknown): number[] =>
  v.parse(UserGroupIdsResponseSchema, raw)

export const buildGroupFormSchema = (otherGroupNames: string[]) =>
  v.object({
    name: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('groups.name_required'),
      v.maxLength(GROUP_NAME_MAX_LENGTH, 'groups.name_too_long'),
      v.check((name) => !name.includes(','), 'groups.name_cannot_contain_commas'),
      v.check((name) => groupPermissionName(name) !== 'grp_', 'groups.name_needs_letter_or_digit'),
      v.check(
        (name) =>
          !otherGroupNames.some((other) => other.trim().toLowerCase() === name.toLowerCase()),
        'groups.name_already_exists',
      ),
      v.check(
        (name) =>
          !otherGroupNames.some(
            (other) => groupPermissionName(other) === groupPermissionName(name),
          ),
        'groups.name_too_similar',
      ),
    ),
    userIds: v.array(v.number()),
  })

const GROUP_NAME_SERVER_ISSUES: [RegExp, string][] = [
  [/^Enter the group name$/, 'groups.name_required'],
  [/^The group name must be at most \d+ characters$/, 'groups.name_too_long'],
  [/^The group name cannot contain commas$/, 'groups.name_cannot_contain_commas'],
  [/^The group name must contain a letter or a digit$/, 'groups.name_needs_letter_or_digit'],
  [/^A group with this name already exists$/, 'groups.name_already_exists'],
  [/^A group with a similar name already exists$/, 'groups.name_too_similar'],
]

const SHARING_TOO_LONG_REGEX = /^The sharing of .+ would be longer than \d+ characters$/

export const getGroupNameIssue = (error: unknown): string | null => {
  if (!isApiError(error) || typeof error.body !== 'object' || error.body === null) {
    return null
  }
  const body = error.body as { message?: unknown; errors?: unknown }
  const errors = Array.isArray(body.errors) ? body.errors : []

  if (
    error.status === 409 &&
    errors.length > 0 &&
    errors.every((item) => typeof item === 'string' && SHARING_TOO_LONG_REGEX.test(item))
  ) {
    return 'groups.name_makes_sharing_too_long'
  }
  if (typeof body.message !== 'string') {
    return null
  }
  const message = body.message
  return GROUP_NAME_SERVER_ISSUES.find(([pattern]) => pattern.test(message))?.[1] ?? null
}

export const diffGroupMembers = (current: number[], next: number[]): GroupMembersChange => ({
  added: next.filter((userId) => !current.includes(userId)),
  removed: current.filter((userId) => !next.includes(userId)),
})

export const withGroupMembership = (
  userGroupIds: number[],
  groupId: number,
  member: boolean,
): number[] => {
  const others = userGroupIds.filter((id) => id !== groupId)
  return member ? [...others, groupId] : others
}

export const getGroupUsernames = (group: Group, users: User[]): string[] =>
  users
    .filter((user) => group.userIds.includes(user.id))
    .map((user) => user.username)
    .sort(compareNatural)

export const filterGroups = (groups: Group[], users: User[], textFilter: string): Group[] =>
  groups.filter((group) =>
    matchesText(
      textFilter,
      group.name,
      ...users
        .filter((user) => group.userIds.includes(user.id))
        .flatMap((user) => [user.username, user.displayName]),
    ),
  )

export const getGroupUserIds = async (groupId: number): Promise<number[]> => {
  const { data } = await api.GET('/cti/users/groups/{id}', {
    params: { path: { id: String(groupId) } },
  })
  return parseGroupUserIds(data)
}

export const getGroups = async (): Promise<Group[]> => {
  const { data } = await api.GET('/cti/groups')
  const groups = parseGroups(data)
  const members = await Promise.all(groups.map((group) => getGroupUserIds(group.id)))

  return groups
    .map((group, index) => ({ ...group, userIds: members[index] ?? [] }))
    .sort((a, b) => compareNatural(a.name, b.name))
}

export const getUserGroupIds = async (userId: number): Promise<number[]> => {
  const { data } = await api.GET('/cti/groups/users/{id}', {
    params: { path: { id: String(userId) } },
  })
  return parseUserGroupIds(data)
}

export const postUserGroups = async (userId: number, groupIds: number[]): Promise<void> => {
  await api.POST('/cti/groups/users/{id}', {
    params: { path: { id: String(userId) } },
    body: { groups: groupIds },
  })
}

export const postGroup = async (name: string): Promise<number> => {
  const { data } = await api.POST('/cti/groups', { body: { name } })
  return v.parse(NumericIdSchema, data)
}

export const putGroupName = async (groupId: number, name: string): Promise<void> => {
  await api.PUT('/cti/groups/{id}', { params: { path: { id: String(groupId) } }, body: { name } })
}

export const deleteGroup = async (groupId: number): Promise<void> => {
  await api.DELETE('/cti/groups/{id}', { params: { path: { id: String(groupId) } } })
}

export const saveGroupMembers = async (
  groupId: number,
  currentUserIds: number[],
  nextUserIds: number[],
): Promise<void> => {
  const { added, removed } = diffGroupMembers(currentUserIds, nextUserIds)

  for (const userId of [...added, ...removed]) {
    const userGroupIds = await getUserGroupIds(userId)
    await postUserGroups(userId, withGroupMembership(userGroupIds, groupId, added.includes(userId)))
  }
}

export class GroupMembersError extends Error {
  readonly groupId: number
  readonly cause: unknown

  constructor(groupId: number, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'GroupMembersError'
    this.groupId = groupId
    this.cause = cause
  }
}

export const createGroup = async (group: GroupForm): Promise<number> => {
  const groupId = await postGroup(group.name)

  try {
    await saveGroupMembers(groupId, [], group.userIds)
  } catch (error) {
    throw new GroupMembersError(groupId, error)
  }
  return groupId
}

export const updateGroup = async (group: Group, form: GroupForm): Promise<void> => {
  if (form.name !== group.name) {
    await putGroupName(group.id, form.name)
  }
  await saveGroupMembers(group.id, group.userIds, form.userIds)
}
