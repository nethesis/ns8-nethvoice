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
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import { PRESENCE_DOT } from '@/components/overview/presence'
import type { OverviewUser } from '@/lib/overview/overview'

const { user, favorite = false } = defineProps<{ user: OverviewUser; favorite?: boolean }>()

const emit = defineEmits<{ details: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="bg-elevation-0 flex h-full min-w-0 flex-col gap-4 rounded-lg py-3 shadow-md">
    <div
      class="flex items-start justify-between gap-3 border-b border-gray-200 px-3 pb-2 dark:border-gray-700"
    >
      <div class="flex min-w-0 items-center gap-3">
        <OverviewAvatar :name="user.name" :presence="user.presence" :favorite="favorite" />
        <div class="min-w-0">
          <p class="text-primary-neutral truncate" :title="`${user.name} ${user.mainExtension}`">
            {{ user.name }} {{ user.mainExtension }}
          </p>
          <p v-if="user.groups.length" class="text-tertiary-neutral flex items-center gap-2">
            <FontAwesomeIcon :icon="faUserGroup" class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ user.groups.join(', ') }}</span>
          </p>
        </div>
      </div>
      <OverviewStatusLabel :status="user.presence" class="shrink-0" />
    </div>
    <div class="flex items-center gap-2 px-4">
      <ul class="flex min-w-0 grow flex-wrap items-center gap-2">
        <li v-for="device in user.devices" :key="device.extension">
          <NeTooltip trigger-event="mouseenter focus" placement="top">
            <template #trigger>
              <span
                class="relative flex size-8 items-center justify-center rounded-full bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-950"
                tabindex="0"
                data-testid="device-circle"
              >
                <FontAwesomeIcon
                  :icon="DEVICE_ICONS[device.type]"
                  class="size-4"
                  aria-hidden="true"
                />
                <span
                  :class="[
                    'ring-elevation-0 absolute right-0 bottom-0 size-2 rounded-full ring-2',
                    PRESENCE_DOT[device.status],
                  ]"
                ></span>
                <span class="sr-only">
                  {{ t(`user_overview.devices.${device.type}`) }} {{ device.extension }}
                  {{ t(`user_overview.status.${device.status}`) }}
                </span>
              </span>
            </template>
            <template #content>
              {{ t(`user_overview.devices.${device.type}`) }} {{ device.extension }} ·
              {{ t(`user_overview.status.${device.status}`) }}
            </template>
          </NeTooltip>
        </li>
      </ul>
      <NeTooltip trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <NeButton kind="tertiary" size="sm" class="p-2.5!" @click="emit('details')">
            <FontAwesomeIcon :icon="faEye" class="size-4" aria-hidden="true" />
            <span class="sr-only">{{ t('user_overview.show_details', { name: user.name }) }}</span>
          </NeButton>
        </template>
        <template #content>{{ t('common.show_details') }}</template>
      </NeTooltip>
    </div>
  </div>
</template>
