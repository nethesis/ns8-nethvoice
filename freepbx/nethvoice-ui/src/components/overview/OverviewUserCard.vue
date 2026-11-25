<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faEye, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import OverviewAvatar from '@/components/overview/OverviewAvatar.vue'
import OverviewCallNumber from '@/components/overview/OverviewCallNumber.vue'
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import type { OverviewDevice, OverviewUser } from '@/lib/overview/overview'

const { user, favorite = false } = defineProps<{ user: OverviewUser; favorite?: boolean }>()

const emit = defineEmits<{ details: [] }>()

const { t } = useI18n()

const deviceLabel = (device: OverviewDevice) =>
  device.type === 'physical' && device.model
    ? device.model
    : t(`user_overview.devices.${device.type}`)
</script>

<template>
  <article class="bg-elevation-0 h-full rounded-lg shadow-sm">
    <header class="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <OverviewAvatar :name="user.name" :presence="user.presence" :favorite="favorite" />
      <div class="min-w-0 flex-1">
        <p class="text-primary-neutral truncate text-sm" :title="user.name">{{ user.name }}</p>
        <OverviewStatusLabel
          :status="user.presence"
          class="text-sm"
          data-testid="overview-card-presence"
        />
        <p
          v-if="user.groups.length"
          class="text-tertiary-neutral flex items-center gap-1.5 text-sm"
        >
          <FontAwesomeIcon :icon="faUserGroup" class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="truncate" :title="user.groups.join(', ')">{{ user.groups.join(', ') }}</span>
        </p>
      </div>
      <NeTooltip trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <NeButton kind="tertiary" size="sm" class="p-2.5!" @click="emit('details')">
            <FontAwesomeIcon :icon="faEye" class="size-4" aria-hidden="true" />
            <span class="sr-only">{{ t('user_overview.show_details', { name: user.name }) }}</span>
          </NeButton>
        </template>
        <template #content>{{ t('common.show_details') }}</template>
      </NeTooltip>
    </header>
    <ul class="px-4 py-2">
      <li
        v-for="device in user.devices"
        :key="device.extension"
        class="ml-2 flex items-center gap-4 border-gray-200 py-2.5 not-first:border-t dark:border-gray-700"
        data-testid="device-row"
      >
        <NeTooltip trigger-event="mouseenter focus" placement="top">
          <template #trigger>
            <span
              tabindex="0"
              class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex rounded focus:outline-hidden focus-visible:ring-2"
              :aria-label="deviceLabel(device)"
              role="img"
            >
              <FontAwesomeIcon
                :icon="DEVICE_ICONS[device.type]"
                class="text-tertiary-neutral size-6 shrink-0"
                aria-hidden="true"
              />
            </span>
          </template>
          <template #content>{{ deviceLabel(device) }}</template>
        </NeTooltip>
        <div class="text-sm">
          <div class="-ml-2">
            <OverviewCallNumber :device="device" />
          </div>
          <OverviewStatusLabel :status="device.status" emphasis />
        </div>
      </li>
      <li v-if="user.devices.length === 0" class="text-tertiary-neutral ml-2 py-2.5 text-sm">
        {{ t('user_overview.no_devices') }}
      </li>
    </ul>
  </article>
</template>
