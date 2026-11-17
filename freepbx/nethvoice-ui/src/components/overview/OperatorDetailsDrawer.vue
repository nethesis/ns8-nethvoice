<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faChevronDown, faChevronUp, faStar, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'
import { NeBadgeV2, NeButton, NeSideDrawer, NeTooltip } from '@nethesis/vue-components'
import CallSplitButton from '@/components/overview/CallSplitButton.vue'
import OverviewAvatar from '@/components/overview/OverviewAvatar.vue'
import OverviewCallNumber from '@/components/overview/OverviewCallNumber.vue'
import OverviewStatusLabel from '@/components/overview/OverviewStatusLabel.vue'
import { DEVICE_ICONS } from '@/components/overview/deviceIcons'
import {
  getOverviewCallStatus,
  isOverviewCallBlocked,
  type OverviewDevice,
  type OverviewUser,
} from '@/lib/overview/overview'
import { useAdminPhoneStore } from '@/stores/adminPhone'
import { useFavoritesStore } from '@/stores/favorites'
import { useFocusReturn } from '@/composables/useFocusReturn'

const { isShown = false, user = undefined } = defineProps<{
  isShown: boolean
  user: OverviewUser | undefined
}>()

const emit = defineEmits<{ close: [] }>()

useFocusReturn(() => isShown)

const { t } = useI18n()
const idPrefix = useId()
const adminPhoneStore = useAdminPhoneStore()
const favoritesStore = useFavoritesStore()

const isFavorite = computed(() => (user ? favoritesStore.isFavorite(user.username) : false))

const favoriteLabel = computed(() =>
  isFavorite.value ? t('user_overview.remove_favorite') : t('user_overview.add_favorite'),
)

const devices = computed(() => user?.devices ?? [])

const expandedExtension = ref('')

watch([() => isShown, () => user?.username], () => {
  expandedExtension.value = ''
})

function toggleDevice(extension: string) {
  expandedExtension.value = expandedExtension.value === extension ? '' : extension
}

const mainExtension = computed(() => user?.mainExtension ?? '')

const callStatus = computed(() =>
  getOverviewCallStatus({
    mainExtension: mainExtension.value,
    devices: devices.value,
    phoneState: adminPhoneStore.state,
    phoneEnabled: adminPhoneStore.isEnabled,
    inCall: adminPhoneStore.inCall,
    otherTabInCall: adminPhoneStore.otherTabInCall,
  }),
)

const isCallDisabled = computed(() => isOverviewCallBlocked(callStatus.value))

