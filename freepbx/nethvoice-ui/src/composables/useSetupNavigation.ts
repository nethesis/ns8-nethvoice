//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryCache } from '@pinia/colada'
import { getNextStep, type SetupStepId } from '@/lib/setup/steps'
import { getLegacyStepToSave } from '@/lib/setup/guard'
import { postWizardState, WIZARD_STATE_KEY } from '@/lib/setup/wizard'
import { useWizardState } from '@/queries/setup/wizardState'
import { useNotificationsStore } from '@/stores/notifications'

export function useSetupNavigation(stepId: SetupStepId) {
  const { t } = useI18n()
  const router = useRouter()
  const queryCache = useQueryCache()
  const { state: wizardState } = useWizardState()
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
      await postWizardState(getLegacyStepToSave(nextStep.legacyStep, wizardState.value.data), true)
      await queryCache.invalidateQueries({ key: [WIZARD_STATE_KEY] })
      await router.push({ name: `setup-${nextStep.id}` })
    } catch (error) {
      notificationsStore.createNotificationFromError(error, t('setup.cannot_save_progress'), {
        serverDetail: false,
      })
    } finally {
      advancing.value = false
    }
  }

  return { advancing, goToNextStep }
}
