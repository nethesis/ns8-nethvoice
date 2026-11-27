<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// A tertiary button with only an icon, named by its tooltip. `tool` makes it gray, as the
// canvas tools; `pressed` marks a tool that is on.
const {
  icon,
  label,
  placement = 'top',
  tool = false,
  pressed = undefined,
  disabled = false,
  loading = false,
  iconClass = '',
} = defineProps<{
  icon: IconDefinition
  label: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  tool?: boolean
  pressed?: boolean
  disabled?: boolean
  loading?: boolean
  iconClass?: string
}>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <NeTooltip trigger-event="mouseenter focus" :placement="placement">
    <template #trigger>
      <NeButton
        kind="tertiary"
        :disabled="disabled"
        :loading="loading"
        :aria-pressed="pressed"
        :class="
          tool
            ? pressed
              ? 'bg-indigo-500/10! text-indigo-700! dark:bg-indigo-300/10! dark:text-indigo-500!'
              : 'text-gray-700! dark:text-gray-200!'
            : ''
        "
        @click="emit('click', $event)"
      >
        <FontAwesomeIcon :icon="icon" :class="iconClass || 'size-4'" aria-hidden="true" />
        <span class="sr-only">{{ label }}</span>
      </NeButton>
    </template>
    <template #content>{{ label }}</template>
  </NeTooltip>
</template>
