<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryCache } from '@pinia/colada'
import { NeButton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleQuestion,
  faGear,
  faNetworkWired,
  faRoute,
  faUserGroup,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import BrandLogo from '@/components/shell/BrandLogo.vue'
import SetupSignOutButton from './SetupSignOutButton.vue'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { useNotificationsStore } from '@/stores/notifications'
import { getCurrentSetupRoute } from '@/lib/setup/guard'
import { SETUP_STEPS } from '@/lib/setup/steps'
import { postWizardState, WIZARD_STATE_KEY } from '@/lib/setup/wizard'
import { useWizardState } from '@/queries/setup/wizardState'

type Topic = { id: string; icon: IconDefinition }

const { t } = useI18n()
const router = useRouter()
const queryCache = useQueryCache()
const { state: wizardState } = useWizardState()
const runtimeConfigStore = useRuntimeConfigStore()
const notificationsStore = useNotificationsStore()
const starting = ref(false)
const titleRef = useTemplateRef<HTMLElement>('titleRef')

onMounted(() => titleRef.value?.focus({ preventScroll: true }))

const topics: Topic[] = [
  { id: 'pbx_settings', icon: faGear },
  { id: 'extensions', icon: faUserGroup },
  { id: 'trunks', icon: faNetworkWired },
  { id: 'call_routing', icon: faRoute },
]

function openDocs() {
  window.open(runtimeConfigStore.docsUrl, '_blank', 'noopener')
}

async function startSetup() {
  const [firstStep] = SETUP_STEPS
  starting.value = true

  try {
    const savedState = wizardState.value.data

    if (savedState?.inProgress && savedState.legacyStep > firstStep.legacyStep) {
      await router.push(getCurrentSetupRoute(savedState))
      return
    }
    await postWizardState(firstStep.legacyStep, true)
    await queryCache.invalidateQueries({ key: [WIZARD_STATE_KEY] })
    await router.push({ name: `setup-${firstStep.id}` })
  } catch (error) {
    notificationsStore.createNotificationFromError(error, t('setup.cannot_save_progress'), {
      serverDetail: false,
    })
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col lg:flex-row">
    <aside
      class="elevation-0 flex shrink-0 flex-col items-center justify-center gap-6 border-b border-gray-200 p-12 lg:w-100 lg:border-r lg:border-b-0 dark:border-gray-700"
    >
      <BrandLogo class="h-8.25 w-auto" />
      <p class="text-primary-neutral text-center text-xl font-medium">
        {{ $t('setup.welcome.sidebar_title') }}
      </p>
      <p class="text-tertiary-neutral text-center text-xs">
        {{
          $t('setup.welcome.sidebar_description', { brand: runtimeConfigStore.config.brandName })
        }}
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <NeButton kind="tertiary" size="lg" @click="openDocs">
          <template #prefix>
            <FontAwesomeIcon :icon="faCircleQuestion" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ $t('common.need_help') }}
        </NeButton>
        <SetupSignOutButton />
      </div>
    </aside>
    <main class="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-10">
      <div class="flex flex-col gap-12 border-b border-gray-200 pt-8 pb-10 dark:border-gray-700">
        <div class="flex flex-col gap-6">
          <h1
            ref="titleRef"
            tabindex="-1"
            class="text-primary-neutral text-3xl font-medium text-balance focus:outline-none"
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
              <h2 class="text-primary-neutral text-lg font-medium uppercase">
                {{ $t(`setup.welcome.${topic.id}`) }}
              </h2>
            </div>
            <p class="text-tertiary-neutral">
              {{ $t(`setup.welcome.${topic.id}_description`) }}
            </p>
          </li>
        </ul>
      </div>
      <div class="flex items-center justify-end gap-8">
        <NeButton
          kind="primary"
          size="lg"
          :loading="starting"
          :disabled="starting"
          @click="startSetup"
        >
          {{ $t('setup.welcome.start_setup') }}
        </NeButton>
      </div>
    </main>
  </div>
</template>
