//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQueryCache } from '@pinia/colada'
import { getNextStep, type SetupStepId } from '@/lib/setup/steps'
import { getLegacyStepToSave } from '@/lib/setup/guard'
import { postWizardState, WIZARD_STATE_KEY } from '@/lib/setup/wizard'
import { useSetupGuard, withoutSetupCompletedError } from '@/composables/useSetupGuard'

type BeforeAdvance = () => Promise<boolean | void>

const SETUP_NAVIGATION_ERROR: InjectionKey<ComputedRef<unknown>> = Symbol('setupNavigationError')

export const useSetupNavigationError = (): ComputedRef<unknown> | undefined =>
  inject(SETUP_NAVIGATION_ERROR, undefined)

export function useSetupNavigation(stepId: SetupStepId) {
  const router = useRouter()
  const queryCache = useQueryCache()
  const { readSetupInProgress } = useSetupGuard()

  const {
    mutateAsync,
    isLoading: advancing,
    error,
    reset,
  } = useMutation({
    mutation: async (beforeAdvance?: BeforeAdvance) => {
      const nextStep = getNextStep(stepId)

      if (!nextStep) {
        return null
      }
      const savedState = await readSetupInProgress()

      if (beforeAdvance && (await beforeAdvance()) === false) {
        return null
      }
      await postWizardState(getLegacyStepToSave(nextStep.legacyStep, savedState), true)
      return nextStep
    },
    async onSuccess(nextStep) {
      if (!nextStep) {
        return
      }
      await queryCache.invalidateQueries({ key: [WIZARD_STATE_KEY] }).catch(() => undefined)
      await router.push({ name: `setup-${nextStep.id}` })
    },
  })

  const saveError = computed(() => withoutSetupCompletedError(error.value))

  provide(SETUP_NAVIGATION_ERROR, saveError)

  const goToNextStep = async (beforeAdvance?: BeforeAdvance) => {
    reset()
    await mutateAsync(beforeAdvance).catch(() => undefined)
  }

  return { advancing, goToNextStep, saveError }
}
