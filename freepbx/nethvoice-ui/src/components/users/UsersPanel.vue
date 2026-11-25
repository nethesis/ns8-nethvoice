<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeDropdownFilterV2,
  NeEmptyState,
  NeInlineNotification,
  NeLink,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  NeTooltip,
  type NeDropdownFilterV2Option,
  type NeDropdownItem,
  type SortEvent,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleArrowUp,
  faArrowsRotate,
  faCircleMinus,
  faCirclePlus,
  faFileCsv,
  faGears,
  faHeadset,
  faKey,
  faMagnifyingGlass,
  faPenToSquare,
  faRightLeft,
  faTrash,
  faUserGroup,
  faUserGear,
  faVoicemail,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import TablePaginator from '@/components/common/TablePaginator.vue'
import AdvancedBulkUsersDrawer from '@/components/users/AdvancedBulkUsersDrawer.vue'
import BulkUsersDrawer, { type BulkUsersAction } from '@/components/users/BulkUsersDrawer.vue'
import ChangePasswordDrawer from '@/components/users/ChangePasswordDrawer.vue'
import CreateOrEditUserDrawer from '@/components/users/CreateOrEditUserDrawer.vue'
import DeleteUserModal from '@/components/users/DeleteUserModal.vue'
import ImportUsersFlow from '@/components/users/ImportUsersFlow.vue'
import OrphanExtensionsDrawer from '@/components/users/OrphanExtensionsDrawer.vue'
import ReassignExtensionModal from '@/components/users/ReassignExtensionModal.vue'
import RemoveExtensionModal from '@/components/users/RemoveExtensionModal.vue'
import UserDeviceIcons from '@/components/users/UserDeviceIcons.vue'
import UsersActionsDropdown from '@/components/users/UsersActionsDropdown.vue'
import { DEFAULT_PAGE_SIZE, paginate } from '@/lib/common'
import { buildModelLabels, getPhoneModelLabel } from '@/lib/overview/overview'
import { formatMac } from '@/lib/phones/mac'
import { findAccount, getAccountRestriction } from '@/lib/users/accounts'
import { buildExportFileName, downloadTextFile, getCsvExport } from '@/lib/users/csv'
import {
  buildUserRows,
  DIRECTORY_PART_LABELS,
  EMPTY_USERS_DIRECTORY,
  type UserRow,
} from '@/lib/users/directory'
import {
  areDefaultUserFilters,
  filterUserRows,
  sortUsers,
  type PhysicalPhonesFilter,
  type StatusFilter,
  type UserFilters,
  type UserSortKey,
  type VoicemailFilter,
} from '@/lib/users/userFilters'
import {
  countConfiguredUsers,
  SOFTWARE_DEVICE_TYPES,
  type SoftwareDeviceType,
  type UserDevice,
} from '@/lib/users/users'
import { usePermissions } from '@/queries/permissions/me'
import { usePhoneModels } from '@/queries/phones/models'
import { useUserAccounts, useUsersDomain } from '@/queries/users/accounts'
import { useOrphanExtensions } from '@/queries/users/orphanExtensions'
import { useUsers } from '@/queries/users/users'
import { useUsersDirectory } from '@/queries/users/usersDirectory'
import { useUsersProviderSync } from '@/queries/users/usersSync'
import { useLoginStore } from '@/stores/login'
import { useNotificationsStore } from '@/stores/notifications'

const MAX_GROUPS_SHOWN = 2

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const usersQuery = useUsers()
const { state: phoneModelsState } = usePhoneModels()
const modelLabels = computed(() => buildModelLabels(phoneModelsState.value.data ?? []))
const directoryQuery = useUsersDirectory()

