//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getNextStep, type SetupStepId } from '@/lib/setup/steps'
import { postWizardState } from '@/lib/setup/wizard'
import { useNotificationsStore } from '@/stores/notifications'

export function useSetupNavigation(stepId: SetupStepId) {
  const router = useRouter()
  const notificationsStore = useNotificationsStore()
  const advancing = ref(false)

  const goToNextStep = async (beforeAdvance?: () => Promise<boolean | void>) => {
    const nextStep = getNextStep(stepId)

    if (!nextStep) {
      return
    }
    advancing.value = true

    try {
      if (beforeAdvance && (await beforeAdvance()) === false) {
        return
      }
      await postWizardState(nextStep.legacyStep, true)
      await router.push({ name: `setup-${nextStep.id}` })
    } catch (error) {
      notificationsStore.createNotificationFromError(error)
    } finally {
      advancing.value = false
    }
  }

  return { advancing, goToNextStep }
}
