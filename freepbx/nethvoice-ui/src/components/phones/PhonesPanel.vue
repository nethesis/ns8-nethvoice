<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeDropdownFilterV2,
  NeEmptyState,
  NeInlineNotification,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  type NeDropdownFilterV2Option,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faChevronDown,
  faCircleCheck,
  faCircleMinus,
  faCirclePlus,
  faClone,
  faKey,
  faLock,
  faMagnifyingGlass,
  faPenToSquare,
  faRotate,
  faTrash,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import ClickToCopy from '@/components/common/ClickToCopy.vue'
import LoadError from '@/components/common/LoadError.vue'
import TablePaginator from '@/components/common/TablePaginator.vue'
import AddPhonesModal from './AddPhonesModal.vue'
import EditPhoneDrawer from './EditPhoneDrawer.vue'
import DeletePhoneModal from './DeletePhoneModal.vue'
import PhonePasswordDrawer from './PhonePasswordDrawer.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { usePolling } from '@/composables/usePolling'
import { PAGE_SIZES } from '@/lib/common'
import { formatMac } from '@/lib/phones/mac'
import { getPhoneWebPassword, isDefaultAdminPassword } from '@/lib/phones/defaults'
import {
  filterPhones,
  getPhoneStatus,
  getProvisioningUrl,
  PHONE_STATUSES,
  runProvisioning,
  UNASSIGNED_FILTER_ID,
  type Phone,
} from '@/lib/phones/phones'
import { PHONE_REGISTRATIONS_REFRESH_INTERVAL } from '@/lib/phones/registration'
import { useMacVendors, usePhones } from '@/queries/phones/phones'
import { usePhoneDefaults } from '@/queries/phones/defaults'
import { usePhoneRegistrations } from '@/queries/phones/registration'
import { useNotificationsStore } from '@/stores/notifications'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const { phones, models, users, loading, updating, error, refetch } = usePhones()
const { state: defaultsState, refetch: refetchDefaults } = usePhoneDefaults()
const { state: macVendorsState } = useMacVendors()
const { state: registrationsState, refetch: refetchRegistrations } = usePhoneRegistrations()

usePolling(() => refetchRegistrations(), PHONE_REGISTRATIONS_REFRESH_INTERVAL)

const textFilter = ref('')
const modelFilter = ref<NeDropdownFilterV2Option[]>([])
const userFilter = ref<NeDropdownFilterV2Option[]>([])
const statusFilter = ref<NeDropdownFilterV2Option[]>([])
const currentPhone = ref<Phone | undefined>()
const isShownAddPhonesModal = ref(false)
const isShownEditPhoneDrawer = ref(false)
const isShownDeletePhoneModal = ref(false)
const isShownAdminPasswordDrawer = ref(false)

const registrations = computed(() => registrationsState.value.data)

const filteredPhones = computed(() =>
  filterPhones(
    phones.value,
    {
      text: textFilter.value,
      models: modelFilter.value.map((option) => option.id),
      users: userFilter.value.map((option) => option.id),
      statuses: statusFilter.value.flatMap((option) =>
        PHONE_STATUSES.filter((status) => status === option.id),
      ),
    },
    registrations.value,
  ),
)

const { pageNum, pageSize, page } = useClientPagination(filteredPhones)

watch([textFilter, modelFilter, userFilter, statusFilter], () => {
  pageNum.value = 1
})

