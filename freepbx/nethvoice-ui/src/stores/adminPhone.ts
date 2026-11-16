//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { useQueryCache } from '@pinia/colada'
import {
  ADMIN_PHONE_LOCK_NAME,
  ADMIN_PHONE_RELOAD_DELAY,
  ADMIN_PHONE_STATUS_KEY,
  applyPhoneIslandSignal,
  buildPhoneIslandConfig,
  forgetServiceExtension,
  isCallableNumber,
  PHONE_ISLAND_CALL_START_EVENT,
  postAdminPhoneSession,
  rememberServiceExtension,
  toPhoneIslandSignal,
  type AdminPhoneSession,
  type AdminPhoneState,
} from '@/lib/adminPhone/adminPhone'
import { useLoginStore } from '@/stores/login'
import { describeError } from '@/stores/notifications'

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })

export const useAdminPhoneStore = defineStore('adminPhone', () => {
  const loginStore = useLoginStore()
  const queryCache = useQueryCache()

  const state = ref<AdminPhoneState>('inactive')
  const inCall = ref(false)
  const errorMessage = ref('')
  const session = shallowRef<AdminPhoneSession | null>(null)
  const pendingNumber = ref('')
  let attempt = 0

  const extension = computed(() => session.value?.extension ?? '')
  const displayName = computed(() => session.value?.displayName ?? '')
  const dataConfig = computed(() => (session.value ? buildPhoneIslandConfig(session.value) : ''))
  const isEnabled = computed(() => state.value === 'starting' || session.value !== null)
  const isConnecting = computed(() => state.value === 'starting' || state.value === 'registering')
  const canCall = computed(() => state.value === 'ready' && !inCall.value)

  const startCall = (number: string) => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(PHONE_ISLAND_CALL_START_EVENT, { detail: { number } }))
    }, 0)
  }

  const reset = (nextState: AdminPhoneState, message = '') => {
    session.value = null
    state.value = nextState
    inCall.value = false
    pendingNumber.value = ''
    errorMessage.value = message
  }

  const enable = async () => {
    if (isEnabled.value) {
      return
    }
    const current = ++attempt
    const number = pendingNumber.value

    reset('starting')
    pendingNumber.value = number

    try {
      const newSession = await postAdminPhoneSession()

      if (current !== attempt) {
        return
      }
      rememberServiceExtension(newSession.extension)
      queryCache.invalidateQueries({ key: [ADMIN_PHONE_STATUS_KEY] }).catch(() => undefined)

      if (newSession.reloading) {
        await wait(ADMIN_PHONE_RELOAD_DELAY)

        if (current !== attempt) {
          return
        }
      }
      session.value = newSession
      state.value = 'registering'
    } catch (error) {
      if (current === attempt) {
        reset('error', describeError(error))
      }
    }
  }

  const disable = () => {
    attempt += 1
    reset('inactive')
  }

  let active = false
  let lockGeneration = 0
  let releaseLock: (() => void) | null = null
  let queuedRequest: AbortController | null = null

  const lockManager = (): LockManager | null =>
    typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null

  const releaseHeldLock = () => {
    releaseLock?.()
    releaseLock = null
  }

  const requestLock = (options: LockOptions): Promise<boolean> => {
    const manager = lockManager()

    if (!manager) {
      return Promise.resolve(false)
    }
    const generation = ++lockGeneration
    queuedRequest?.abort()
    queuedRequest = null

    let lockOptions = options

    if (!options.ifAvailable && !options.steal) {
      const controller = new AbortController()
      queuedRequest = controller
      lockOptions = { ...options, signal: controller.signal }
    }

    const granted = manager.request(ADMIN_PHONE_LOCK_NAME, lockOptions, async (lock) => {
      if (!lock) {
        return false
      }
      if (generation !== lockGeneration || !active) {
        return true
      }
      queuedRequest = null
      releaseHeldLock()
      const held = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      void enable()
      await held
      return true
    })

    return granted
      .then((value) => value)
      .catch(() => {
        if (generation === lockGeneration && active) {
          releaseLock = null
          waitForLock()
        }
        return true
      })
  }

  const waitForLock = () => {
    disable()
    state.value = 'elsewhere'
    void requestLock({})
  }

  const start = () => {
    if (active || !loginStore.isAuthenticated) {
      return
    }
    active = true

    if (!lockManager()) {
      void enable()
      return
    }
    void requestLock({ ifAvailable: true }).then((acquired) => {
      if (!acquired && active && state.value === 'inactive') {
        waitForLock()
      }
    })
  }

  const stop = () => {
    active = false
    lockGeneration += 1
    queuedRequest?.abort()
    queuedRequest = null
    releaseHeldLock()
    disable()
  }

  const useHere = () => {
    if (!active || state.value !== 'elsewhere') {
      return
    }
    void requestLock({ steal: true })
  }

  const call = async (number: string) => {
    const target = number.trim()

    if (!isCallableNumber(target) || inCall.value || state.value === 'elsewhere') {
      return
    }
    if (state.value === 'ready') {
      startCall(target)
      return
    }
    pendingNumber.value = target

    if (!isEnabled.value) {
      await enable()
    }
  }

  const handleIslandEvent = (name: string, detail: unknown) => {
    const signal = toPhoneIslandSignal(name, detail)

    if (signal === null || session.value === null) {
      return
    }
    const next = applyPhoneIslandSignal({ state: state.value, inCall: inCall.value }, signal)

    state.value = next.state
    inCall.value = next.inCall

    if (next.state === 'error') {
      pendingNumber.value = ''
    }
    if (next.state === 'ready') {
      errorMessage.value = ''

      if (pendingNumber.value) {
        startCall(pendingNumber.value)
        pendingNumber.value = ''
      }
    }
  }

  const fail = (error: unknown) => {
    attempt += 1
    reset('error', describeError(error))
  }

  watch(
    () => loginStore.isAuthenticated,
    (authenticated) => {
      if (!authenticated) {
        stop()
        forgetServiceExtension()
      }
    },
  )

  return {
    state,
    inCall,
    errorMessage,
    extension,
    displayName,
    dataConfig,
    isEnabled,
    isConnecting,
    canCall,
    enable,
    disable,
    start,
    stop,
    useHere,
    call,
    handleIslandEvent,
    fail,
  }
})