const loading = computed(
  () =>
    usersQuery.state.value.status === 'pending' || directoryQuery.state.value.status === 'pending',
)
const loadError = computed(
  () => usersQuery.state.value.error ?? directoryQuery.state.value.error ?? null,
)
const hasData = computed(
  () => usersQuery.state.value.data !== undefined && directoryQuery.state.value.data !== undefined,
)
const users = computed(() => usersQuery.state.value.data ?? [])
const directory = computed(() => directoryQuery.state.value.data ?? EMPTY_USERS_DIRECTORY)
const loginStore = useLoginStore()
const { isSuperadmin } = usePermissions()
const domainQuery = useUsersDomain()
const accountsQuery = useUserAccounts()
const domain = computed(() => domainQuery.state.value.data)
const accountsManageable = computed(() => domain.value?.manageable === true)
const accounts = computed(() =>
  accountsManageable.value ? (accountsQuery.state.value.data ?? []) : [],
)
const accountsLoaded = computed(() => accountsQuery.state.value.status === 'success')
const accountsLoading = computed(
  () =>
    domainQuery.state.value.status === 'pending' ||
    (accountsManageable.value && accountsQuery.state.value.status === 'pending'),
)
const accountsLoadFailed = computed(
  () => accountsManageable.value && accountsQuery.state.value.status === 'error',
)
const rows = computed(() =>
  buildUserRows(users.value, directory.value).map((row) => {
    const account = findAccount(accounts.value, row.username)
    return { ...row, account, locked: account?.locked ?? null }
  }),
)
type AccountUserRow = (typeof rows.value)[number]

const restrictionOf = (row: UserRow) =>
  getAccountRestriction({
    username: row.username,
    signedInUsername: loginStore.username,
    isSuperadmin: isSuperadmin.value,
    account: findAccount(accounts.value, row.username),
    accountsLoaded: accountsLoaded.value,
  })

const creationBlocked = computed(() => {
  if (domain.value?.manageable !== false) {
    return ''
  }
  return domain.value.reason === 'unavailable'
    ? t('users.account_provider_unavailable')
    : t('users.users_managed_externally')
})
const configuredCount = computed(() => countConfiguredUsers(users.value))
const orphansQuery = useOrphanExtensions()
const orphans = computed(() => orphansQuery.state.value.data ?? [])
const isShownOrphans = ref(false)

const unavailableParts = computed(() =>
  (directory.value.unavailable ?? []).map((part) => t(DIRECTORY_PART_LABELS[part])).join(', '),
)

const anyOption = (): NeDropdownFilterV2Option => ({ id: 'any', label: t('users.filter_any') })

const textFilter = ref('')
const statusFilter = ref<NeDropdownFilterV2Option[]>([anyOption()])
const voicemailFilter = ref<NeDropdownFilterV2Option[]>([anyOption()])
const groupsFilter = ref<NeDropdownFilterV2Option[]>([])
const profilesFilter = ref<NeDropdownFilterV2Option[]>([])
const devicesFilter = ref<NeDropdownFilterV2Option[]>([])
const phonesFilter = ref<NeDropdownFilterV2Option[]>([anyOption()])
const sortKey = ref<UserSortKey>('displayName')
const sortDescending = ref(false)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

const statusOptions = computed<NeDropdownFilterV2Option[]>(() => [
  anyOption(),
  { id: 'enabled', label: t('common.enabled') },
  { id: 'disabled', label: t('common.disabled') },
])

const voicemailOptions = computed<NeDropdownFilterV2Option[]>(() => [
  anyOption(),
  { id: 'enabled', label: t('users.voicemail_enabled') },
  { id: 'disabled', label: t('users.voicemail_disabled') },
])

const phonesOptions = computed<NeDropdownFilterV2Option[]>(() => [
  anyOption(),
  { id: 'with', label: t('users.has_physical_phone') },
  { id: 'without', label: t('users.no_physical_phone') },
])

const groupOptions = computed<NeDropdownFilterV2Option[]>(() =>
  directory.value.groups.map((group) => ({ id: String(group.id), label: group.name })),
)

const profileOptions = computed<NeDropdownFilterV2Option[]>(() =>
  directory.value.profiles.map((profile) => ({ id: String(profile.id), label: profile.name })),
)

const deviceOptions = computed<NeDropdownFilterV2Option[]>(() =>
  SOFTWARE_DEVICE_TYPES.map((device) => ({ id: device, label: t(`users.device_${device}`) })),
)

function describePhone(phone: UserDevice) {
  const model = getPhoneModelLabel(phone.vendor, phone.model, modelLabels.value)
  const mac = phone.mac ? formatMac(phone.mac) : ''

  if (model && mac) {
    return `${model} (${mac})`
  }
  return model || mac || phone.extension
}

