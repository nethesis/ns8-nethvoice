<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircle,
  faCircleArrowRight,
  faCircleCheck,
  faCircleMinus,
  faCircleXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import type { OverviewStatus } from '@/lib/overview/overview'

const { status, emphasis = false } = defineProps<{ status: OverviewStatus; emphasis?: boolean }>()

const { t } = useI18n()

const STATUS_ICONS: Record<OverviewStatus, { icon: IconDefinition; color: string }> = {
  online: { icon: faCircleCheck, color: 'text-icon-enabled' },
  busy: { icon: faCircleMinus, color: 'text-danger' },
  ringing: { icon: faCircle, color: 'text-danger' },
  dnd: { icon: faCircleMinus, color: 'text-danger' },
  forward: { icon: faCircleArrowRight, color: 'text-amber-700 dark:text-amber-500' },
  offline: { icon: faCircleXmark, color: 'text-gray-500 dark:text-gray-400' },
}

const statusIcon = computed(() => STATUS_ICONS[status])
</script>

<template>
  <span
    :class="[
      'inline-flex items-center',
      emphasis ? 'text-primary-neutral gap-1.5' : 'text-secondary-neutral gap-2',
    ]"
  >
    <FontAwesomeIcon
      :icon="statusIcon.icon"
      :class="['size-4', statusIcon.color]"
      aria-hidden="true"
    />
    {{ t(`user_overview.status.${status}`) }}
  </span>
</template>
