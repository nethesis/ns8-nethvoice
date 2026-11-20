//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { onScopeDispose, ref } from 'vue'
import { useQueryCache } from '@pinia/colada'
import { USER_LIMITS_KEY } from '@/lib/users/extensions'
import { ORPHAN_EXTENSIONS_KEY } from '@/lib/users/orphans'
import { getUsersSyncRunning, postUsersSync, USERS_KEY } from '@/lib/users/users'

export const USERS_SYNC_POLL_INTERVAL = 2000

export const USERS_SYNC_MAX_POLLS = 60

export const USERS_SYNC_START_GRACE = 3000

export const waitForUsersSync = async ({
  isRunning,
  wait,
  now = Date.now,
  isCancelled = () => false,
}: {
  isRunning: () => Promise<boolean>
  wait: (milliseconds: number) => Promise<void>
  now?: () => number
  isCancelled?: () => boolean
}): Promise<boolean> => {
  const startedAt = now()
  let seenRunning = false

  for (let poll = 0; poll < USERS_SYNC_MAX_POLLS; poll += 1) {
    if (isCancelled()) {
      return false
    }

    if (await isRunning()) {
      seenRunning = true
    } else if (seenRunning || now() - startedAt >= USERS_SYNC_START_GRACE) {
      return true
    }
    const graceLeft = USERS_SYNC_START_GRACE - (now() - startedAt)
    await wait(
      seenRunning || graceLeft <= 0
        ? USERS_SYNC_POLL_INTERVAL
        : Math.min(USERS_SYNC_POLL_INTERVAL, graceLeft),
    )
  }
  return false
}

export function useUsersProviderSync() {
  const queryCache = useQueryCache()
  const syncing = ref(false)
  const syncError = ref<unknown>(null)
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const wait = (milliseconds: number) =>
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, milliseconds)
    })

  const sync = async (): Promise<boolean> => {
    if (syncing.value) {
      return false
    }
    syncing.value = true
    syncError.value = null
    let completed = false

    try {
      await postUsersSync()
      completed = await waitForUsersSync({
        isRunning: getUsersSyncRunning,
        wait,
        isCancelled: () => disposed,
      })
    } catch (error) {
      syncError.value = error
    } finally {
      syncing.value = false

      if (!disposed && syncError.value === null) {
        queryCache.invalidateQueries({ key: [USERS_KEY] }).catch(() => undefined)
        queryCache.invalidateQueries({ key: [USER_LIMITS_KEY] }).catch(() => undefined)
        queryCache.invalidateQueries({ key: [ORPHAN_EXTENSIONS_KEY] }).catch(() => undefined)
      }
    }
    return completed
  }

  onScopeDispose(() => {
    disposed = true
    clearTimeout(timer)
  })

  return { syncing, syncError, sync }
}