const modelFilterOptions = computed<NeDropdownFilterV2Option[]>(() => {
  const options = new Map<string, string>()

  for (const phone of phones.value) {
    options.set(phone.model, phone.modelLabel)
  }
  return [...options]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const userFilterOptions = computed<NeDropdownFilterV2Option[]>(() => {
  const options = new Map<string, NeDropdownFilterV2Option>()

  for (const phone of phones.value) {
    if (phone.user) {
      options.set(phone.user.username, {
        id: phone.user.username,
        label: phone.user.displayName,
        description: phone.user.username,
      })
    }
  }
  return [
    { id: UNASSIGNED_FILTER_ID, label: t('phones.inventory.unassigned') },
    ...[...options.values()].sort((a, b) => a.label.localeCompare(b.label)),
  ]
})

const statusFilterOptions = computed<NeDropdownFilterV2Option[]>(() => [
  { id: 'registered', label: t('phones.inventory.registered') },
  { id: 'unregistered', label: t('phones.inventory.not_registered') },
])

const assignedPhones = computed(() => phones.value.filter((phone) => phone.extension !== ''))

const webPassword = computed(() => getPhoneWebPassword(defaultsState.value.data))
const defaultEncrypted = computed(() => defaultsState.value.data?.encryptionByDefault ?? true)
const defaultsReady = computed(() => webPassword.value !== '')

const isAdminPasswordMissing = computed(
  () => defaultsState.value.status === 'success' && webPassword.value === '',
)

const isDefaultAdminPasswordInUse = computed(
  () => defaultsState.value.status === 'success' && isDefaultAdminPassword(webPassword.value),
)

const areFiltersApplied = computed(
  () =>
    textFilter.value.trim() !== '' ||
    modelFilter.value.length > 0 ||
    userFilter.value.length > 0 ||
    statusFilter.value.length > 0,
)

const isEmptyStateShown = computed(
  () => !loading.value && !error.value && phones.value.length === 0,
)

const isNoMatchShown = computed(
  () => !loading.value && phones.value.length > 0 && filteredPhones.value.length === 0,
)

const filterLabels = computed(() => ({
  clearFilterLabel: t('ne_dropdown_filter.clear_selection'),
  openMenuAriaLabel: t('ne_dropdown_filter.open_filter'),
  noOptionsLabel: t('ne_dropdown_filter.no_options'),
  moreOptionsHiddenLabel: t('ne_dropdown_filter.more_options_hidden'),
  clearSearchLabel: t('ne_dropdown_filter.clear_search'),
  optionsFilterPlaceholder: t('ne_dropdown_filter.options_filter_placeholder'),
}))

const { mutate: provisioningMutate, isLoading: provisioning } = useMutation({
  mutation: (targets: Phone[]) => runProvisioning(targets),
  onSuccess(result) {
    if (result.started > 0) {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('phones.inventory.provisioning_started'),
        description: t('phones.inventory.provisioning_started_description', result.started),
      })
    }

    if (result.failed > 0) {
      notificationsStore.createNotification({
        kind: 'error',
        title: t('phones.inventory.provisioning_failed'),
        description: t('phones.inventory.provisioning_failed_description', result.failed),
      })
    }
  },
  onError(mutationError) {
    notificationsStore.createNotificationFromError(
      mutationError,
      t('phones.inventory.provisioning_failed'),
    )
  },
})

const actionsItems = computed<NeDropdownItem[]>(() => [
  {
    id: 'runProvisioning',
    label: t('phones.inventory.run_provisioning'),
    icon: faRotate,
    disabled: provisioning.value || assignedPhones.value.length === 0,
    action: () => provisioningMutate(assignedPhones.value),
  },
])

function getRowMenuItems(phone: Phone): NeDropdownItem[] {
  return [
    {
      id: 'runProvisioning',
      label: phone.extension
        ? t('phones.inventory.run_provisioning')
        : t('phones.inventory.run_provisioning_unassigned'),
      icon: faRotate,
      disabled: provisioning.value || !phone.extension,
      action: () => provisioningMutate([phone]),
    },
    {
      id: 'copyProvisioningUrl',
      label: t('phones.inventory.copy_provisioning_url'),
      icon: faClone,
      action: () => copyProvisioningUrl(phone),
    },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => showDeletePhoneModal(phone),
    },
  ]
}

async function writeClipboard(text: string) {
  if (!navigator.clipboard) {
    throw new Error(t('phones.inventory.clipboard_unavailable'))
  }
  await navigator.clipboard.writeText(text)
}

async function copyProvisioningUrl(phone: Phone) {
  try {
    const url = await getProvisioningUrl(phone.mac)

    if (!url) {
      throw new Error(t('phones.inventory.provisioning_url_missing'))
    }
    await writeClipboard(url)
    notificationsStore.createNotification({
      kind: 'success',
      title: t('phones.inventory.provisioning_url_copied'),
      description: t('phones.inventory.provisioning_url_copied_description', {
        mac: formatMac(phone.mac),
      }),
    })
  } catch (copyError) {
    notificationsStore.createNotificationFromError(
      copyError,
      t('phones.inventory.cannot_copy_provisioning_url'),
    )
  }
}

function resetFilters() {
  textFilter.value = ''
  modelFilter.value = []
  userFilter.value = []
  statusFilter.value = []
}

const phoneStatus = (phone: Phone) => getPhoneStatus(phone, registrations.value)

const registrationDetails = (phone: Phone) => {
  const registration = registrations.value?.[phone.extension]

  if (!registration) {
    return ''
  }
  return [registration.ip, registration.userAgent].filter((value) => value !== '').join(' · ')
}

function showEditPhoneDrawer(phone: Phone) {
  currentPhone.value = phone
  isShownEditPhoneDrawer.value = true
}

