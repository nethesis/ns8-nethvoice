//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { useQueryCache } from '@pinia/colada'
import {
  ADMIN_PHONE_CHANNEL_NAME,
  ADMIN_PHONE_HOLDER_TIMEOUT,
  ADMIN_PHONE_LOCK_NAME,
  ADMIN_PHONE_RELOAD_DELAY,
  ADMIN_PHONE_RENEW_LIMIT,
  ADMIN_PHONE_STATUS_KEY,
  applyPhoneIslandSignal,
  buildPhoneIslandConfig,
  forgetServiceExtension,
  isAbortError,
  isCallableNumber,
  parseAdminPhoneTabMessage,
  PHONE_ISLAND_CALL_START_EVENT,
  postAdminPhoneSession,
  rememberServiceExtension,
  toPhoneIslandSignal,
  type AdminPhoneSession,
  type AdminPhoneState,
  type AdminPhoneTabMessage,
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
  const otherTabInCall = ref(false)
  let attempt = 0
  let renewals = 0

  const extension = computed(() => session.value?.extension ?? '')
  const displayName = computed(() => session.value?.displayName ?? '')
  const dataConfig = computed(() => (session.value ? buildPhoneIslandConfig(session.value) : ''))
  const isEnabled = computed(() => state.value === 'starting' || session.value !== null)
  const isConnecting = computed(() => state.value === 'starting' || state.value === 'registering')
  const canCall = computed(() => state.value === 'ready' && !inCall.value)
  const isCallBlocked = computed(
    () =>
      inCall.value ||
      (state.value === 'error' && isEnabled.value) ||
      (state.value === 'elsewhere' && otherTabInCall.value),
  )

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

  const requestSession = async (current: number) => {
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
      if (
        session.value &&
        buildPhoneIslandConfig(session.value) === buildPhoneIslandConfig(newSession)
      ) {
        return
      }
      session.value = newSession
      state.value = 'registering'
    } catch (error) {
      if (current === attempt) {
        reset('error', describeError(error))
      }
    }
  }

  const enable = async () => {
    if (isEnabled.value) {
      return
    }
    const current = ++attempt
    const number = pendingNumber.value

    renewals = 0
    reset('starting')
    pendingNumber.value = number
    await requestSession(current)
  }

  const renew = async () => {
    renewals += 1
    await requestSession(++attempt)
  }

  const disable = () => {
    attempt += 1
    reset('inactive')
  }

  let active = false
  let lockGeneration = 0
  let takeOverGeneration = 0
  let releaseLock: (() => void) | null = null
  let queuedRequest: AbortController | null = null
  let channel: BroadcastChannel | null = null
  let waitingForHandover = false
  const holderAnswers = new Set<(busy: boolean) => void>()

  const lockManager = (): LockManager | null =>
    typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null

  const isHolder = () => releaseLock !== null

  const releaseHeldLock = () => {
    releaseLock?.()
    releaseLock = null
  }

  const postTabMessage = (message: AdminPhoneTabMessage) => {
    channel?.postMessage(message)
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

    const onGranted = async (lock: Lock | null) => {
      if (!lock) {
        return false
      }
      if (generation !== lockGeneration || !active) {
        return true
      }
      queuedRequest = null
      waitingForHandover = false
      otherTabInCall.value = false
      releaseHeldLock()
      const held = new Promise<void>((resolve) => {
        releaseLock = resolve
      })
      void enable()
      await held
      return true
    }

    let granted: Promise<boolean>

    try {
      granted = manager
        .request(ADMIN_PHONE_LOCK_NAME, lockOptions, onGranted)
        .then((value) => value)
    } catch (error) {
      granted = Promise.reject(error)
    }

    return granted.catch((error: unknown) => {
      if (generation === lockGeneration && active) {
        releaseLock = null

        if (isAbortError(error)) {
          waitForLock()
        } else {
          void enable()
        }
      }
      return true
    })
  }

  const waitForLock = () => {
    disable()
    waitingForHandover = false
    state.value = 'elsewhere'
    void requestLock({})
  }

  const isLockHeld = async (): Promise<boolean> => {
    const manager = lockManager()

    if (!manager || typeof manager.query !== 'function') {
      return true
    }
    try {
      const snapshot = await manager.query()
      return (snapshot.held ?? []).some((lock) => lock.name === ADMIN_PHONE_LOCK_NAME)
    } catch {
      return true
    }
  }

  const askHolder = async (): Promise<boolean> => {
    if (!channel || !(await isLockHeld())) {
      return false
    }
    return new Promise((resolve) => {
      const answer = (busy: boolean) => {
        clearTimeout(timer)
        holderAnswers.delete(answer)
        resolve(busy)
      }
      const timer = setTimeout(() => answer(false), ADMIN_PHONE_HOLDER_TIMEOUT)

      holderAnswers.add(answer)
      postTabMessage({ type: 'query' })
    })
  }

  const takeOver = async (onHolderInCall: () => void) => {
    const current = ++takeOverGeneration
    const holderInCall = await askHolder()

    if (current !== takeOverGeneration || !active) {
      return
    }
    if (holderInCall) {
      otherTabInCall.value = true
      onHolderInCall()
      return
    }
    void requestLock({ steal: true })
  }

  const handleTabMessage = (event: MessageEvent) => {
    const message = parseAdminPhoneTabMessage(event.data)

    if (!message || !active) {
      return
    }
    if (message.type === 'query') {
      if (isHolder()) {
        postTabMessage({ type: 'status', inCall: inCall.value })
      }
      return
    }
    if (isHolder()) {
      return
    }
    otherTabInCall.value = message.inCall

    for (const answer of [...holderAnswers]) {
      answer(message.inCall)
    }
    if (!message.inCall && waitingForHandover && state.value === 'elsewhere') {
      waitingForHandover = false
      void requestLock({ steal: true })
    }
  }

  const openChannel = () => {
    if (channel || typeof BroadcastChannel === 'undefined') {
      return
    }
    channel = new BroadcastChannel(ADMIN_PHONE_CHANNEL_NAME)
    channel.onmessage = handleTabMessage
  }

  const closeChannel = () => {
    channel?.close()
    channel = null

    for (const answer of [...holderAnswers]) {
      answer(false)
    }
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
    openChannel()
    void takeOver(() => {
      waitForLock()
      waitingForHandover = true
    })
  }

  const stop = () => {
    active = false
    lockGeneration += 1
    takeOverGeneration += 1
    waitingForHandover = false
    otherTabInCall.value = false
    closeChannel()
    queuedRequest?.abort()
    queuedRequest = null
    releaseHeldLock()
    disable()
  }

  const useHere = () => {
    if (!active || state.value !== 'elsewhere' || otherTabInCall.value) {
      return
    }
    void takeOver(() => undefined)
  }

  const call = async (number: string) => {
    const target = number.trim()

    if (!isCallableNumber(target) || inCall.value) {
      return
    }
    if (state.value === 'elsewhere') {
      if (!active || otherTabInCall.value) {
        return
      }
      pendingNumber.value = target
      await takeOver(() => {
        pendingNumber.value = ''
      })
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
    const previous = { state: state.value, inCall: inCall.value }
    const next = applyPhoneIslandSignal(previous, signal)

    state.value = next.state
    inCall.value = next.inCall

    if (next.state === 'error') {
      pendingNumber.value = ''

      if (
        signal === 'connection_lost' &&
        previous.state !== 'error' &&
        !previous.inCall &&
        renewals < ADMIN_PHONE_RENEW_LIMIT
      ) {
        void renew()
      }
    }
    if (next.state === 'ready') {
      renewals = 0
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

  watch(inCall, (value) => {
    if (isHolder()) {
      postTabMessage({ type: 'status', inCall: value })
    }
  })

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
    otherTabInCall,
    errorMessage,
    extension,
    displayName,
    dataConfig,
    isEnabled,
    isConnecting,
    canCall,
    isCallBlocked,
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
