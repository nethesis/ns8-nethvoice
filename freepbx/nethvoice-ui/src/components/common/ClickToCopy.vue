<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeTooltip } from '@nethesis/vue-components'
import type { TooltipPlacement } from '@nethesis/vue-components/components/NeTooltip.vue.js'
import { onBeforeUnmount, ref } from 'vue'

const COPIED_FEEDBACK_MS = 2000

const { text, tooltipPlacement = 'top' } = defineProps<{
  text: string
  tooltipPlacement?: TooltipPlacement
}>()

const justCopied = ref(false)
let feedbackTimeout: ReturnType<typeof setTimeout> | undefined

const documentObj = typeof document !== 'undefined' ? document : null

const onClick = () => {
  if (!text || !navigator.clipboard) {
    return
  }
  navigator.clipboard
    .writeText(text)
    .then(() => {
      justCopied.value = true
      clearTimeout(feedbackTimeout)
      feedbackTimeout = setTimeout(() => {
        justCopied.value = false
      }, COPIED_FEEDBACK_MS)
    })
    .catch((err) => {
      console.error('Cannot copy text:', err)
    })
}

onBeforeUnmount(() => clearTimeout(feedbackTimeout))
</script>

<template>
  <NeTooltip
    trigger-event="mouseenter focus"
    :placement="tooltipPlacement"
    :hide-on-click="false"
    :append-to="() => documentObj?.body"
    @click="onClick"
  >
    <template #trigger>
      <button
        type="button"
        class="cursor-pointer rounded-sm text-left hover:underline"
        data-testid="click-to-copy"
      >
        {{ text }}
      </button>
      <span class="sr-only" aria-live="polite">{{ justCopied ? $t('common.copied') : '' }}</span>
    </template>
    <template #content>
      {{ justCopied ? $t('common.copied') : $t('common.click_to_copy') }}
    </template>
  </NeTooltip>
</template>
