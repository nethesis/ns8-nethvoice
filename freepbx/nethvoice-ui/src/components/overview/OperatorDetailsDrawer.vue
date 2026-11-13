<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronDown, faPhone, faUsers } from '@fortawesome/free-solid-svg-icons'
import { NeBadgeV2, NeButton, NeSideDrawer, NeTooltip } from '@nethesis/vue-components'
import OverviewAvatar from '@/components/overview/OverviewAvatar.vue'
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import type { OverviewDevice, OverviewUser } from '@/lib/overview/overview'
import { useAdminPhoneStore } from '@/stores/adminPhone'

const { isShown = false, user = undefined } = defineProps<{
  isShown: boolean
  user: OverviewUser | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const idPrefix = useId()
const adminPhoneStore = useAdminPhoneStore()

const expandedExtensions = ref<string[]>([])

const devices = computed(() => user?.devices ?? [])

watch(
  () => [isShown, user?.username],
  () => {
    if (isShown) {
      expandedExtensions.value = devices.value[0] ? [devices.value[0].extension] : []
    }
  },
)

function isExpanded(device: OverviewDevice) {
  return expandedExtensions.value.includes(device.extension)
}

function toggleDevice(device: OverviewDevice) {
  expandedExtensions.value = isExpanded(device)
    ? expandedExtensions.value.filter((extension) => extension !== device.extension)
    : [...expandedExtensions.value, device.extension]
}

function getPanelId(device: OverviewDevice) {
  return `${idPrefix}-device-${device.extension}`
}

const mainExtension = computed(() => user?.mainExtension ?? '')

const isCallDisabled = computed(
  () =>
    !mainExtension.value ||
    adminPhoneStore.inCall ||
    (adminPhoneStore.state === 'error' && adminPhoneStore.isEnabled),
)

const callTooltip = computed(() => {
  const extension = mainExtension.value

  if (!extension) {
    return t('user_overview.call_no_extension')
  }
  if (adminPhoneStore.inCall) {
    return t('user_overview.call_in_progress')
  }
  switch (adminPhoneStore.state) {
    case 'ready':
      return t('user_overview.call_ready', { extension })
    case 'starting':
    case 'registering':
      return t('user_overview.call_connecting', { extension })
    case 'error':
      return adminPhoneStore.isEnabled
        ? t('admin_phone.status_connection_lost')
        : t('user_overview.call_enable_phone', { extension })
    default:
      return t('user_overview.call_enable_phone', { extension })
  }
})

function callOperator() {
  void adminPhoneStore.call(mainExtension.value)
}

function getDeviceLabel(device: OverviewDevice) {
  return device.type === 'physical' && device.model
    ? device.model
    : t(`user_overview.devices.${device.type}`)
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
        <OverviewAvatar :name="user.name" :presence="user.presence" size="xl" surface="drawer" />
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
        <NeTooltip trigger-event="mouseenter focus" class="inline-block">
          <template #trigger>
            <NeButton
              kind="primary"
              :disabled="isCallDisabled"
              :aria-describedby="isCallDisabled ? `${idPrefix}-call-reason` : undefined"
              :loading="adminPhoneStore.isConnecting"
              data-testid="call-operator"
              @click="callOperator"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faPhone" class="size-4" aria-hidden="true" />
              </template>
              {{ t('user_overview.call') }}
            </NeButton>
          </template>
          <template #content>{{ callTooltip }}</template>
        </NeTooltip>
        <p
          v-if="isCallDisabled"
          :id="`${idPrefix}-call-reason`"
          class="text-secondary-neutral mt-2 text-sm"
          data-testid="call-disabled-reason"
        >
          {{ callTooltip }}
        </p>
      </div>
      <div>
        <h4 class="text-primary-neutral mb-2 font-medium">
          {{ t('user_overview.devices_title') }}
        </h4>
        <ul class="divide-y divide-gray-200 dark:divide-gray-700" data-testid="device-list">
          <li v-for="device in devices" :key="device.extension">
            <h5 class="-mx-2">
              <button
                type="button"
                class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors duration-200 hover:bg-gray-200/70 focus:outline-hidden focus-visible:ring-2 dark:hover:bg-gray-600/30"
                :aria-expanded="isExpanded(device)"
                :aria-controls="getPanelId(device)"
                data-testid="device-toggle"
                @click="toggleDevice(device)"
              >
                <FontAwesomeIcon
                  :icon="DEVICE_ICONS[device.type]"
                  class="text-secondary-neutral size-4 shrink-0"
                  aria-hidden="true"
                />
                <span class="flex min-w-0 grow flex-col">
                  <span class="text-primary-neutral truncate">{{ getDeviceLabel(device) }}</span>
                  <span class="text-primary-700 dark:text-primary-500">
                    {{ device.extension }}
                  </span>
                </span>
                <OverviewStatusLabel :status="device.status" class="shrink-0" />
                <FontAwesomeIcon
                  :icon="faChevronDown"
                  :class="[
                    'text-tertiary-neutral size-3 shrink-0 transition-transform duration-200',
                    { 'rotate-180': isExpanded(device) },
                  ]"
                  aria-hidden="true"
                />
              </button>
            </h5>
            <dl
              v-show="isExpanded(device)"
              :id="getPanelId(device)"
              class="mb-3 ml-7 divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-700 dark:border-gray-700"
              data-testid="device-details"
            >
              <div class="flex justify-between gap-4 py-2">
                <dt class="text-secondary-neutral shrink-0">{{ t('user_overview.codecs') }}</dt>
                <dd class="text-primary-neutral text-right wrap-anywhere">
                  {{ device.codecs.length ? device.codecs.join(', ') : '-' }}
                </dd>
              </div>
              <div class="flex justify-between gap-4 py-2">
                <dt class="text-secondary-neutral shrink-0">
                  {{ t('user_overview.do_not_disturb') }}
                </dt>
                <dd class="text-primary-neutral text-right">
                  {{ device.doNotDisturb ? t('user_overview.on') : t('user_overview.off') }}
                </dd>
              </div>
              <div class="flex justify-between gap-4 py-2">
                <dt class="text-secondary-neutral shrink-0">
                  {{ t('user_overview.call_forward') }}
                </dt>
                <dd class="text-primary-neutral text-right wrap-anywhere">
                  {{ device.callForward || t('user_overview.off') }}
                </dd>
              </div>
            </dl>
          </li>
        </ul>
        <p v-if="devices.length === 0" class="text-tertiary-neutral">
          {{ t('user_overview.no_devices') }}
        </p>
      </div>
    </div>
  </NeSideDrawer>
</template>