const firstId = (options: NeDropdownFilterV2Option[]) => options[0]?.id ?? 'any'

const filters = computed<UserFilters>(() => ({
  text: textFilter.value,
  status: firstId(statusFilter.value) as StatusFilter,
  voicemail: firstId(voicemailFilter.value) as VoicemailFilter,
  groupIds: groupsFilter.value.map((option) => Number(option.id)),
  profileIds: profilesFilter.value.map((option) => Number(option.id)),
  devices: SOFTWARE_DEVICE_TYPES.filter((device) =>
    devicesFilter.value.some((option) => option.id === device),
  ) as SoftwareDeviceType[],
  physicalPhones: firstId(phonesFilter.value) as PhysicalPhonesFilter,
}))

const filteredRows = computed(() =>
  sortUsers(filterUserRows(rows.value, filters.value), sortKey.value, sortDescending.value),
)
const pagedRows = computed(() => paginate(filteredRows.value, pageNum.value, pageSize.value))
const defaultFilters = computed(() => areDefaultUserFilters(filters.value))

watch([filters, pageSize], () => {
  pageNum.value = 1
})

watch(
  () => filteredRows.value.length,
  (count) => {
    const lastPage = Math.max(1, Math.ceil(count / pageSize.value))

    if (pageNum.value > lastPage) {
      pageNum.value = lastPage
    }
  },
)

function resetFilters() {
  textFilter.value = ''
  statusFilter.value = [anyOption()]
  voicemailFilter.value = [anyOption()]
  groupsFilter.value = []
  profilesFilter.value = []
  devicesFilter.value = []
  phonesFilter.value = [anyOption()]
}

function onSort(event: SortEvent) {
  sortKey.value = event.key === 'mainExtension' ? 'mainExtension' : 'displayName'
  sortDescending.value = event.descending
}

function reload() {
  usersQuery.refetch()
  directoryQuery.refetch()
}

const currentUsername = ref('')
const currentUser = computed<AccountUserRow | undefined>(() =>
  currentUsername.value === ''
    ? undefined
    : rows.value.find((row) => row.username === currentUsername.value),
)
const isShownUserDrawer = ref(false)
const isShownImport = ref(false)
const isShownRemoveExtension = ref(false)
const isShownReassignExtension = ref(false)
const isShownChangePassword = ref(false)
const isShownDeleteUser = ref(false)
const bulkAction = ref<BulkUsersAction>('profile')
const isShownBulkDrawer = ref(false)
const isShownAdvancedBulk = ref(false)
const exporting = ref(false)

const isEmptyStateShown = computed(
  () => !loading.value && !loadError.value && users.value.length === 0,
)

function showCreateUser() {
  currentUsername.value = ''
  isShownUserDrawer.value = true
}

function showEditUser(row: UserRow) {
  currentUsername.value = row.username
  isShownUserDrawer.value = true
}

function showBulk(action: BulkUsersAction) {
  bulkAction.value = action
  isShownBulkDrawer.value = true
}

const { syncing, syncError, sync } = useUsersProviderSync()

async function syncUsers() {
  const completed = await sync()

  if (syncError.value) {
    notificationsStore.createNotificationFromError(syncError.value, t('users.cannot_sync_users'))
    return
  }
  directoryQuery.refetch()

  if (!completed) {
    notificationsStore.createNotification({
      kind: 'warning',
      title: t('users.sync_not_completed'),
      description: t('users.sync_not_completed_description'),
    })
    return
  }
  notificationsStore.createNotification({
    kind: 'success',
    title: t('users.users_synchronized'),
    description: t('users.users_synchronized_description'),
  })
}

async function exportUsers() {
  exporting.value = true

  try {
    downloadTextFile(buildExportFileName(), await getCsvExport())
  } catch (error) {
    notificationsStore.createNotificationFromError(error, t('users.cannot_export_users'))
  } finally {
    exporting.value = false
  }
}

