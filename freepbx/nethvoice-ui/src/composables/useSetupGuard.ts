//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SETUP_STEPS } from '@/lib/setup/steps'
import type { WizardState } from '@/lib/setup/wizard'
import { fetchWizardState } from '@/queries/setup/wizardState'
import { useNotificationsStore } from '@/stores/notifications'

export class SetupCompletedError extends Error {
  constructor() {
    super('setup_completed')
    this.name = 'SetupCompletedError'
  }
}

export const isSetupCompletedError = (error: unknown): error is SetupCompletedError =>
  error instanceof SetupCompletedError

export const withoutSetupCompletedError = (error: unknown): unknown =>
  isSetupCompletedError(error) ? null : error

export function useSetupGuard() {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const notificationsStore = useNotificationsStore()

  const leaveCompletedSetup = async () => {
    notificationsStore.createNotification({
      kind: 'info',
      title: t('setup.setup_already_completed'),
      description: t('setup.setup_already_completed_description'),
    })
    await router.replace({ name: 'dashboard' })
  }

  const readSetupInProgress = async (): Promise<WizardState> => {
    const savedState = await fetchWizardState()

    if (!savedState.inProgress) {
      await leaveCompletedSetup()
      throw new SetupCompletedError()
    }
    return savedState
  }

  const ensureSetupInProgress = async (): Promise<void> => {
    if (SETUP_STEPS.some((step) => route.name === `setup-${step.id}`)) {
      await readSetupInProgress()
    }
  }

  return { readSetupInProgress, ensureSetupInProgress }
}