const callTooltip = computed(() => {
  const extension = mainExtension.value

  switch (callStatus.value) {
    case 'no_extension':
      return t('user_overview.call_no_extension')
    case 'in_call':
      return t('user_overview.call_in_progress')
    case 'in_call_elsewhere':
      return t('admin_phone.status_elsewhere_in_call')
    case 'connection_lost':
      return t('admin_phone.status_connection_lost')
    case 'no_online_device':
      return t('user_overview.call_device_unavailable')
    case 'phone_error':
      return t('admin_phone.status_error', { error: adminPhoneStore.errorMessage })
    case 'elsewhere':
      return t('admin_phone.status_elsewhere')
    case 'ready':
      return t('user_overview.call_ready', { extension })
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
      <div class="flex flex-col gap-6">
        <div class="flex items-start gap-6">
          <OverviewAvatar :name="user.name" :presence="user.presence" size="3xl" />
          <div class="flex min-w-0 flex-col gap-2">
            <div>
              <div class="flex items-center gap-2.5">
                <p class="text-primary-neutral text-lg font-medium wrap-anywhere">
                  {{ user.name }}
                </p>
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
                          'size-4',
                          isFavorite
                            ? 'text-indigo-700 dark:text-indigo-500'
                            : 'text-tertiary-neutral hover:text-indigo-700 dark:hover:text-indigo-500',
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
                <FontAwesomeIcon :icon="faUserGroup" class="size-4" aria-hidden="true" />
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
            v-if="adminPhoneStore.state === 'elsewhere' && !adminPhoneStore.otherTabInCall"
            kind="tertiary"
            size="sm"
            class="mt-2"
            data-testid="use-phone-here"
            @click="adminPhoneStore.useHere()"
          >
            {{ t('admin_phone.use_here') }}
          </NeButton>
        </div>
      </div>
      <section>
        <h4 class="text-primary-neutral mb-1 text-base font-medium">
          {{ t('user_overview.devices_title') }}
        </h4>
        <p v-if="devices.length === 0" class="text-tertiary-neutral text-sm">
          {{ t('user_overview.no_devices') }}
        </p>
        <template v-else>
          <p class="text-tertiary-neutral mb-3 text-sm">
            {{ t('user_overview.devices_description') }}
          </p>
          <ul class="flex flex-col gap-4" data-testid="device-list">
            <li
              v-for="device in devices"
              :key="device.extension"
              class="bg-elevation-2 rounded-lg border-b border-gray-200 shadow-md dark:border-gray-700"
              data-testid="device-row"
            >
              <div class="group relative flex items-center gap-3 px-4 py-2 text-sm">
                <button
                  type="button"
                  :aria-expanded="expandedExtension === device.extension"
                  :aria-controls="`${idPrefix}-device-${device.extension}`"
                  :aria-label="
                    t('user_overview.device_settings', {
                      device: getDeviceLabel(device),
                      extension: device.extension,
                    })
                  "
                  :class="[
                    expandedExtension === device.extension
                      ? ''
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700',
                    'focus-visible:ring-primary-500 dark:focus-visible:ring-primary-200 absolute inset-0 cursor-pointer rounded-lg focus:outline-hidden focus-visible:ring-2',
                  ]"
                  data-testid="device-toggle"
                  @click="toggleDevice(device.extension)"
                ></button>
                <FontAwesomeIcon
                  :icon="DEVICE_ICONS[device.type]"
                  class="text-tertiary-neutral pointer-events-none relative size-4 shrink-0"
                  aria-hidden="true"
                />
                <span
                  class="text-secondary-neutral pointer-events-none relative w-32 truncate"
                  :title="getDeviceLabel(device)"
                >
                  {{ getDeviceLabel(device) }}
                </span>
                <span class="relative -ml-2" @click.stop>
                  <OverviewCallNumber :device="device" />
                </span>
                <OverviewStatusLabel
                  :status="device.status"
                  class="pointer-events-none relative ml-auto w-20 shrink-0"
                />
                <span
                  :class="[
                    expandedExtension === device.extension
                      ? 'group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
                      : '',
                    'text-secondary-neutral pointer-events-none relative -mr-1.5 rounded-md p-1.5',
                  ]"
                >
                  <FontAwesomeIcon
                    :icon="expandedExtension === device.extension ? faChevronUp : faChevronDown"
                    class="size-3"
                    aria-hidden="true"
                  />
                </span>
              </div>
              <dl
                v-show="expandedExtension === device.extension"
                :id="`${idPrefix}-device-${device.extension}`"
                class="mx-4 divide-y divide-gray-200 border-t border-gray-200 text-sm dark:divide-gray-700 dark:border-gray-700"
                data-testid="device-details"
              >
                <div class="flex justify-between gap-4 py-3">
                  <dt class="text-primary-neutral shrink-0">{{ t('user_overview.codecs') }}</dt>
                  <dd class="text-secondary-neutral text-right wrap-anywhere">
                    {{ device.codecs.length ? device.codecs.join(', ') : '-' }}
                  </dd>
                </div>
                <div class="flex justify-between gap-4 py-3">
                  <dt class="text-primary-neutral shrink-0">
                    {{ t('user_overview.do_not_disturb') }}
                  </dt>
                  <dd class="text-secondary-neutral text-right">
                    {{ device.doNotDisturb ? t('user_overview.on') : t('user_overview.off') }}
                  </dd>
                </div>
                <div class="flex justify-between gap-4 py-3">
                  <dt class="text-primary-neutral shrink-0">
                    {{ t('user_overview.call_forward') }}
                  </dt>
                  <dd class="text-secondary-neutral text-right wrap-anywhere">
                    {{ device.callForward || t('user_overview.off') }}
                  </dd>
                </div>
              </dl>
            </li>
          </ul>
        </template>
      </section>
    </div>
  </NeSideDrawer>
</template>
