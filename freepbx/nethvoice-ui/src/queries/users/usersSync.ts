//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { onScopeDispose, ref } from 'vue'
import { useQueryCache } from '@pinia/colada'
import { USER_LIMITS_KEY } from '@/lib/users/extensions'
import { ORPHAN_EXTENSIONS_KEY } from '@/lib/users/orphans'
import { getUsersSyncRunning, postUsersSync, USERS_KEY } from '@/lib/users/users'

export const USERS_SYNC_POLL_INTERVAL = 2000

export const USERS_SYNC_MAX_POLLS = 60

export function useUsersProviderSync() {
  const queryCache = useQueryCache()
  const syncing = ref(false)
  const syncError = ref<unknown>(null)
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const wait = () =>
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, USERS_SYNC_POLL_INTERVAL)
    })

  const sync = async () => {
    if (syncing.value) {
      return
    }
    syncing.value = true
    syncError.value = null

    try {
      await postUsersSync()

      for (let poll = 0; poll < USERS_SYNC_MAX_POLLS && !disposed; poll += 1) {
        if (!(await getUsersSyncRunning())) {
          break
        }
        await wait()
      }
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
  }

  onScopeDispose(() => {
    disposed = true
    clearTimeout(timer)
  })

  return { syncing, syncError, sync }
}
