<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeButton, NeInlineNotification, NeLink } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowUpRightFromSquare,
  faGear,
  faNetworkWired,
  faRoute,
  faUserGroup,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import BrandLogo from '@/components/shell/BrandLogo.vue'
import SetupSignOutButton from './SetupSignOutButton.vue'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { describeError } from '@/stores/notifications'
import { getCurrentSetupRoute } from '@/lib/setup/guard'
import { SETUP_STEPS } from '@/lib/setup/steps'
import { postWizardState, WIZARD_STATE_KEY } from '@/lib/setup/wizard'
import { useSetupGuard, withoutSetupCompletedError } from '@/composables/useSetupGuard'

type Topic = { id: string; icon: IconDefinition }

const router = useRouter()
const queryCache = useQueryCache()
const runtimeConfigStore = useRuntimeConfigStore()
const { readSetupInProgress } = useSetupGuard()
const checking = ref(false)
const titleRef = useTemplateRef<HTMLElement>('titleRef')

onMounted(() => titleRef.value?.focus({ preventScroll: true }))

const topics: Topic[] = [
  { id: 'pbx_settings', icon: faGear },
  { id: 'extensions', icon: faUserGroup },
  { id: 'trunks', icon: faNetworkWired },
  { id: 'call_routing', icon: faRoute },
]

const {
  mutate: startSetup,
  isLoading: starting,
  error: startError,
} = useMutation({
  mutation: async () => {
    const [firstStep] = SETUP_STEPS
    checking.value = true
    const savedState = await readSetupInProgress()
    checking.value = false

    if (savedState.legacyStep > firstStep.legacyStep) {
      await router.push(getCurrentSetupRoute(savedState))
      return
    }
    await postWizardState(firstStep.legacyStep, true)
    await queryCache.invalidateQueries({ key: [WIZARD_STATE_KEY] }).catch(() => undefined)
    await router.push({ name: `setup-${firstStep.id}` })
  },
})

const startErrorShown = computed(() => withoutSetupCompletedError(startError.value))
</script>

<template>
  <div class="flex w-full flex-col lg:flex-row">
    <aside
      class="elevation-0 flex shrink-0 flex-col items-center justify-center gap-6 border-b border-gray-200 p-12 lg:w-100 lg:border-r lg:border-b-0 dark:border-gray-700"
    >
      <BrandLogo class="h-8.25 w-auto" />
      <p class="text-primary-neutral text-center text-lg font-medium">
        {{ $t('setup.welcome.sidebar_title') }}
      </p>
      <p class="text-tertiary-neutral text-center">
        {{
          $t('setup.welcome.sidebar_description', { brand: runtimeConfigStore.config.brandName })
        }}
      </p>
      <div class="flex flex-col items-center gap-4">
        <NeLink
          v-if="runtimeConfigStore.showDocs"
          :href="runtimeConfigStore.docsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2"
        >
          {{ $t('common.need_help') }}
          <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="size-4" aria-hidden="true" />
          <span class="sr-only">{{ $t('common.opens_in_new_tab') }}</span>
        </NeLink>
        <SetupSignOutButton />
      </div>
    </aside>
    <main class="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-10">
      <div class="flex flex-col gap-12 border-b border-gray-200 pt-8 pb-10 dark:border-gray-700">
        <div class="flex flex-col gap-6">
          <h1
            ref="titleRef"
            tabindex="-1"
            class="text-primary-neutral text-2xl font-medium text-balance focus:outline-none"
          >
            {{ $t('setup.welcome.title', { brand: runtimeConfigStore.config.brandName }) }}
          </h1>
          <p class="text-secondary-neutral">
            {{
              $t('setup.welcome.description_line_1', {
                brand: runtimeConfigStore.config.brandName,
              })
            }}<br />
            {{ $t('setup.welcome.description_line_2') }}
          </p>
        </div>
        <ul class="flex flex-col gap-10">
          <li v-for="topic in topics" :key="topic.id" class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon
                :icon="topic.icon"
                class="text-primary-neutral h-6 w-6"
                aria-hidden="true"
              />
              <h2 class="text-primary-neutral text-base font-medium">
                {{ $t(`setup.welcome.${topic.id}`) }}
              </h2>
            </div>
            <p class="text-tertiary-neutral">
              {{ $t(`setup.welcome.${topic.id}_description`) }}
            </p>
          </li>
        </ul>
      </div>
      <NeInlineNotification
        v-if="startErrorShown"
        kind="error"
        :title="checking ? $t('setup.cannot_check_setup') : $t('setup.cannot_save_progress')"
        :description="describeError(startErrorShown, { serverDetail: false })"
      />
      <div class="flex items-center justify-end gap-8">
        <NeButton
          kind="primary"
          size="lg"
          :loading="starting"
          :disabled="starting"
          @click="startSetup()"
        >
          {{ $t('setup.welcome.start_setup') }}
        </NeButton>
      </div>
    </main>
  </div>
</template>
