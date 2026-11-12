<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faCircleQuestion,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import SymbolNethvoice from '@/assets/symbol_nethvoice.svg'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import {
  getPreviousStep,
  getStepIndex,
  getStepProgress,
  SETUP_STEPS,
  type SetupStepId,
} from '@/lib/setup/steps'

const {
  stepId,
  title,
  description = '',
  nextLabel = '',
  nextDisabled = false,
  nextLoading = false,
  hideNextIcon = false,
  nextPrefixIcon,
  hideHeader = false,
} = defineProps<{
  stepId: SetupStepId
  title: string
  description?: string
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
  hideNextIcon?: boolean
  nextPrefixIcon?: IconDefinition
  hideHeader?: boolean
}>()

const emit = defineEmits<{ next: [] }>()

const router = useRouter()
const runtimeConfigStore = useRuntimeConfigStore()

const stepNumber = computed(() => getStepIndex(stepId) + 1)
const progress = computed(() => getStepProgress(stepId))

function goToPreviousStep() {
  const previousStep = getPreviousStep(stepId)
  router.push(previousStep ? { name: `setup-${previousStep.id}` } : { name: 'setup' })
}
</script>

<template>
  <div class="flex w-full">
    <aside
      class="elevation-0 hidden w-20 shrink-0 flex-col items-center justify-between border-r border-gray-200 py-10 sm:flex dark:border-gray-700"
    >
      <div
        class="bg-primary-700 dark:bg-primary-500 flex size-[50px] items-center justify-center rounded-md p-[5px]"
      >
        <img
          :src="SymbolNethvoice"
          :alt="$t('shell.brand_logo', { brand: runtimeConfigStore.config.brandName })"
          class="size-8 invert dark:invert-0"
        />
      </div>
      <NeTooltip trigger-event="mouseenter focus" placement="right">
        <template #trigger>
          <a
            :href="runtimeConfigStore.config.docsUrl"
            target="_blank"
            rel="noreferrer"
            class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 flex rounded-full p-2"
          >
            <span class="sr-only">{{ $t('common.need_help') }}</span>
            <FontAwesomeIcon :icon="faCircleQuestion" class="h-4 w-4" aria-hidden="true" />
          </a>
        </template>
        <template #content>{{ $t('common.need_help') }}</template>
      </NeTooltip>
    </aside>
    <main class="flex min-w-0 flex-1 flex-col gap-6 p-6 sm:p-10">
      <div class="flex flex-col items-center gap-2">
        <div
          class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          :aria-valuenow="stepNumber"
          aria-valuemin="1"
          :aria-valuemax="SETUP_STEPS.length"
          :aria-label="$t('setup.progress')"
        >
          <div
            class="h-2 rounded-full bg-linear-to-r from-emerald-500 to-indigo-500 transition-[width] duration-(--duration-large-enter) motion-reduce:transition-none"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <p class="text-secondary-neutral text-xs">
          {{ $t('setup.step_of', { step: stepNumber, total: SETUP_STEPS.length }) }}
        </p>
      </div>
      <div
        class="flex min-h-0 flex-1 flex-col gap-6 border-b border-gray-200 pb-8 dark:border-gray-700"
      >
        <div v-if="!hideHeader" class="flex flex-col gap-2">
          <h1 class="text-primary-neutral text-2xl font-medium">{{ title }}</h1>
          <p v-if="description" class="text-secondary-neutral max-w-3xl">{{ description }}</p>
          <slot name="description" />
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-1">
          <slot />
        </div>
      </div>
      <div class="flex items-center justify-end gap-8">
        <NeButton kind="tertiary" size="lg" :disabled="nextLoading" @click="goToPreviousStep">
          <template #prefix>
            <FontAwesomeIcon :icon="faArrowLeft" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ $t('common.previous') }}
        </NeButton>
        <NeButton
          kind="primary"
          size="lg"
          :loading="nextLoading"
          :disabled="nextDisabled || nextLoading"
          @click="emit('next')"
        >
          <template v-if="nextPrefixIcon" #prefix>
            <FontAwesomeIcon :icon="nextPrefixIcon" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ nextLabel || $t('common.next') }}
          <template v-if="!hideNextIcon" #suffix>
            <FontAwesomeIcon :icon="faArrowRight" class="h-4 w-4" aria-hidden="true" />
          </template>
        </NeButton>
      </div>
    </main>
  </div>
</template>
