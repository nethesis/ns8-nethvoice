//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, onScopeDispose, ref, watch } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import type { NeNotificationV2 } from '@nethesis/vue-components'
import { isApiError } from '@/lib/api/errors'
import { IS_E2E } from '@/lib/config'
import { ctiGet } from '@/lib/dashboard/ctiClient'
import { isExtensionsLimitReached } from '@/lib/dashboard/subscription'
import {
  ADMIN_PHONE_ALERT_KEY,
  checkAdminPhone,
  checkExtensionsLimit,
  checkLiveService,
  checkTrunks,
  EXTENSIONS_LIMIT_ALERT_KEY,
  forgetNotifiedAlerts,
  LIVE_ALERT_KEY,
  readNotifiedAlerts,
  reconcileAlerts,
  SYSTEM_ALERTS_POLL_INTERVAL,
  TRUNK_ALERT_PREFIX,
  trunkNameOf,
  writeNotifiedAlerts,
  type AlertCheck,
} from '@/lib/notifications/systemAlerts'
import { parseTrunksLiveState, type TrunksLiveState } from '@/lib/trunks/liveState'
import { useDashboardSubscription } from '@/queries/dashboard/subscription'
import { usePermissions } from '@/queries/permissions/me'
import { useAdminPhoneStore } from '@/stores/adminPhone'
import { useLoginStore } from '@/stores/login'
import { describeError, isNetworkError, useNotificationsStore } from '@/stores/notifications'

type AlertNotification = Pick<NeNotificationV2, 'kind' | 'title' | 'description'>

const LIVE_TRUNKS_PATH = '/astproxy/trunks'

export const areSystemAlertsAllowed = (): boolean =>
  !IS_E2E || Reflect.get(window, 'e2eSystemAlerts') === true

const isForbidden = (error: unknown): boolean =>
  isApiError(error) && (error.status === 401 || error.status === 403)

const readLiveTrunks = (raw: unknown): TrunksLiveState | null => {
  try {
    return parseTrunksLiveState(raw)
  } catch {
    return null
  }
}

const isServiceDown = (error: unknown): boolean =>
  isNetworkError(error) || (isApiError(error) && error.status >= 500)

export const useSystemAlerts = (isEnabled: () => boolean) => {
  const { t } = useI18n()
  const loginStore = useLoginStore()
  const notificationsStore = useNotificationsStore()
  const adminPhoneStore = useAdminPhoneStore()
  const permissions = usePermissions()
  const { state: subscriptionState } = useDashboardSubscription()
  const visibility = useDocumentVisibility()

  const trunksForbidden = ref(false)
  let liveFailures = 0
  let liveError: unknown = null
  let polling: AbortController | null = null

  const running = computed(() => isEnabled() && loginStore.username !== '')
  const canSeeTrunks = computed(() => permissions.can('trunks') && !trunksForbidden.value)
  const isPolling = computed(
    () => running.value && canSeeTrunks.value && visibility.value === 'visible',
  )

  const describeAlert = (key: string, recovered: boolean): AlertNotification | null => {
    if (key.startsWith(TRUNK_ALERT_PREFIX)) {
      const name = trunkNameOf(key)

      return recovered
        ? {
            kind: 'success',
            title: t('system_alerts.trunk_up_title'),
            description: t('system_alerts.trunk_up_description', { name }),
          }
        : {
            kind: 'error',
            title: t('system_alerts.trunk_down_title'),
            description: t('system_alerts.trunk_down_description', { name }),
          }
    }
    switch (key) {
      case LIVE_ALERT_KEY:
        return recovered
          ? {
              kind: 'success',
              title: t('system_alerts.live_up_title'),
              description: t('system_alerts.live_up_description'),
            }
          : {
              kind: 'error',
              title: t('system_alerts.live_down_title'),
              description: describeError(liveError, { serverDetail: false }),
            }
      case EXTENSIONS_LIMIT_ALERT_KEY:
        return recovered
          ? null
          : {
              kind: 'warning',
              title: t('system_alerts.extensions_limit_title'),
              description: t('system_alerts.extensions_limit_description', {
                limit: subscriptionState.value.data?.extensionsLimit ?? 0,
              }),
            }
      case ADMIN_PHONE_ALERT_KEY:
        return recovered
          ? {
              kind: 'success',
              title: t('system_alerts.admin_phone_up_title'),
              description: t('system_alerts.admin_phone_up_description'),
            }
          : {
              kind: 'error',
              title: t('system_alerts.admin_phone_down_title'),
              description:
                adminPhoneStore.errorMessage || t('system_alerts.admin_phone_down_description'),
            }
      default:
        return null
    }
  }

  const update = (username: string, checks: AlertCheck[]) => {
    if (!running.value || username !== loginStore.username) {
      return
    }
    const { raised, recovered, notified } = reconcileAlerts(readNotifiedAlerts(username), checks)

    writeNotifiedAlerts(username, notified)

    for (const [keys, isRecovery] of [
      [raised, false],
      [recovered, true],
    ] as const) {
      for (const key of keys) {
        const notification = describeAlert(key, isRecovery)

        if (notification) {
          notificationsStore.createNotification(notification)
        }
      }
    }
  }

  const poll = async () => {
    if (polling) {
      return
    }
    const controller = new AbortController()
    const username = loginStore.username
    polling = controller

    try {
      const raw = await ctiGet(LIVE_TRUNKS_PATH, v.unknown(), controller.signal)
      const liveTrunks = readLiveTrunks(raw)

      liveFailures = 0
      update(username, [
        checkLiveService(0),
        ...(liveTrunks ? checkTrunks(readNotifiedAlerts(username), liveTrunks) : []),
      ])
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      if (isForbidden(error)) {
        trunksForbidden.value = true
        return
      }
      if (isServiceDown(error)) {
        liveFailures += 1
        liveError = error
        update(username, [checkLiveService(liveFailures)])
      }
    } finally {
      if (polling === controller) {
        polling = null
      }
    }
  }

  const stopPolling = () => {
    polling?.abort()
    polling = null
  }

  const { pause, resume } = useIntervalFn(() => void poll(), SYSTEM_ALERTS_POLL_INTERVAL, {
    immediate: false,
  })

  watch(
    isPolling,
    (active) => {
      if (active) {
        void poll()
        resume()
      } else {
        pause()
        stopPolling()
      }
    },
    { immediate: true },
  )

  watch(
    () => [running.value, permissions.can('users'), subscriptionState.value.data] as const,
    ([active, canSeeUsers, subscription]) => {
      if (active && canSeeUsers && subscription) {
        update(loginStore.username, [checkExtensionsLimit(isExtensionsLimitReached(subscription))])
      }
    },
    { immediate: true },
  )

  watch(
    () => [running.value, adminPhoneStore.state, adminPhoneStore.isEnabled] as const,
    ([active, state, enabled]) => {
      if (active) {
        update(loginStore.username, [checkAdminPhone(state, enabled)])
      }
    },
    { immediate: true },
  )

  watch(
    () => loginStore.username,
    (username, previous) => {
      if (previous && username !== previous) {
        forgetNotifiedAlerts(previous)
        stopPolling()
        liveFailures = 0
        liveError = null
        trunksForbidden.value = false
      }
    },
  )

  onScopeDispose(stopPolling)
}
