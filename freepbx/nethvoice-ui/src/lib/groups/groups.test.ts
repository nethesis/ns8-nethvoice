//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/errors'
import {
  buildGroupFormSchema,
  createGroup,
  GroupMembersError,
  diffGroupMembers,
  filterGroups,
  getGroupNameIssue,
  getGroupUsernames,
  groupPermissionName,
  parseGroups,
  parseGroupUserIds,
  parseUserGroupIds,
  updateGroup,
  withGroupMembership,
  type Group,
} from './groups'
import type { User } from '@/lib/users/users'

const user = (id: number, username: string, displayName = username): User => ({
  id,
  username,
  displayName,
  mainExtension: String(300 + id),
  profileId: 1,
  email: '',
  devices: [],
})

const users = [
  user(1, 'm.rossi', 'Mario Rossi'),
  user(2, 'a.miller', 'Anna Miller'),
  user(3, 'b.lee'),
]

const sales: Group = { id: 7, name: 'Sales', userIds: [1, 2] }
const support: Group = { id: 8, name: 'Support', userIds: [] }

describe('parseGroups', () => {
  it('should accept numeric ids as numbers or strings', () => {
    expect(
      parseGroups([
        { id: 2, name: 'Sales' },
        { id: '3', name: 'IT' },
      ]),
    ).toEqual([
      { id: 2, name: 'Sales' },
      { id: 3, name: 'IT' },
    ])
  })

  it('should reject a group without a name', () => {
    expect(() => parseGroups([{ id: 1 }])).toThrow()
  })
})

describe('parseGroupUserIds', () => {
  it('should return the user ids of the members', () => {
    expect(
      parseGroupUserIds([
        { user_id: 2, name: 'Sales' },
        { user_id: '5', name: 'Sales' },
      ]),
    ).toEqual([2, 5])
  })
})

describe('parseUserGroupIds', () => {
  it('should parse the group ids of a user', () => {
    expect(parseUserGroupIds([1, '4'])).toEqual([1, 4])
  })
})

describe('groupPermissionName', () => {
  it('should strip non alphanumeric characters like the backend', () => {
    expect(groupPermissionName('Sales-1 Team')).toBe('grp_sales1team')
  })
})

describe('buildGroupFormSchema', () => {
  const validate = (name: string, others: string[] = ['Sales']) =>
    v.safeParse(buildGroupFormSchema(others), { name, userIds: [] })

  it('should trim a valid name', () => {
    const result = validate('  Support ')
    expect(result.success && result.output.name).toBe('Support')
  })

  it('should require a name', () => {
    expect(validate('   ').issues?.[0].message).toBe('groups.name_required')
  })

  it('should reject a duplicate name ignoring case', () => {
    expect(validate('sales').issues?.[0].message).toBe('groups.name_already_exists')
  })

  it('should reject a name that maps to the same permission', () => {
    expect(validate('Sa-les').issues?.[0].message).toBe('groups.name_too_similar')
  })

  it('should reject a name without letters or digits', () => {
    expect(validate('---').issues?.[0].message).toBe('groups.name_needs_letter_or_digit')
  })

  it('should reject a name longer than the column', () => {
    expect(validate('x'.repeat(66)).issues?.[0].message).toBe('groups.name_too_long')
  })

  it('should reject a comma, which separates the groups a contact is shared with', () => {
    expect(validate('North, South').issues?.[0].message).toBe('groups.name_cannot_contain_commas')
  })

  it('should accept the current name with another case when it is not among the others', () => {
    expect(validate('SALES', ['Support']).success).toBe(true)
  })
})

describe('diffGroupMembers', () => {
  it('should list added and removed users', () => {
    expect(diffGroupMembers([1, 2, 3], [2, 4])).toEqual({ added: [4], removed: [1, 3] })
  })
})

describe('withGroupMembership', () => {
  it('should add the group once', () => {
    expect(withGroupMembership([3, 7], 7, true)).toEqual([3, 7])
    expect(withGroupMembership([3], 7, true)).toEqual([3, 7])
  })

  it('should remove the group and keep the others', () => {
    expect(withGroupMembership([3, 7, 9], 7, false)).toEqual([3, 9])
  })
})

describe('getGroupUsernames', () => {
  it('should return sorted usernames of the members', () => {
    expect(getGroupUsernames(sales, users)).toEqual(['a.miller', 'm.rossi'])
  })
})

