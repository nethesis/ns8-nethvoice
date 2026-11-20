//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  buildGroupFormSchema,
  diffGroupMembers,
  filterGroups,
  getGroupUsernames,
  groupPermissionName,
  parseGroups,
  parseGroupUserIds,
  parseUserGroupIds,
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
