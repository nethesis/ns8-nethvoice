<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faEye } from '@fortawesome/free-solid-svg-icons'
import {
  NeButton,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTooltip,
} from '@nethesis/vue-components'
import OverviewAvatar from '@/components/overview/OverviewAvatar.vue'
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import type { OverviewDevice, OverviewUser } from '@/lib/overview/overview'

const { users, loading = false } = defineProps<{
  users: OverviewUser[]
  loading?: boolean
  isFavorite: (username: string) => boolean
}>()

const emit = defineEmits<{ details: [user: OverviewUser] }>()

const { t } = useI18n()

const deviceLabel = (device: OverviewDevice) =>
  device.type === 'physical' && device.model
    ? device.model
    : t(`user_overview.devices.${device.type}`)
</script>

<template>
  <NeTable
    :aria-label="t('user_overview.table_label')"
    card-breakpoint="lg"
    :loading="loading"
    :skeleton-columns="5"
    :skeleton-rows="8"
  >
    <NeTableHead>
      <NeTableHeadCell>{{ t('common.name') }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t('user_overview.groups') }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t('user_overview.devices_title') }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t('common.status') }}</NeTableHeadCell>
      <NeTableHeadCell>
        <span class="sr-only">{{ t('common.actions') }}</span>
      </NeTableHeadCell>
    </NeTableHead>
    <NeTableBody>
      <NeTableRow v-for="user in users" :key="user.username" :data-user="user.username">
        <NeTableCell :data-label="t('common.name')">
          <div class="flex items-center gap-3">
            <OverviewAvatar
              :name="user.name"
              :presence="user.presence"
              :favorite="isFavorite(user.username)"
              size="sm"
              variant="row"
            />
            {{ user.name }}
          </div>
        </NeTableCell>
        <NeTableCell :data-label="t('user_overview.groups')">
          {{ user.groups.length ? user.groups.join(', ') : '-' }}
        </NeTableCell>
        <NeTableCell :data-label="t('user_overview.devices_title')">
          <ul v-if="user.devices.length" class="flex flex-wrap gap-x-4 gap-y-1">
            <li v-for="device in user.devices" :key="device.extension" data-testid="device-item">
              <NeTooltip trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <span
                    tabindex="0"
                    class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 inline-flex items-center gap-1.5 rounded-sm focus:outline-hidden focus-visible:ring-2"
                  >
                    <FontAwesomeIcon
                      :icon="DEVICE_ICONS[device.type]"
                      class="text-tertiary-neutral size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span class="sr-only">{{ deviceLabel(device) }}</span>
                    {{ device.extension }}
                    <span class="sr-only">{{ t(`user_overview.status.${device.status}`) }}</span>
                  </span>
                </template>
                <template #content>
                  {{ deviceLabel(device) }} · {{ t(`user_overview.status.${device.status}`) }}
                </template>
              </NeTooltip>
            </li>
          </ul>
          <template v-else>-</template>
        </NeTableCell>
        <NeTableCell :data-label="t('common.status')">
          <OverviewStatusLabel :status="user.presence" />
        </NeTableCell>
        <NeTableCell :data-label="t('common.actions')">
          <div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
            <NeButton kind="tertiary" @click="emit('details', user)">
              <template #prefix>
                <FontAwesomeIcon :icon="faEye" class="size-4" aria-hidden="true" />
              </template>
              {{ t('common.details') }}
              <span class="sr-only">{{ user.name }}</span>
            </NeButton>
          </div>
        </NeTableCell>
      </NeTableRow>
    </NeTableBody>
  </NeTable>
</template>
