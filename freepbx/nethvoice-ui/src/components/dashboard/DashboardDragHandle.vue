<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faGripVertical } from '@fortawesome/free-solid-svg-icons'

const { card } = defineProps<{ card: string }>()

const emit = defineEmits<{ arm: []; move: [offset: number] }>()

const { t } = useI18n()

const KEY_OFFSETS: Record<string, number> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
}

function onKeydown(event: KeyboardEvent) {
  const offset = KEY_OFFSETS[event.key]

  if (offset !== undefined) {
    event.preventDefault()
    emit('move', offset)
  }
}
</script>

<template>
  <NeTooltip trigger-event="mouseenter focus" placement="top">
    <template #trigger>
      <button
        type="button"
        class="text-secondary-neutral focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex cursor-grab rounded-sm focus:outline-hidden focus-visible:ring-2 active:cursor-grabbing"
        :aria-label="t('dashboard.move_card', { card })"
        data-testid="drag-handle"
        @pointerdown="emit('arm')"
        @keydown="onKeydown"
      >
        <FontAwesomeIcon :icon="faGripVertical" class="size-4" aria-hidden="true" />
      </button>
    </template>
    <template #content>{{ t('dashboard.drag_to_reorder') }}</template>
  </NeTooltip>
</template>
