<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronDown, faStar, faUsers } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'
import { NeBadgeV2, NeButton, NeSideDrawer, NeTooltip } from '@nethesis/vue-components'
import CallSplitButton from '@/components/overview/CallSplitButton.vue'
import OverviewAvatar from '@/components/overview/OverviewAvatar.vue'
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import type { OverviewDevice, OverviewUser } from '@/lib/overview/overview'
import { useAdminPhoneStore } from '@/stores/adminPhone'
import { useFavoritesStore } from '@/stores/favorites'

const { isShown = false, user = undefined } = defineProps<{
  isShown: boolean
  user: OverviewUser | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const idPrefix = useId()
const adminPhoneStore = useAdminPhoneStore()
const favoritesStore = useFavoritesStore()

const isFavorite = computed(() => (user ? favoritesStore.isFavorite(user.username) : false))

const favoriteLabel = computed(() =>
  isFavorite.value ? t('user_overview.remove_favorite') : t('user_overview.add_favorite'),
)

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
    adminPhoneStore.state === 'elsewhere' ||
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
    case 'elsewhere':
      return t('admin_phone.status_elsewhere')
    case 'error':
      return adminPhoneStore.isEnabled
        ? t('admin_phone.status_connection_lost')
        : t('admin_phone.status_error', { error: adminPhoneStore.errorMessage })
    default:
      return t('user_overview.call_connecting', { extension })
  }
})

function callOperator(extension?: string) {
  void adminPhoneStore.call(extension ?? mainExtension.value)
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
    <div v-if="user" class="flex flex-col gap-8">
      <div class="flex items-start gap-6">
        <OverviewAvatar :name="user.name" :presence="user.presence" size="3xl" />
        <div class="flex min-w-0 flex-col gap-2">
          <div>
            <div class="flex items-center gap-2.5">
              <p class="text-primary-neutral text-lg font-medium wrap-anywhere">{{ user.name }}</p>
              <NeTooltip trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <button
                    type="button"
                    class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 -m-1 flex rounded-md p-1 focus:outline-hidden focus-visible:ring-2"
                    :aria-pressed="isFavorite"
                    data-testid="favorite-toggle"
                    @click="favoritesStore.toggleFavorite(user.username)"
                  >
                    <FontAwesomeIcon
                      :icon="isFavorite ? faStar : faStarRegular"
                      :class="[
                        'size-5',
                        isFavorite
                          ? 'text-indigo-500 dark:text-indigo-400'
                          : 'text-tertiary-neutral hover:text-indigo-500 dark:hover:text-indigo-400',
                      ]"
                      aria-hidden="true"
                    />
                    <span class="sr-only">{{ favoriteLabel }}</span>
                  </button>
                </template>
                <template #content>{{ favoriteLabel }}</template>
              </NeTooltip>
            </div>
            <p class="text-secondary-neutral text-base">{{ user.mainExtension }}</p>
          </div>
          <div v-if="user.groups.length" class="flex flex-wrap gap-1">
            <NeBadgeV2 v-for="group in user.groups" :key="group" kind="blue" size="xs">
              <FontAwesomeIcon :icon="faUsers" class="mr-1 size-4" aria-hidden="true" />
              {{ group }}
            </NeBadgeV2>
          </div>
        </div>
      </div>
      <div>
        <CallSplitButton
          :devices="devices"
          :disabled="isCallDisabled"
          :loading="adminPhoneStore.isConnecting"
          :tooltip="callTooltip"
          :described-by="isCallDisabled ? `${idPrefix}-call-reason` : undefined"
          @call="callOperator"
        />
        <p
          v-if="isCallDisabled"
          :id="`${idPrefix}-call-reason`"
          class="text-secondary-neutral mt-2 text-sm"
          data-testid="call-disabled-reason"
        >
          {{ callTooltip }}
        </p>
        <NeButton
          v-if="adminPhoneStore.state === 'elsewhere'"
          kind="tertiary"
          size="sm"
          class="mt-2"
          data-testid="use-phone-here"
          @click="adminPhoneStore.useHere()"
        >
          {{ t('admin_phone.use_here') }}
        </NeButton>
      </div>
      <div class="flex flex-col gap-2">
        <h4
          class="text-primary-neutral border-b border-gray-200 pb-2 text-base font-medium dark:border-gray-700"
        >
          {{ t('user_overview.devices_title') }}
        </h4>
        <ul class="flex flex-col gap-2" data-testid="device-list">
          <li
            v-for="device in devices"
            :key="device.extension"
            class="border-b border-gray-200 pb-2 last:border-b-0 dark:border-gray-700"
          >
            <h5 class="-mx-2">
              <button
                type="button"
                class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors duration-200 hover:bg-gray-200/70 focus:outline-hidden focus-visible:ring-2 dark:hover:bg-gray-600/30"
                :aria-expanded="isExpanded(device)"
                :aria-controls="getPanelId(device)"
                data-testid="device-toggle"
                @click="toggleDevice(device)"
              >
                <FontAwesomeIcon
                  :icon="DEVICE_ICONS[device.type]"
                  class="text-tertiary-neutral size-4 shrink-0"
                  aria-hidden="true"
                />
                <span class="text-tertiary-neutral w-28 shrink-0 truncate">
                  {{ getDeviceLabel(device) }}
                </span>
                <span class="text-primary-700 dark:text-primary-500 grow">
                  {{ device.extension }}
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
              class="bg-elevation-0 text-secondary-neutral mt-2 rounded-lg px-4 py-1"
              data-testid="device-details"
            >
              <div
                class="flex justify-between gap-4 border-b border-gray-200 py-3 dark:border-gray-700"
              >
                <dt class="shrink-0">{{ t('user_overview.codecs') }}</dt>
                <dd class="text-right wrap-anywhere">
                  {{ device.codecs.length ? device.codecs.join(', ') : '-' }}
                </dd>
              </div>
              <div
                class="flex justify-between gap-4 border-b border-gray-200 py-3 dark:border-gray-700"
              >
                <dt class="shrink-0">{{ t('user_overview.do_not_disturb') }}</dt>
                <dd class="text-right">
                  {{ device.doNotDisturb ? t('user_overview.on') : t('user_overview.off') }}
                </dd>
              </div>
              <div class="flex justify-between gap-4 py-3">
                <dt class="shrink-0">{{ t('user_overview.call_forward') }}</dt>
                <dd class="text-right wrap-anywhere">
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
