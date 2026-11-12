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
  faCircleCheck,
  faCircleMinus,
  faCircleXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import type { OverviewStatus } from '@/lib/overview/overview'

const { status } = defineProps<{ status: OverviewStatus }>()

const { t } = useI18n()

const STATUS_ICONS: Record<OverviewStatus, { icon: IconDefinition; color: string }> = {
  online: { icon: faCircleCheck, color: 'text-green-700 dark:text-green-500' },
  busy: { icon: faCircleMinus, color: 'text-rose-700 dark:text-rose-500' },
  ringing: { icon: faCircle, color: 'text-rose-700 dark:text-rose-500' },
  dnd: { icon: faCircleMinus, color: 'text-rose-700 dark:text-rose-500' },
  offline: { icon: faCircleXmark, color: 'text-gray-500 dark:text-gray-400' },
}

const statusIcon = computed(() => STATUS_ICONS[status])
</script>

<template>
  <span class="text-secondary-neutral inline-flex items-center gap-1.5">
    <FontAwesomeIcon
      :icon="statusIcon.icon"
      :class="['size-3.5', statusIcon.color]"
      aria-hidden="true"
    />
    {{ t(`user_overview.status.${status}`) }}
  </span>
</template>