const actionItems = computed<NeDropdownItem[]>(() => [
  {
    id: 'import',
    label: t('users.import_users_from_csv'),
    icon: faCircleArrowUp,
    action: () => (isShownImport.value = true),
  },
  {
    id: 'export',
    label: t('users.export_users_to_csv'),
    icon: faFileCsv,
    disabled: exporting.value || users.value.length === 0,
    action: exportUsers,
  },
  {
    id: 'sync',
    label: syncing.value ? t('users.synchronizing_users') : t('users.sync_users'),
    icon: faArrowsRotate,
    disabled: syncing.value,
    action: syncUsers,
  },
  { id: 'divider-bulk' },
  {
    id: 'voicemail',
    label: t('users.set_voicemail'),
    icon: faVoicemail,
    disabled: configuredCount.value === 0,
    action: () => showBulk('voicemail'),
  },
  {
    id: 'profile',
    label: t('users.assign_profile'),
    icon: faUserGear,
    disabled: users.value.length === 0,
    action: () => showBulk('profile'),
  },
  {
    id: 'devices',
    label: t('users.set_devices'),
    icon: faHeadset,
    disabled: configuredCount.value === 0,
    action: () => showBulk('devices'),
  },
  { id: 'divider-advanced' },
  {
    id: 'advanced',
    label: t('users.advanced_bulk_actions'),
    icon: faGears,
    disabled: configuredCount.value === 0,
    action: () => (isShownAdvancedBulk.value = true),
  },
])

const openFromMenu = (open: () => void) => {
  const buttonId = document.activeElement?.closest('[role="menu"]')?.getAttribute('aria-labelledby')
  const button = buttonId ? document.getElementById(buttonId) : null

  setTimeout(() => {
    button?.focus()
    open()
  })
}

const accountMenuItem = (
  row: UserRow,
  id: string,
  label: string,
  icon: NeDropdownItem['icon'],
  open: () => void,
  danger = false,
): NeDropdownItem[] =>
  accountsManageable.value
    ? [
        {
          id,
          label,
          icon,
          danger,
          disabled: restrictionOf(row) !== null,
          action: () => {
            currentUsername.value = row.username
            openFromMenu(open)
          },
        },
      ]
    : []

const rowMenuItems = (row: UserRow): NeDropdownItem[] => [
  ...accountMenuItem(
    row,
    'change-password',
    t('users.change_password'),
    faKey,
    () => (isShownChangePassword.value = true),
  ),
  {
    id: 'reassign-extension',
    label: t('users.reassign_extension'),
    icon: faRightLeft,
    disabled: row.mainExtension === '',
    action: () => {
      currentUsername.value = row.username
      isShownReassignExtension.value = true
    },
  },
  ...(accountsManageable.value ? [{ id: 'divider-account' }] : []),
  {
    id: 'remove-extension',
    label: t('users.remove_extension'),
    icon: faCircleMinus,
    danger: true,
    disabled: row.mainExtension === '',
    action: () => {
      currentUsername.value = row.username
      isShownRemoveExtension.value = true
    },
  },
  ...accountMenuItem(
    row,
    'delete-user',
    t('common.delete'),
    faTrash,
    () => (isShownDeleteUser.value = true),
    true,
  ),
]

const filterLabels = computed(() => ({
  clearFilterLabel: t('ne_dropdown_filter.clear_selection'),
  openMenuAriaLabel: t('ne_dropdown_filter.open_filter'),
  noOptionsLabel: t('ne_dropdown_filter.no_options'),
  moreOptionsHiddenLabel: t('ne_dropdown_filter.more_options_hidden'),
  clearSearchLabel: t('ne_dropdown_filter.clear_search'),
  optionsFilterPlaceholder: t('ne_dropdown_filter.options_filter_placeholder'),
}))
</script>

