<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faAngleDown, faPhone } from '@fortawesome/free-solid-svg-icons'
import { NeDropdown, NeSpinner, NeTooltip, type NeDropdownItem } from '@nethesis/vue-components'
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
  'focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex h-9 items-center gap-3 transition-colors duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2'
</script>

<template>
  <div
    :class="[
      'bg-primary-700 dark:bg-primary-500 inline-flex items-stretch rounded-md text-sm font-medium text-white shadow-xs dark:text-gray-950',
      { 'opacity-50': disabled },
    ]"
    data-testid="call-split-button"
  >
    <NeTooltip trigger-event="mouseenter focus" class="inline-flex">
      <template #trigger>
        <button
          type="button"
          :class="[
            segmentClasses,
            'rounded-l-md pr-3 pl-3',
            disabled || loading
              ? 'cursor-not-allowed'
              : 'hover:bg-primary-800 dark:hover:bg-primary-300',
          ]"
          :disabled="disabled || loading"
          :aria-describedby="describedBy"
          data-testid="call-operator"
          @click="emit('call')"
        >
          <NeSpinner v-if="loading" size="4" color="white" />
          <FontAwesomeIcon v-else :icon="faPhone" class="size-4" aria-hidden="true" />
          {{ t('user_overview.call') }}
        </button>
      </template>
      <template #content>{{ tooltip }}</template>
    </NeTooltip>
    <span class="my-2 w-px bg-white dark:bg-gray-950" aria-hidden="true"></span>
    <span
      v-if="isMenuDisabled"
      :class="[segmentClasses, 'cursor-not-allowed rounded-r-md px-3']"
      data-testid="call-device-menu-disabled"
    >
      <FontAwesomeIcon :icon="faAngleDown" class="size-4" aria-hidden="true" />
      <span class="sr-only">{{ t('user_overview.call_device_unavailable') }}</span>
    </span>
    <NeDropdown
      v-else
      :items="deviceItems"
      :open-menu-aria-label="t('user_overview.call_device')"
      menu-classes="z-150!"
      class="flex *:focus-visible:outline-hidden"
      data-testid="call-device-menu"
    >
      <template #button>
        <span
          :class="[
            segmentClasses,
            'hover:bg-primary-800 dark:hover:bg-primary-300 in-focus-visible:ring-primary-500 dark:in-focus-visible:ring-primary-300 in-focus-visible:ring-offset-primary-950 rounded-r-md px-3 text-white in-focus-visible:ring-2 in-focus-visible:ring-offset-2 dark:text-gray-950',
          ]"
          aria-hidden="true"
        >
          <FontAwesomeIcon :icon="faAngleDown" class="size-4" />
        </span>
      </template>
    </NeDropdown>
  </div>
</template>
