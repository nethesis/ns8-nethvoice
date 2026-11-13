//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { useQueryCache } from '@pinia/colada'
import i18n from '@/i18n'
import {
  ADMIN_PHONE_RELOAD_DELAY,
  ADMIN_PHONE_STATUS_KEY,
  applyPhoneIslandSignal,
  buildPhoneIslandConfig,
  forgetServiceExtension,
  isCallableNumber,
  PHONE_ISLAND_CALL_START_EVENT,
  postAdminPhoneRotate,
  postAdminPhoneSession,
  rememberServiceExtension,
  toPhoneIslandSignal,
  type AdminPhoneSession,
  type AdminPhoneState,
} from '@/lib/adminPhone/adminPhone'
import { useLoginStore } from '@/stores/login'
import { describeError, useNotificationsStore } from '@/stores/notifications'

export const COST_NOTICE_STORAGE_KEY = 'nethvoiceAdminPhoneCostNotice'

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const readCostNoticeShown = (): boolean => {
  try {
    return sessionStorage.getItem(COST_NOTICE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const saveCostNoticeShown = () => {
  try {
    sessionStorage.setItem(COST_NOTICE_STORAGE_KEY, 'true')
  } catch {
    return
  }
}

export const useAdminPhoneStore = defineStore('adminPhone', () => {
  const loginStore = useLoginStore()
  const queryCache = useQueryCache()
  const notificationsStore = useNotificationsStore()
  const { t } = i18n.global

  const state = ref<AdminPhoneState>('inactive')
  const inCall = ref(false)
  const errorMessage = ref('')
  const session = shallowRef<AdminPhoneSession | null>(null)
  const pendingNumber = ref('')
  const isRotating = ref(false)
  let costNoticeShown = readCostNoticeShown()
  let attempt = 0

  const extension = computed(() => session.value?.extension ?? '')
  const displayName = computed(() => session.value?.displayName ?? '')
  const dataConfig = computed(() => (session.value ? buildPhoneIslandConfig(session.value) : ''))
  const isEnabled = computed(() => state.value === 'starting' || session.value !== null)
  const isConnecting = computed(() => state.value === 'starting' || state.value === 'registering')
  const canCall = computed(() => state.value === 'ready' && !inCall.value)

  const showCostNotice = () => {
    if (costNoticeShown) {
      return
    }
    costNoticeShown = true
    saveCostNoticeShown()
    notificationsStore.createNotification({
      kind: 'info',
      title: t('admin_phone.cost_notice_title'),
      description: t('admin_phone.cost_notice_description'),
    })
  }

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

  const toggle = () => (isEnabled.value ? disable() : enable())

  const call = async (number: string) => {
    const target = number.trim()

    if (!isCallableNumber(target) || inCall.value) {
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
      showCostNotice()

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

  const rotate = async () => {
    const wasEnabled = isEnabled.value

    isRotating.value = true
    try {
      await postAdminPhoneRotate()
      notificationsStore.createNotification({
        kind: 'success',
        title: t('admin_phone.credentials_regenerated'),
        description: t('admin_phone.credentials_regenerated_description'),
      })

      if (wasEnabled) {
        disable()
        await wait(ADMIN_PHONE_RELOAD_DELAY)
        await enable()
      }
    } catch (error) {
      notificationsStore.createNotificationFromError(
        error,
        t('admin_phone.cannot_regenerate_credentials'),
      )
    } finally {
      isRotating.value = false
    }
  }

  watch(
    () => loginStore.isAuthenticated,
    (authenticated) => {
      if (!authenticated) {
        disable()
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
    isRotating,
    enable,
    disable,
    toggle,
    call,
    handleIslandEvent,
    fail,
    rotate,
  }
})