<template>
  <div>
    <div class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="text-tertiary-neutral max-w-2xl">
        {{ t('users.description_line_1') }}<br />{{ t('users.description_line_2') }}
      </p>
      <div class="mt-2 flex items-center gap-4 justify-self-start sm:mt-0">
        <UsersActionsDropdown :items="actionItems" />
        <NeButton v-if="!isEmptyStateShown" kind="primary" @click="showCreateUser">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('users.create_user') }}
        </NeButton>
      </div>
    </div>
    <NeInlineNotification
      v-if="domain && !domain.manageable"
      :kind="domain.reason === 'unavailable' ? 'warning' : 'info'"
      class="mb-6"
      :title="creationBlocked"
      :description="
        domain.reason === 'unavailable'
          ? t('users.account_provider_unavailable_description')
          : t('users.users_managed_externally_description')
      "
      :primary-button-label="domain.reason === 'unavailable' ? t('common.retry') : ''"
      data-testid="users-domain-notice"
      @primary-click="domainQuery.refetch()"
    />
    <NeInlineNotification
      v-if="orphans.length > 0"
      kind="warning"
      class="mb-6"
      :title="t('users.orphan_extensions_found', { count: orphans.length }, orphans.length)"
      :description="t('users.orphan_extensions_found_description')"
      :primary-button-label="t('users.show_orphan_extensions')"
      data-testid="orphan-extensions-warning"
      @primary-click="isShownOrphans = true"
    />
    <NeInlineNotification
      v-if="accountsLoadFailed"
      kind="warning"
      class="mb-6"
      :title="t('users.cannot_load_accounts')"
      :description="t('users.cannot_load_accounts_description')"
      :primary-button-label="t('common.retry')"
      data-testid="users-accounts-warning"
      @primary-click="accountsQuery.refetch()"
    />
    <LoadError
      v-if="loadError"
      :error="loadError"
      :title="t('users.cannot_load_users')"
      :class="{ 'mb-6': hasData }"
      @retry="reload"
    />
    <template v-if="!loadError || hasData">
      <NeInlineNotification
        v-if="unavailableParts"
        kind="warning"
        class="mb-6"
        :title="t('users.directory_partially_loaded')"
        :description="
          t('users.directory_partially_loaded_description', { parts: unavailableParts })
        "
        :primary-button-label="t('common.retry')"
        data-testid="users-directory-warning"
        @primary-click="directoryQuery.refetch()"
      />
      <div v-if="!isEmptyStateShown" class="mb-4 flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('users.filter_users')"
          :clear-search-label="t('ne_text_input.clear_search')"
          :aria-label="t('users.filter_users')"
          class="w-full max-w-xs"
        />
        <NeDropdownFilterV2
          v-if="accountsManageable"
          v-model="statusFilter"
          kind="radio"
          :label="t('common.status')"
          :options="statusOptions"
          :show-clear-filter="false"
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="voicemailFilter"
          kind="radio"
          :label="t('users.voicemail')"
          :options="voicemailOptions"
          :show-clear-filter="false"
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="groupsFilter"
          kind="checkbox"
          :label="t('users.groups')"
          :options="groupOptions"
          show-options-filter
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="profilesFilter"
          kind="checkbox"
          :label="t('users.profiles')"
          :options="profileOptions"
          show-options-filter
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="devicesFilter"
          kind="checkbox"
          :label="t('users.devices')"
          :options="deviceOptions"
          show-options-filter
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="phonesFilter"
          kind="radio"
          :label="t('users.physical_phones')"
          :options="phonesOptions"
          :show-clear-filter="false"
          v-bind="filterLabels"
        />
        <NeButton kind="tertiary" :disabled="defaultFilters" @click="resetFilters">
          {{ t('common.reset_filters') }}
        </NeButton>
      </div>
      <p
        v-if="!loading && !isEmptyStateShown"
        class="text-tertiary-neutral mb-6 text-sm"
        data-testid="users-counter"
      >
        {{ t('users.configured_counter', { configured: configuredCount, total: users.length }) }}
        <template v-if="!defaultFilters">
          <span class="mx-1" aria-hidden="true">·</span>
          <span class="sr-only">, </span>
          <span data-testid="users-filtered-counter">
            {{
              t(
                'users.filtered_counter',
                { shown: filteredRows.length, total: rows.length },
                rows.length,
              )
            }}
          </span>
        </template>
      </p>
      <NeEmptyState
        v-if="isEmptyStateShown"
        :title="t('users.no_users')"
        :description="t('users.no_users_description')"
        :icon="faUserGroup"
      >
        <div class="flex flex-wrap justify-center gap-4">
          <NeButton kind="secondary" @click="isShownImport = true">
            <template #prefix>
              <FontAwesomeIcon :icon="faCircleArrowUp" class="size-4" aria-hidden="true" />
            </template>
            {{ t('users.import_users_from_csv') }}
          </NeButton>
          <NeButton kind="primary" @click="showCreateUser">
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
            </template>
            {{ t('users.create_user') }}
          </NeButton>
        </div>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="!loading && filteredRows.length === 0"
        :title="t('users.no_users_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
      >
        <NeButton kind="tertiary" @click="resetFilters">{{ t('common.reset_filters') }}</NeButton>
      </NeEmptyState>
      <NeTable
        v-else
        :aria-label="t('users.tab_users')"
        card-breakpoint="xl"
        :loading="loading"
        :skeleton-columns="7"
        :skeleton-rows="8"
        :sort-key="sortKey"
        :sort-descending="sortDescending"
      >
        <NeTableHead>
          <NeTableHeadCell sortable column-key="displayName" @sort="onSort">
            {{ t('users.user') }}
          </NeTableHeadCell>
          <NeTableHeadCell sortable column-key="mainExtension" @sort="onSort">
            {{ t('users.extension') }}
          </NeTableHeadCell>
          <NeTableHeadCell>{{ t('users.groups') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('users.profile') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('users.devices') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="whitespace-nowrap">{{ t('users.physical_phones') }}</span>
          </NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow
            v-for="row in pagedRows"
            :key="row.username"
            :class="{ 'text-tertiary-neutral': row.locked === true }"
            :data-testid="`user-${row.username}`"
          >
            <NeTableCell :data-label="t('users.user')">
              <div class="flex max-w-xs min-w-0 flex-col">
                <span
                  class="flex min-w-0 items-center gap-2"
                  :class="row.locked === true ? 'text-tertiary-neutral' : 'text-primary-neutral'"
                >
                  <span class="truncate" :title="row.displayName">{{ row.displayName }}</span>
                  <NeBadgeV2
                    v-if="row.locked === true"
                    kind="gray"
                    size="xs"
                    class="shrink-0"
                    :data-testid="`disabled-badge-${row.username}`"
                  >
                    <FontAwesomeIcon :icon="faXmark" class="size-3" aria-hidden="true" />
                    {{ t('common.disabled') }}
                  </NeBadgeV2>
                  <NeBadgeV2
                    v-if="row.account?.adminAccess"
                    :kind="row.account.adminAccess === 'other_instance' ? 'gray' : 'indigo'"
                    size="xs"
                    class="shrink-0"
                    :data-testid="`admin-badge-${row.username}`"
                  >
                    {{ t(`users.admin_access_${row.account.adminAccess}`) }}
                  </NeBadgeV2>
                  <NeTooltip v-if="row.voicemail" trigger-event="mouseenter focus" placement="top">
                    <template #trigger>
                      <span tabindex="0" class="text-secondary flex">
                        <FontAwesomeIcon :icon="faVoicemail" class="size-4" aria-hidden="true" />
                        <span class="sr-only">{{ t('users.voicemail_enabled') }}</span>
                      </span>
                    </template>
                    <template #content>{{ t('users.voicemail_enabled') }}</template>
                  </NeTooltip>
                </span>
                <span
                  class="truncate"
                  :class="row.locked === true ? 'text-tertiary-neutral' : 'text-secondary-neutral'"
                  :title="row.username"
                >
                  {{ row.username }}
                </span>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('users.extension')">
              {{ row.mainExtension || '-' }}
            </NeTableCell>
            <NeTableCell :data-label="t('users.groups')">
              <span v-if="row.groups.length === 0">-</span>
              <div v-else class="flex flex-col">
                <span>
                  {{
                    row.groups
                      .slice(0, MAX_GROUPS_SHOWN)
                      .map((group) => group.name)
                      .join(', ')
                  }}
                </span>
                <NeTooltip
                  v-if="row.groups.length > MAX_GROUPS_SHOWN"
                  trigger-event="mouseenter focus"
                  placement="bottom"
                >
                  <template #trigger>
                    <button
                      type="button"
                      class="text-primary-700 dark:text-primary-500 text-left font-medium"
                    >
                      {{ t('common.plus_n_more', { count: row.groups.length - MAX_GROUPS_SHOWN }) }}
                    </button>
                  </template>
                  <template #content>
                    {{ row.groups.map((group) => group.name).join(', ') }}
                  </template>
                </NeTooltip>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('users.profile')">{{ row.profileName || '-' }}</NeTableCell>
            <NeTableCell :data-label="t('users.devices')">
              <UserDeviceIcons :devices="row.softwareDevices" />
            </NeTableCell>
            <NeTableCell :data-label="t('users.physical_phones')">
              <span v-if="row.physicalPhones.length === 0">-</span>
              <NeTooltip v-else trigger-event="mouseenter focus" placement="top">
                <template #trigger>
                  <button
                    type="button"
                    class="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-300 flex items-center gap-2 rounded-sm focus:outline-hidden focus-visible:ring-2"
                    :aria-label="
                      t('users.physical_phones_of', {
                        name: row.username,
                        count: row.physicalPhones.length,
                      })
                    "
                    :data-testid="`phones-count-${row.username}`"
                  >
                    <FontAwesomeIcon :icon="faOfficePhone" class="size-4" aria-hidden="true" />
                    {{ row.physicalPhones.length }}
                  </button>
                </template>
                <template #content>
                  <div class="flex flex-col gap-2" :data-testid="`phones-tooltip-${row.username}`">
                    <ul>
                      <li v-for="phone in row.physicalPhones" :key="phone.id">
                        {{ describePhone(phone) }}
                      </li>
                    </ul>
                    <RouterLink v-slot="{ href, navigate }" :to="{ name: 'phones' }" custom>
                      <NeLink inverted-theme :href="href" @click="navigate">
                        {{ t('common.go_to_physical_phones') }}
                      </NeLink>
                    </RouterLink>
                  </div>
                </template>
              </NeTooltip>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex items-center gap-2 xl:ml-0 xl:justify-end">
                <NeButton kind="tertiary" @click="showEditUser(row)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ row.username }}</span>
                </NeButton>
                <NeDropdown
                  :items="rowMenuItems(row)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('users.user_actions', { name: row.username })"
                >
                  <template v-if="accountsManageable && restrictionOf(row)" #menuHeader>
                    <p
                      class="text-secondary-neutral max-w-xs px-4 py-2 text-sm"
                      :data-testid="`account-restriction-${row.username}`"
                    >
                      {{ t(`users.${restrictionOf(row)}_restricted`) }}
                    </p>
                  </template>
                </NeDropdown>
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template #paginator>
          <TablePaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="filteredRows.length"
            data-testid="users-paginator"
          />
        </template>
      </NeTable>
    </template>
    <CreateOrEditUserDrawer
      :is-shown="isShownUserDrawer"
      :user="currentUser"
      :users="users"
      :directory="directory"
      :account="currentUser?.account"
      :accounts-manageable="accountsManageable"
      :account-restriction="currentUser ? restrictionOf(currentUser) : null"
      :accounts-loading="
        currentUser ? accountsLoading : domainQuery.state.value.status === 'pending'
      "
      :creation-blocked="creationBlocked"
      @close="isShownUserDrawer = false"
    />
    <ChangePasswordDrawer
      :is-shown="isShownChangePassword"
      :user="currentUser"
      @close="isShownChangePassword = false"
    />
    <DeleteUserModal
      :visible="isShownDeleteUser"
      :user="currentUser"
      @close="isShownDeleteUser = false"
    />
    <ImportUsersFlow
      :is-shown="isShownImport"
      :users="users"
      :directory="directory"
      @close="isShownImport = false"
    />
    <BulkUsersDrawer
      :is-shown="isShownBulkDrawer"
      :action="bulkAction"
      :users="users"
      :directory="directory"
      @close="isShownBulkDrawer = false"
    />
    <AdvancedBulkUsersDrawer
      :is-shown="isShownAdvancedBulk"
      :users="users"
      @close="isShownAdvancedBulk = false"
    />
    <ReassignExtensionModal
      :visible="isShownReassignExtension"
      :user="currentUser"
      :users="users"
      @close="isShownReassignExtension = false"
    />
    <RemoveExtensionModal
      :visible="isShownRemoveExtension"
      :user="currentUser"
      @close="isShownRemoveExtension = false"
    />
    <OrphanExtensionsDrawer
      :is-shown="isShownOrphans"
      :orphans="orphans"
      @close="isShownOrphans = false"
    />
  </div>
</template>
