<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPhone, faUsers } from '@fortawesome/free-solid-svg-icons'
import { NeBadgeV2, NeButton, NeSideDrawer, NeTabs, NeTooltip } from '@nethesis/vue-components'
import OverviewAvatar from '@/components/overview/OverviewAvatar.vue'
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import type { OverviewDevice, OverviewUser } from '@/lib/overview/overview'

const { isShown = false, user = undefined } = defineProps<{
  isShown: boolean
  user: OverviewUser | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const selectedExtension = ref('')

const devices = computed(() => user?.devices ?? [])

const selectedDevice = computed(
  () =>
    devices.value.find((device) => device.extension === selectedExtension.value) ??
    devices.value[0],
)

const tabs = computed(() =>
  devices.value.map((device) => ({ name: device.extension, label: getTabLabel(device) })),
)

watch(
  () => [isShown, user?.username],
  () => {
    if (isShown) {
      selectedExtension.value = devices.value[0]?.extension ?? ''
    }
  },
)

function getDeviceLabel(device: OverviewDevice) {
  return device.type === 'physical' && device.model
    ? device.model
    : t(`user_overview.devices.${device.type}`)
}

function getTabLabel(device: OverviewDevice) {
  const label = getDeviceLabel(device)
  return devices.value.filter((item) => getDeviceLabel(item) === label).length > 1
    ? `${label} (${device.extension})`
    : label
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('user_overview.operator_details')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <div v-if="user" class="space-y-8">
      <div class="flex items-start gap-4">
        <OverviewAvatar :name="user.name" :presence="user.presence" size="xl" />
        <div class="min-w-0 space-y-1">
          <p class="text-primary-neutral text-lg font-medium wrap-anywhere">{{ user.name }}</p>
          <p class="text-secondary-neutral">{{ user.mainExtension }}</p>
          <div v-if="user.groups.length" class="flex flex-wrap gap-1">
            <NeBadgeV2 v-for="group in user.groups" :key="group" kind="blue" size="xs">
              <FontAwesomeIcon :icon="faUsers" class="mr-1 size-3" aria-hidden="true" />
              {{ group }}
            </NeBadgeV2>
          </div>
        </div>
      </div>
      <div>
        <NeTooltip class="inline-block">
          <template #trigger>
            <NeButton kind="primary" disabled>
              <template #prefix>
                <FontAwesomeIcon :icon="faPhone" class="size-4" aria-hidden="true" />
              </template>
              {{ t('user_overview.call') }}
            </NeButton>
          </template>
          <template #content>{{ t('user_overview.call_not_available') }}</template>
        </NeTooltip>
      </div>
      <div>
        <h4 class="text-primary-neutral mb-2 font-medium">
          {{ t('user_overview.devices_title') }}
        </h4>
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="device in devices"
            :key="device.extension"
            class="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2"
          >
            <span class="text-secondary-neutral flex min-w-0 items-center gap-2">
              <FontAwesomeIcon
                :icon="DEVICE_ICONS[device.type]"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
              <span class="truncate">{{ getDeviceLabel(device) }}</span>
            </span>
            <span class="text-primary-700 dark:text-primary-500">{{ device.extension }}</span>
            <OverviewStatusLabel :status="device.status" class="justify-self-end" />
          </li>
        </ul>
        <p v-if="devices.length === 0" class="text-tertiary-neutral">
          {{ t('user_overview.no_devices') }}
        </p>
      </div>
      <div v-if="selectedDevice">
        <div class="overflow-x-auto">
          <NeTabs
            :tabs="tabs"
            :selected="selectedDevice.extension"
            :sr-tabs-label="t('ne_tabs.tabs')"
            :sr-select-tab-label="t('ne_tabs.select_a_tab')"
            class="mb-4"
            @select-tab="(name: string) => (selectedExtension = name)"
          />
        </div>
        <dl class="bg-elevation-0 divide-y divide-gray-200 rounded-lg px-4 dark:divide-gray-700">
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-secondary-neutral">{{ t('user_overview.codecs') }}</dt>
            <dd class="text-primary-neutral text-right">
              {{ selectedDevice.codecs.length ? selectedDevice.codecs.join(', ') : '-' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-secondary-neutral">{{ t('user_overview.do_not_disturb') }}</dt>
            <dd class="text-primary-neutral">
              {{ selectedDevice.doNotDisturb ? t('user_overview.on') : t('user_overview.off') }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-secondary-neutral">{{ t('user_overview.call_forward') }}</dt>
            <dd class="text-primary-neutral">
              {{ selectedDevice.callForward || t('user_overview.off') }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </NeSideDrawer>
</template>
