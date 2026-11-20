//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDraftExtension,
  getDrafts,
  MissingBaseProfileError,
  planProvisioning,
  runProvisioning,
} from './provisioning'
import type { User, UserDevice } from './users'

const mocks = vi.hoisted(() => ({
  postMainExtension: vi.fn(),
  postUserProfile: vi.fn(),
  enableSoftwareDevice: vi.fn(),
}))

vi.mock('@/lib/users/extensions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/users/extensions')>()),
  postMainExtension: mocks.postMainExtension,
}))

vi.mock('@/lib/profiles/profiles', () => ({ postUserProfile: mocks.postUserProfile }))

vi.mock('@/lib/users/userSettings', () => ({
  enableSoftwareDevice: mocks.enableSoftwareDevice,
}))

const webrtc = (extension: string): UserDevice => ({
  id: Number(extension),
  type: 'webrtc',
  extension,
  mac: '',
  vendor: '',
  model: '',
  line: null,
  registered: false,
})

const user = (
  id: number,
  username: string,
  mainExtension: string,
  profileId: number | null,
  devices: UserDevice[] = mainExtension ? [webrtc(`92${mainExtension}`)] : [],
): User => ({
  id,
  username,
  displayName: username,
  mainExtension,
  profileId,
  email: '',
  devices,
})

const USERS = [
  user(1, 'a.miller', '300', 2),
  user(2, 'c.davis', '', null),
  user(3, 'd.jones', '', 3),
  user(4, 'e.johnson', '303', 1),
]

const describeDefaults = (plan: ReturnType<typeof planProvisioning>) =>
  plan.defaults.map(
    (item) => `${item.user.username}:${item.extension}:${item.setProfile}:${item.enableWebrtc}`,
  )

describe('drafts', () => {
  it('uses the edited value or the saved extension', () => {
    expect(getDraftExtension(USERS[0], {})).toBe('300')
    expect(getDraftExtension(USERS[0], { 'a.miller': ' 310 ' })).toBe('310')
    expect(getDrafts(USERS, { 'c.davis': '301' })).toEqual({
      'a.miller': '300',
      'c.davis': '301',
      'd.jones': '',
      'e.johnson': '303',
    })
  })
})

describe('planProvisioning', () => {
  it('plans nothing when nothing changed', () => {
    expect(planProvisioning(USERS, { 'a.miller': '300' })).toEqual({ extensions: [], defaults: [] })
  })

  it('assigns the new extensions and applies the defaults to the new users', () => {
    const plan = planProvisioning(USERS, { 'c.davis': '301', 'd.jones': '302', 'e.johnson': '' })

    expect(plan.extensions.map((step) => `${step.user.username}:${step.extension}`)).toEqual([
      'c.davis:301',
      'd.jones:302',
      'e.johnson:',
    ])
    expect(describeDefaults(plan)).toEqual(['c.davis:301:true:true', 'd.jones:302:false:true'])
  })

  it('applies the defaults again to a user whose extension changed', () => {
    const plan = planProvisioning(USERS, { 'a.miller': '310' })

    expect(describeDefaults(plan)).toEqual(['a.miller:310:false:true'])
  })

  it('completes the defaults of users that already got their extension in a failed attempt', () => {
    const afterFailure = [
      user(1, 'a.miller', '300', 2),
      user(2, 'c.davis', '301', null, []),
      user(3, 'd.jones', '302', 3, []),
      user(4, 'e.johnson', '303', null),
    ]
    const plan = planProvisioning(afterFailure, {})

    expect(plan.extensions).toEqual([])
    expect(describeDefaults(plan)).toEqual([
      'c.davis:301:true:true',
      'd.jones:302:false:true',
      'e.johnson:303:true:false',
    ])
  })

  it('skips the defaults of users without an extension', () => {
    expect(planProvisioning([user(2, 'c.davis', '', null)], {}).defaults).toEqual([])
  })
})

describe('runProvisioning', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates the extensions first, then applies only the missing defaults', async () => {
    const users = [user(2, 'c.davis', '', null), user(4, 'e.johnson', '303', null)]
    const progress: string[] = []

    await runProvisioning(planProvisioning(users, { 'c.davis': '301' }), 7, (done, total) =>
      progress.push(`${done}/${total}`),
    )

    expect(mocks.postMainExtension.mock.calls).toEqual([['c.davis', '301']])
    expect(mocks.postUserProfile.mock.calls).toEqual([
      [2, 7],
      [4, 7],
    ])
    expect(mocks.enableSoftwareDevice.mock.calls).toEqual([['webrtc', '301']])
    expect(progress).toEqual(['1/3', '2/3', '3/3'])
  })

  it('retries the defaults of the users created before a failure', async () => {
    const users = [user(2, 'c.davis', '', null), user(3, 'd.jones', '', 3)]
    mocks.postMainExtension.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('x'))

    await expect(
      runProvisioning(planProvisioning(users, { 'c.davis': '301', 'd.jones': '302' }), 7),
    ).rejects.toMatchObject({ username: 'd.jones', phase: 'extension' })
    expect(mocks.enableSoftwareDevice).not.toHaveBeenCalled()

    mocks.postMainExtension.mockResolvedValue(undefined)
    const refetched = [user(2, 'c.davis', '301', null, []), user(3, 'd.jones', '', 3)]
    await runProvisioning(planProvisioning(refetched, { 'd.jones': '302' }), 7)

    expect(mocks.postMainExtension.mock.calls.at(-1)).toEqual(['d.jones', '302'])
    expect(mocks.postUserProfile.mock.calls).toEqual([[2, 7]])
    expect(mocks.enableSoftwareDevice.mock.calls).toEqual([
      ['webrtc', '301'],
      ['webrtc', '302'],
    ])
  })

  it('stops with a defaults error when the Base profile is missing', async () => {
    const users = [user(3, 'd.jones', '', 3), user(2, 'c.davis', '', null)]

    const result = runProvisioning(
      planProvisioning(users, { 'd.jones': '302', 'c.davis': '301' }),
      null,
    )

    await expect(result).rejects.toMatchObject({ username: 'c.davis', phase: 'defaults' })
    await expect(result).rejects.toHaveProperty('cause', expect.any(MissingBaseProfileError))
    expect(mocks.postUserProfile).not.toHaveBeenCalled()
    expect(mocks.enableSoftwareDevice.mock.calls).toEqual([['webrtc', '302']])
  })

  it('does not need the Base profile when every user already has a profile', async () => {
    await runProvisioning(planProvisioning([user(3, 'd.jones', '', 3)], { 'd.jones': '302' }), null)

    expect(mocks.enableSoftwareDevice.mock.calls).toEqual([['webrtc', '302']])
  })
})
