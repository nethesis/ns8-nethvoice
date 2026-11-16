<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faAngleDown, faPhone } from '@fortawesome/free-solid-svg-icons'
import { NeButton, NeDropdown, NeTooltip, type NeDropdownItem } from '@nethesis/vue-components'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import type { OverviewDevice } from '@/lib/overview/overview'

const {
  devices,
  disabled = false,
  loading = false,
  tooltip,
  describedBy = undefined,
} = defineProps<{
  devices: OverviewDevice[]
  disabled?: boolean
  loading?: boolean
  tooltip: string
  describedBy?: string
}>()

const emit = defineEmits<{ call: [extension?: string] }>()

const { t } = useI18n()

const deviceItems = computed<NeDropdownItem[]>(() =>
  devices
    .filter((device) => device.status !== 'offline')
    .map((device) => ({
      id: `device-${device.extension}`,
      label: device.extension,
      icon: DEVICE_ICONS[device.type],
      action: () => emit('call', device.extension),
    })),
)

const isMenuDisabled = computed(() => disabled || loading || deviceItems.value.length === 0)

const segmentClasses =
  'flex h-9 items-center gap-3 rounded-r-md bg-primary-700 pr-3 text-white shadow-sm transition-colors duration-200 dark:bg-primary-500 dark:text-gray-950'
const dividerClasses = 'h-5 w-px bg-white dark:bg-gray-950'
</script>

<template>
  <div class="inline-flex items-stretch" data-testid="call-split-button">
    <NeTooltip trigger-event="mouseenter focus" class="inline-flex">
      <template #trigger>
        <NeButton
          kind="primary"
          size="lg"
          class="rounded-r-none!"
          :disabled="disabled"
          :loading="loading"
          :aria-describedby="describedBy"
          data-testid="call-operator"
          @click="emit('call')"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faPhone" class="size-4" aria-hidden="true" />
          </template>
          {{ t('user_overview.call') }}
        </NeButton>
      </template>
      <template #content>{{ tooltip }}</template>
    </NeTooltip>
    <span
      v-if="isMenuDisabled"
      :class="[segmentClasses, 'cursor-not-allowed opacity-50']"
      data-testid="call-device-menu-disabled"
    >
      <span :class="dividerClasses" aria-hidden="true"></span>
      <FontAwesomeIcon :icon="faAngleDown" class="size-4" aria-hidden="true" />
      <span class="sr-only">{{ t('user_overview.call_device_unavailable') }}</span>
    </span>
    <NeDropdown
      v-else
      :items="deviceItems"
      :open-menu-aria-label="t('user_overview.call_device')"
      menu-classes="z-150!"
      class="*:focus-visible:outline-hidden"
      data-testid="call-device-menu"
    >
      <template #button>
        <span
          :class="[
            segmentClasses,
            'in-focus-visible:ring-primary-500 dark:in-focus-visible:ring-primary-300 hover:bg-primary-800 dark:hover:bg-primary-300 dark:in-focus-visible:ring-offset-primary-950 in-focus-visible:ring-2 in-focus-visible:ring-offset-2 in-focus-visible:ring-offset-white',
          ]"
          aria-hidden="true"
        >
          <span :class="dividerClasses"></span>
          <FontAwesomeIcon :icon="faAngleDown" class="size-4" />
        </span>
      </template>
    </NeDropdown>
  </div>
</template>
