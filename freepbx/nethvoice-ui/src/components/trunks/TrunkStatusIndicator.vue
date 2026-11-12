<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleCheck,
  faCircleMinus,
  faCircleQuestion,
  faCircleXmark,
  faClock,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import type { ProviderStatus, RegistrationStatus } from '@/lib/trunks/liveState'
import type { GatewayStatus } from '@/lib/trunks/gateways'

export type TrunkStatus = ProviderStatus | RegistrationStatus | GatewayStatus

const { status } = defineProps<{ status: TrunkStatus }>()

const NEUTRAL = 'text-icon-neutral'
const SUCCESS = 'text-icon-enabled'
const DANGER = 'text-rose-700 dark:text-rose-500'

const STYLES: Record<TrunkStatus, { icon: IconDefinition; color: string }> = {
  pending: { icon: faClock, color: NEUTRAL },
  online: { icon: faCircleCheck, color: SUCCESS },
  registered: { icon: faCircleCheck, color: SUCCESS },
  connected: { icon: faCircleCheck, color: SUCCESS },
  unmonitored: { icon: faCircleMinus, color: NEUTRAL },
  offline: { icon: faCircleXmark, color: NEUTRAL },
  rejected: { icon: faCircleXmark, color: DANGER },
  not_connected: { icon: faCircleXmark, color: DANGER },
  unknown: { icon: faCircleQuestion, color: NEUTRAL },
}

const style = computed(() => STYLES[status])
</script>

<template>
  <span class="flex items-center gap-2">
    <FontAwesomeIcon
      :icon="style.icon"
      :class="['size-4 shrink-0', style.color]"
      aria-hidden="true"
    />
    <span>{{ $t(`trunks.status.${status}`) }}</span>
  </span>
</template>