function showDeletePhoneModal(phone: Phone) {
  currentPhone.value = phone
  isShownDeletePhoneModal.value = true
}
</script>

<template>
  <div>
    <LoadError
      v-if="error"
      :error="error"
      :title="$t('phones.inventory.cannot_load_phones')"
      class="mb-6"
      @retry="refetch"
    />
    <LoadError
      v-if="defaultsState.status === 'error'"
      :error="defaultsState.error"
      :title="$t('phones.inventory.cannot_load_defaults')"
      class="mb-6"
      @retry="refetchDefaults"
    />
    <NeInlineNotification
      v-else-if="isAdminPasswordMissing"
      kind="warning"
      :title="$t('phones.inventory.admin_password_missing')"
      :description="$t('phones.inventory.admin_password_missing_description')"
      class="mb-6"
    />
    <NeEmptyState
      v-if="isEmptyStateShown"
      :title="$t('phones.inventory.no_phones')"
      :description="
        isDefaultAdminPasswordInUse
          ? `${$t('phones.inventory.no_phones_description')} ${$t('phones.inventory.default_admin_password_in_use')}`
          : $t('phones.inventory.no_phones_description')
      "
      :icon="faOfficePhone"
    >
      <div class="flex flex-col items-center gap-4">
        <NeButton kind="primary" :disabled="!defaultsReady" @click="isShownAddPhonesModal = true">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ $t('phones.inventory.add_phones') }}
        </NeButton>
        <NeButton
          v-if="isDefaultAdminPasswordInUse"
          kind="secondary"
          @click="isShownAdminPasswordDrawer = true"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faKey" class="size-4" aria-hidden="true" />
          </template>
          {{ $t('phones.settings.change_admin_password') }}
        </NeButton>
      </div>
    </NeEmptyState>
    <template v-else-if="!error">
      <div class="mb-6 flex flex-col gap-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <p class="text-secondary-neutral max-w-2xl">
            {{ $t('phones.inventory.description') }}
          </p>
          <div class="flex items-center gap-4">
            <NeDropdown
              :items="actionsItems"
              align-to-right
              :open-menu-aria-label="$t('common.actions')"
              menu-classes="min-w-56"
            >
              <template #button>
                <NeButton kind="secondary" tabindex="-1" aria-hidden="true">
                  <template #suffix>
                    <FontAwesomeIcon :icon="faChevronDown" class="size-4" aria-hidden="true" />
                  </template>
                  {{ $t('common.actions') }}
                </NeButton>
              </template>
            </NeDropdown>
            <NeButton
              kind="primary"
              :disabled="loading || !defaultsReady"
              @click="isShownAddPhonesModal = true"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
              </template>
              {{ $t('phones.inventory.add_phones') }}
            </NeButton>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <NeTextInput
            v-model="textFilter"
            is-search
            :placeholder="$t('phones.inventory.filter_phones')"
            :aria-label="$t('phones.inventory.filter_phones')"
            :clear-search-label="$t('ne_text_input.clear_search')"
            class="w-full max-w-xs"
          />
          <NeDropdownFilterV2
            v-model="modelFilter"
            kind="checkbox"
            :label="$t('phones.model')"
            :options="modelFilterOptions"
            v-bind="filterLabels"
          />
          <NeDropdownFilterV2
            v-model="userFilter"
            kind="checkbox"
            :label="$t('phones.user')"
            :options="userFilterOptions"
            show-options-filter
            v-bind="filterLabels"
          />
          <NeDropdownFilterV2
            v-model="statusFilter"
            kind="checkbox"
            :label="$t('phones.inventory.status')"
            :options="statusFilterOptions"
            v-bind="filterLabels"
          />
          <NeButton kind="tertiary" :disabled="!areFiltersApplied" @click="resetFilters">
            {{ $t('common.reset_filters') }}
          </NeButton>
          <span v-if="updating" class="text-tertiary-neutral text-sm">
            {{ $t('phones.updating') }}
          </span>
        </div>
      </div>
      <NeEmptyState
        v-if="isNoMatchShown"
        :title="$t('phones.inventory.no_phones_found')"
        :description="$t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
      >
        <NeButton kind="tertiary" @click="resetFilters">
          {{ $t('common.reset_filters') }}
        </NeButton>
      </NeEmptyState>
      <NeTable
        v-else
        :aria-label="$t('phones.inventory.phones_table')"
        card-breakpoint="xl"
        :loading="loading"
        :skeleton-columns="6"
        :skeleton-rows="6"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ $t('phones.mac_address') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.model') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.user') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.inventory.status') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.inventory.encryption') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ $t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="phone in page" :key="phone.mac">
            <NeTableCell :data-label="$t('phones.mac_address')">
              <ClickToCopy :text="formatMac(phone.mac)" />
            </NeTableCell>
            <NeTableCell :data-label="$t('phones.model')">
              {{ phone.modelLabel || '-' }}
            </NeTableCell>
            <NeTableCell :data-label="$t('phones.user')">
              <div v-if="phone.user" class="flex items-center gap-2">
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-gray-50 dark:bg-gray-200 dark:text-gray-900"
                  aria-hidden="true"
                >
                  <FontAwesomeIcon :icon="faUser" class="size-4" />
                </span>
                <div class="flex flex-col">
                  <span>{{ phone.user.displayName }}</span>
                  <span class="text-tertiary-neutral">
                    {{ phone.user.username }} · {{ phone.extension }}
                  </span>
                </div>
              </div>
              <NeBadgeV2 v-else kind="amber" size="xs">
                {{ $t('phones.inventory.unassigned') }}
              </NeBadgeV2>
            </NeTableCell>
            <NeTableCell :data-label="$t('phones.inventory.status')">
              <span
                v-if="!phone.extension || phoneStatus(phone) === 'unknown'"
                class="text-tertiary-neutral"
                >-</span
              >
              <div v-else-if="phoneStatus(phone) === 'registered'" class="flex flex-col">
                <span class="flex items-center gap-2">
                  <FontAwesomeIcon
                    :icon="faCircleCheck"
                    class="size-4 text-green-700 dark:text-green-500"
                    aria-hidden="true"
                  />
                  {{ $t('phones.inventory.registered') }}
                </span>
                <span v-if="registrationDetails(phone)" class="text-tertiary-neutral break-all">
                  {{ registrationDetails(phone) }}
                </span>
              </div>
              <span v-else class="flex items-center gap-2">
                <FontAwesomeIcon
                  :icon="faCircleMinus"
                  class="text-tertiary-neutral size-4"
                  aria-hidden="true"
                />
                {{ $t('phones.inventory.not_registered') }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="$t('phones.inventory.encryption')">
              <span v-if="!phone.user" class="text-tertiary-neutral">-</span>
              <div v-else-if="phone.encrypted" class="flex items-center gap-2">
                <FontAwesomeIcon
                  :icon="faCircleCheck"
                  class="size-4 text-green-700 dark:text-green-500"
                  aria-hidden="true"
                />
                {{ $t('phones.inventory.encrypted') }}
              </div>
              <NeBadgeV2 v-else kind="amber" size="xs">
                <FontAwesomeIcon :icon="faLock" class="size-3" aria-hidden="true" />
                {{ $t('phones.inventory.not_encrypted') }}
              </NeBadgeV2>
            </NeTableCell>
            <NeTableCell :data-label="$t('common.actions')">
              <div class="-ml-2.5 flex items-center gap-2 xl:ml-0 xl:justify-end">
                <NeButton
                  kind="tertiary"
                  :disabled="!defaultsReady"
                  @click="showEditPhoneDrawer(phone)"
                >
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ $t('common.edit') }}
                  <span class="sr-only">{{ formatMac(phone.mac) }}</span>
                </NeButton>
                <NeDropdown
                  :items="getRowMenuItems(phone)"
                  align-to-right
                  :open-menu-aria-label="
                    $t('phones.inventory.open_phone_menu', { mac: formatMac(phone.mac) })
                  "
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="filteredPhones.length > PAGE_SIZES[0]" #paginator>
          <TablePaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="filteredPhones.length"
          />
        </template>
      </NeTable>
    </template>
    <AddPhonesModal
      :is-shown="isShownAddPhonesModal"
      :existing-macs="phones.map((phone) => phone.mac)"
      :models="models"
      :users="users"
      :mac-vendors="macVendorsState.data ?? {}"
      :web-password="webPassword"
      :encrypted="defaultEncrypted"
      @close="isShownAddPhonesModal = false"
    />
    <EditPhoneDrawer
      :is-shown="isShownEditPhoneDrawer"
      :phone="currentPhone"
      :models="models"
      :users="users"
      :web-password="webPassword"
      :default-encrypted="defaultEncrypted"
      @close="isShownEditPhoneDrawer = false"
    />
    <DeletePhoneModal
      :visible="isShownDeletePhoneModal"
      :phone="currentPhone"
      @close="isShownDeletePhoneModal = false"
    />
    <PhonePasswordDrawer
      :is-shown="isShownAdminPasswordDrawer"
      kind="admin"
      @close="isShownAdminPasswordDrawer = false"
    />
  </div>
</template>
