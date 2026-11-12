//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { postUserProfile } from '@/lib/profiles/profiles'
import { planExtensionSteps, postMainExtension, type ExtensionStep } from '@/lib/users/extensions'
import { enableSoftwareDevice } from '@/lib/users/userSettings'
import type { User } from '@/lib/users/users'

export type ProvisioningPlan = {
  extensions: ExtensionStep[]
  defaults: { user: User; extension: string; setProfile: boolean }[]
}

export class ProvisioningError extends Error {
  readonly username: string
  readonly phase: 'extension' | 'defaults'
  readonly cause: unknown

  constructor(username: string, phase: 'extension' | 'defaults', cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'ProvisioningError'
    this.username = username
    this.phase = phase
    this.cause = cause
  }
}

export const getDraftExtension = (user: User, edits: Record<string, string>): string =>
  (edits[user.username] ?? user.mainExtension).trim()

export const getDrafts = (users: User[], edits: Record<string, string>): Record<string, string> =>
  Object.fromEntries(users.map((user) => [user.username, getDraftExtension(user, edits)]))

export const planProvisioning = (
  users: User[],
  edits: Record<string, string>,
): ProvisioningPlan => {
  const extensions = planExtensionSteps(users, getDrafts(users, edits))
  const defaults = users
    .map((user) => ({ user, extension: getDraftExtension(user, edits) }))
    .filter(({ user, extension }) => extension !== '' && extension !== user.mainExtension)
    .map(({ user, extension }) => ({ user, extension, setProfile: user.profileId === null }))

  return { extensions, defaults }
}

export const runProvisioning = async (
  plan: ProvisioningPlan,
  baseProfileId: number | null,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<void> => {
  const total = plan.extensions.length + plan.defaults.length
  let done = 0

  for (const step of plan.extensions) {
    try {
      await postMainExtension(step.user.username, step.extension)
    } catch (error) {
      throw new ProvisioningError(step.user.username, 'extension', error)
    }
    done += 1
    onProgress(done, total)
  }

  for (const item of plan.defaults) {
    try {
      if (item.setProfile && baseProfileId !== null) {
        await postUserProfile(item.user.id, baseProfileId)
      }
      await enableSoftwareDevice('webrtc', item.extension)
    } catch (error) {
      throw new ProvisioningError(item.user.username, 'defaults', error)
    }
    done += 1
    onProgress(done, total)
  }
}
