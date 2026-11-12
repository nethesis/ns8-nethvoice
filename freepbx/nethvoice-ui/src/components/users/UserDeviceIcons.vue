<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { DEVICE_ICONS } from '@/lib/users/deviceIcons'
import type { SoftwareDeviceType } from '@/lib/users/users'

const { devices } = defineProps<{
  devices: SoftwareDeviceType[]
}>()
</script>

<template>
  <div class="flex items-center gap-3">
    <span v-if="devices.length === 0" class="text-tertiary-neutral">-</span>
    <NeTooltip
      v-for="device in devices"
      :key="device"
      trigger-event="mouseenter focus"
      placement="top"
    >
      <template #trigger>
        <span
          tabindex="0"
          class="text-primary-neutral flex rounded-sm"
          :data-testid="`device-${device}`"
        >
          <FontAwesomeIcon :icon="DEVICE_ICONS[device]" class="size-4" aria-hidden="true" />
          <span class="sr-only">{{ $t(`users.device_enabled_${device}`) }}</span>
        </span>
      </template>
      <template #content>{{ $t(`users.device_enabled_${device}`) }}</template>
    </NeTooltip>
  </div>
</template>
