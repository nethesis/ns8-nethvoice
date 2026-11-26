//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { defineQuery, useQuery, useQueryCache, type UseQueryEntry } from '@pinia/colada'
import { LOOKUP_STALE_TIME } from '@/lib/integrations/lookups'
import {
  checkReachability,
  checkStoredVideoSource,
  createLimitedQueue,
  getDoorPhones,
  getGateway,
  getVideoSources,
  REACHABILITY_DELAY,
  reachabilityKey,
  sourceSignature,
  statusOfCheck,
  VIDEO_DOOR_PHONES_KEY,
  VIDEO_GATEWAY_KEY,
  VIDEO_REACHABILITY_KEY,
  VIDEO_SOURCE_CHECKS_KEY,
  VIDEO_SOURCES_KEY,
  VIDEO_STATUS_CONCURRENCY,
  type StoredCheck,
  type VideoSource,
  type VideoSourceCheck,
  type VideoSourceStatus,
} from '@/lib/integrations/videoSources'
import { useLoginStore } from '@/stores/login'

export const REACHABILITY_STALE_TIME = 30_000

export const useVideoSources = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [VIDEO_SOURCES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getVideoSources(),
  })

  return { state, asyncStatus, ...rest }
})

export const useDoorPhones = defineQuery(() => {
  const loginStore = useLoginStore()

  const { state, asyncStatus, ...rest } = useQuery({
    key: () => [VIDEO_DOOR_PHONES_KEY],
    enabled: () => loginStore.isAuthenticated,
    query: () => getDoorPhones(),
  })

  return { state, asyncStatus, ...rest }
})

export const useVideoGateway = () => {
  const loginStore = useLoginStore()

  return useQuery({
    key: () => [VIDEO_GATEWAY_KEY],
    enabled: () => loginStore.isAuthenticated,
    staleTime: LOOKUP_STALE_TIME,
    query: () => getGateway(),
  })
}

export const useReachability = (
  url: () => string,
  doorPhone: () => string,
  active: () => boolean,
) => {
  const loginStore = useLoginStore()
  const target = ref({ key: '', url: '', doorPhone: '' })
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(
    () => [active() ? reachabilityKey(url()) : '', doorPhone(), url()] as const,
    ([key, door, current], previous) => {
      clearTimeout(timer)

      if (key === target.value.key && door === target.value.doorPhone) {
        target.value = { ...target.value, url: current }
        return
      }
      const apply = () => {
        target.value = { key, url: current, doorPhone: door }
      }

      if (!key || !previous || !previous[0]) {
        apply()
        return
      }
      target.value = { key: '', url: '', doorPhone: '' }
      timer = setTimeout(apply, REACHABILITY_DELAY)
    },
    { immediate: true },
  )

  onScopeDispose(() => clearTimeout(timer))

  const query = useQuery({
    key: () => [VIDEO_REACHABILITY_KEY, target.value.key, target.value.doorPhone],
    enabled: () => loginStore.isAuthenticated && target.value.key !== '',
    staleTime: REACHABILITY_STALE_TIME,
    query: ({ signal }) => checkReachability(target.value.url, target.value.doorPhone, signal),
  })

  return { ...query, isActive: computed(() => target.value.key !== '') }
}

const statusQueue = createLimitedQueue(VIDEO_STATUS_CONCURRENCY)

export const videoSourceCheckKey = (name: string) => [VIDEO_SOURCE_CHECKS_KEY, name]

export const useVideoSourceChecks = (sources: () => VideoSource[], enabled: () => boolean) => {
  const queryCache = useQueryCache()
  const scope = getCurrentScope()
  const entries = shallowRef(new Map<string, UseQueryEntry<StoredCheck>>())

  const ensureEntry = (source: VideoSource) =>
    queryCache.ensure<StoredCheck>({
      key: videoSourceCheckKey(source.name),
      staleTime: Infinity,
      query: async ({ signal }) => ({
        signature: sourceSignature(source),
        check: await statusQueue.run(() => checkStoredVideoSource(source, signal)),
      }),
    })

  const run = (entry: UseQueryEntry<StoredCheck>) => {
    queryCache.fetch(entry).catch(() => {})
  }

  watch(
    () => (enabled() ? sources() : []),
    (list) => {
      const next = new Map<string, UseQueryEntry<StoredCheck>>()

      for (const source of list) {
        const entry = ensureEntry(source)
        const signature = sourceSignature(source)
        const stored = entry.state.value.data

        queryCache.track(entry, scope)
        next.set(source.name, entry)

        if (stored?.signature === '') {
          queryCache.setQueryData<StoredCheck>(videoSourceCheckKey(source.name), {
            ...stored,
            signature,
          })
        } else if (
          entry.asyncStatus.value === 'idle' &&
          (stored === undefined || stored.signature !== signature)
        ) {
          run(entry)
        }
      }
      for (const [name, entry] of entries.value) {
        if (!next.has(name)) {
          queryCache.untrack(entry, scope)
        }
      }
      entries.value = next
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    for (const entry of entries.value.values()) {
      queryCache.untrack(entry, scope)
    }
  })

  const statusOf = (name: string): VideoSourceStatus => {
    const entry = entries.value.get(name)
    const stored = entry?.state.value.data

    if (!entry || !stored || entry.asyncStatus.value === 'loading') {
      return 'testing'
    }
    return statusOfCheck(stored.check)
  }

  const checkOf = (name: string): VideoSourceCheck | null =>
    entries.value.get(name)?.state.value.data?.check ?? null

  const testingCount = computed(
    () => [...entries.value.keys()].filter((name) => statusOf(name) === 'testing').length,
  )

  const retest = async (name: string): Promise<VideoSourceCheck | null> => {
    const entry = entries.value.get(name)

    if (!entry) {
      return null
    }
    try {
      const state = await queryCache.fetch(entry)
      return state.data?.check ?? null
    } catch {
      return null
    }
  }

  const seed = (name: string, check: VideoSourceCheck) => {
    queryCache.setQueryData<StoredCheck>(videoSourceCheckKey(name), { signature: '', check })
  }

  const forget = (name: string) => {
    const entry = queryCache.get(videoSourceCheckKey(name))

    if (entry) {
      queryCache.remove(entry)
    }
  }

  return { statusOf, checkOf, testingCount, retest, seed, forget }
}