describe('filterGroups', () => {
  it('should match the group name', () => {
    expect(filterGroups([sales, support], users, 'supp')).toEqual([support])
  })

  it('should match the username or name of a member', () => {
    expect(filterGroups([sales, support], users, 'anna')).toEqual([sales])
  })

  it('should return all groups without a filter', () => {
    expect(filterGroups([sales, support], users, '')).toHaveLength(2)
  })
})

describe('createGroup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tells which group was created when its users cannot be added', async () => {
    const failure = new ApiError({
      status: 500,
      method: 'POST',
      url: '/cti/groups/users/2',
      body: null,
    })
    vi.spyOn(api, 'GET').mockResolvedValue({ data: [], response: new Response() })
    const post = vi
      .spyOn(api, 'POST')
      .mockResolvedValueOnce({ data: 9, response: new Response() })
      .mockRejectedValueOnce(failure)

    const error = await createGroup({ name: 'Marketing', userIds: [2] }).catch((caught) => caught)

    expect(error).toBeInstanceOf(GroupMembersError)
    expect(error).toMatchObject({ groupId: 9, cause: failure })
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('does not wrap the failure of the group creation', async () => {
    const failure = new ApiError({ status: 409, method: 'POST', url: '/cti/groups', body: null })
    vi.spyOn(api, 'POST').mockRejectedValueOnce(failure)

    await expect(createGroup({ name: 'Marketing', userIds: [2] })).rejects.toBe(failure)
  })
})

describe('updateGroup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renames the group before saving its users', async () => {
    const put = vi.spyOn(api, 'PUT').mockResolvedValue({ data: {}, response: new Response() })
    vi.spyOn(api, 'GET').mockResolvedValue({ data: [], response: new Response() })
    const post = vi.spyOn(api, 'POST').mockResolvedValue({ data: {}, response: new Response() })

    await updateGroup(sales, { name: 'Sales Team', userIds: [1, 2, 3] })

    expect(put).toHaveBeenCalledWith('/cti/groups/{id}', {
      params: { path: { id: '7' } },
      body: { name: 'Sales Team' },
    })
    expect(put.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0])
    expect(post).toHaveBeenCalledWith('/cti/groups/users/{id}', {
      params: { path: { id: '3' } },
      body: { groups: [7] },
    })
  })

  it('does not rename a group whose name did not change', async () => {
    const put = vi.spyOn(api, 'PUT')

    await updateGroup(sales, { name: 'Sales', userIds: [1, 2] })

    expect(put).not.toHaveBeenCalled()
  })

  it('does not save the users when the rename is refused', async () => {
    const failure = new ApiError({ status: 409, method: 'PUT', url: '/cti/groups/7', body: null })
    vi.spyOn(api, 'PUT').mockRejectedValueOnce(failure)
    const post = vi.spyOn(api, 'POST')

    await expect(updateGroup(sales, { name: 'Sales Team', userIds: [1] })).rejects.toBe(failure)
    expect(post).not.toHaveBeenCalled()
  })
})

describe('getGroupNameIssue', () => {
  const failure = (status: number, body: unknown) =>
    new ApiError({ status, method: 'PUT', url: '/cti/groups/7', body })

  it('tells that the new name makes the phonebook sharing too long', () => {
    expect(
      getGroupNameIssue(
        failure(409, {
          message: 'The group cannot be renamed: ...',
          errors: [
            'The sharing of 2 phonebook contacts would be longer than 255 characters',
            'The sharing of the phonebook source custom_3 would be longer than 255 characters',
          ],
        }),
      ),
    ).toBe('groups.name_makes_sharing_too_long')
  })

  it('keeps the other refusals of a rename as they are', () => {
    expect(
      getGroupNameIssue(
        failure(409, {
          message: 'The group cannot be renamed: ...',
          errors: [
            'The sharing of 2 phonebook contacts would be longer than 255 characters',
            'The phonebook source custom_3 cannot be written',
          ],
        }),
      ),
    ).toBeNull()
    expect(getGroupNameIssue(failure(500, null))).toBeNull()
    expect(getGroupNameIssue(new Error('boom'))).toBeNull()
  })

  it('maps the name checks of the server to the messages of the form', () => {
    expect(
      getGroupNameIssue(failure(409, { message: 'A group with a similar name already exists' })),
    ).toBe('groups.name_too_similar')
    expect(
      getGroupNameIssue(failure(400, { message: 'The group name cannot contain commas' })),
    ).toBe('groups.name_cannot_contain_commas')
    expect(
      getGroupNameIssue(failure(400, { message: 'The group name must be at most 65 characters' })),
    ).toBe('groups.name_too_long')
  })
})
