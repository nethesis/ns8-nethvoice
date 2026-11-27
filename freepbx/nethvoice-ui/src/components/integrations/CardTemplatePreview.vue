<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, toRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { refDebounced } from '@vueuse/core'
import {
  NeFormItemLabel,
  NeInlineNotification,
  NeSkeleton,
  NeSpinner,
  NeTextArea,
} from '@nethesis/vue-components'
import {
  buildCardPreviewDocument,
  EXAMPLE_RESULTS,
  getTemplateRenderError,
  parseSampleResults,
  type SampleResultsCheck,
} from '@/lib/integrations/cardTemplates'
import {
  type CardTemplatePreviewInput,
  useCardTemplatePreview,
} from '@/queries/integrations/customerCards'
import { describeError } from '@/stores/notifications'
import { useThemeStore } from '@/stores/theme'

const PREVIEW_DELAY = 400
const UPDATING_DELAY = 500

const {
  code,
  name,
  disabled = false,
} = defineProps<{
  code: string
  name: string
  disabled?: boolean
}>()

const sample = defineModel<string | undefined>('sample')

const { t } = useI18n()
const themeStore = useThemeStore()
const labelId = useId()

const debouncedCode = refDebounced(
  toRef(() => code),
  PREVIEW_DELAY,
)
const debouncedSample = refDebounced(sample, PREVIEW_DELAY)

const sampleCheck = computed<SampleResultsCheck>(() =>
  debouncedSample.value === undefined
    ? { results: EXAMPLE_RESULTS }
    : parseSampleResults(debouncedSample.value),
)

const input = ref<CardTemplatePreviewInput>()

watch(
  [debouncedCode, sampleCheck],
  () => {
    const { results } = sampleCheck.value

    if (results && debouncedCode.value.trim()) {
      input.value = { code: debouncedCode.value, results }
    }
  },
  { immediate: true },
)

const { state, asyncStatus } = useCardTemplatePreview(input)

const updating = refDebounced(
  computed(() => asyncStatus.value === 'loading' && state.value.data !== undefined),
  UPDATING_DELAY,
)

const renderError = computed(() =>
  state.value.status === 'error' ? getTemplateRenderError(state.value.error) : '',
)
</script>

<template>
  <NeTextArea
    v-if="sample !== undefined"
    v-model="sample"
    :label="t('integrations.cards.sample_results')"
    :rows="4"
    class="[&_textarea]:font-mono"
    :helper-text="t('integrations.cards.sample_results_helper')"
    :invalid-message="sampleCheck.issue ? t(sampleCheck.issue) : ''"
    :disabled="disabled"
  />
  <section class="flex flex-col" :aria-labelledby="labelId">
    <div class="flex flex-wrap items-start justify-between gap-x-2">
      <NeFormItemLabel :id="labelId">{{ t('integrations.cards.preview') }}</NeFormItemLabel>
      <div
        v-if="updating && asyncStatus === 'loading'"
        role="status"
        class="text-tertiary-neutral flex items-center gap-2 text-sm"
      >
        <NeSpinner color="gray" size="4" />
        <span>{{ t('integrations.cards.preview_updating') }}</span>
      </div>
    </div>
    <p v-if="sample === undefined" class="text-tertiary-neutral mb-2 text-sm">
      {{ t('integrations.cards.preview_example_results') }}
    </p>
    <p v-if="!themeStore.isLight" class="text-tertiary-neutral mb-2 text-sm">
      {{ t('integrations.cards.preview_light_background') }}
    </p>
    <NeInlineNotification
      v-if="state.status === 'error'"
      kind="error"
      :title="t('integrations.cards.template_preview_failed')"
      :description="renderError ? '' : describeError(state.error)"
    >
      <template v-if="renderError" #description>
        <p>{{ t('integrations.cards.template_render_failed_description') }}</p>
        <pre class="mt-2 font-mono text-xs wrap-break-word whitespace-pre-wrap">{{
          renderError
        }}</pre>
      </template>
    </NeInlineNotification>
    <div v-else-if="state.data !== undefined" class="border-secondary rounded-md border p-4">
      <iframe
        :srcdoc="buildCardPreviewDocument(state.data)"
        sandbox=""
        referrerpolicy="no-referrer"
        :title="t('integrations.cards.preview_of', { name })"
        class="h-80 w-full rounded-md bg-white"
      />
    </div>
    <NeSkeleton v-else-if="asyncStatus === 'loading'" :lines="6" />
  </section>
</template>
