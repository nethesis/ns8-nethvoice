<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
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
  NeTooltip,
  type NeDropdownFilterV2Option,
  type NeDropdownItem,
  type SortEvent,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleArrowDown,
  faCircleArrowUp,
  faCirclePlus,
  faGears,
  faHeadset,
  faLinkSlash,
  faMagnifyingGlass,
  faPenToSquare,
  faRightLeft,
  faRotate,
  faUserGroup,
  faUserGear,
  faVoicemail,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import TablePaginator from '@/components/common/TablePaginator.vue'
import AdvancedBulkUsersDrawer from '@/components/users/AdvancedBulkUsersDrawer.vue'
import BulkUsersDrawer, { type BulkUsersAction } from '@/components/users/BulkUsersDrawer.vue'
import CreateOrEditUserDrawer from '@/components/users/CreateOrEditUserDrawer.vue'
import ImportUsersFlow from '@/components/users/ImportUsersFlow.vue'
import OrphanExtensionsDrawer from '@/components/users/OrphanExtensionsDrawer.vue'
import ReassignExtensionModal from '@/components/users/ReassignExtensionModal.vue'
import RemoveExtensionModal from '@/components/users/RemoveExtensionModal.vue'
import UserDeviceIcons from '@/components/users/UserDeviceIcons.vue'
import UsersActionsDropdown from '@/components/users/UsersActionsDropdown.vue'
import { DEFAULT_PAGE_SIZE, paginate } from '@/lib/common'
import { buildExportFileName, downloadTextFile, getCsvExport } from '@/lib/users/csv'
import {
  buildUserRows,
  EMPTY_USERS_DIRECTORY,
  type DirectoryPart,
  type UserRow,
} from '@/lib/users/directory'
import {
  areDefaultUserFilters,
  filterUserRows,
  sortUsers,
  type PhysicalPhonesFilter,
  type UserFilters,
  type UserSortKey,
  type VoicemailFilter,
} from '@/lib/users/userFilters'
import {
  countConfiguredUsers,
  SOFTWARE_DEVICE_TYPES,
  type SoftwareDeviceType,
} from '@/lib/users/users'
import { useOrphanExtensions } from '@/queries/users/orphanExtensions'
import { useUsers } from '@/queries/users/users'
import { useUsersDirectory } from '@/queries/users/usersDirectory'
import { useUsersProviderSync } from '@/queries/users/usersSync'
import { useNotificationsStore } from '@/stores/notifications'

const MAX_GROUPS_SHOWN = 2

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const usersQuery = useUsers()
const directoryQuery = useUsersDirectory()

const loading = computed(
  () =>
    usersQuery.state.value.status === 'pending' || directoryQuery.state.value.status === 'pending',
)
const loadError = computed(
  () => usersQuery.state.value.error ?? directoryQuery.state.value.error ?? null,
)
const users = computed(() => usersQuery.state.value.data ?? [])
const directory = computed(() => directoryQuery.state.value.data ?? EMPTY_USERS_DIRECTORY)
const rows = computed(() => buildUserRows(users.value, directory.value))
const configuredCount = computed(() => countConfiguredUsers(users.value))
const orphansQuery = useOrphanExtensions()
const orphans = computed(() => orphansQuery.state.value.data ?? [])
const isShownOrphans = ref(false)

const DIRECTORY_PART_LABELS: Record<DirectoryPart, string> = {
  groups: 'users.groups',
  profiles: 'users.profiles',
  voicemails: 'users.voicemail',
  mobiles: 'users.mobile_number',
}

const unavailableParts = computed(() =>
  (directory.value.unavailable ?? []).map((part) => t(DIRECTORY_PART_LABELS[part])).join(', '),
)

const anyOption = (): NeDropdownFilterV2Option => ({ id: 'any', label: t('users.filter_any') })

const textFilter = ref('')
const voicemailFilter = ref<NeDropdownFilterV2Option[]>([anyOption()])
const groupsFilter = ref<NeDropdownFilterV2Option[]>([])
const profilesFilter = ref<NeDropdownFilterV2Option[]>([])
const devicesFilter = ref<NeDropdownFilterV2Option[]>([])
const phonesFilter = ref<NeDropdownFilterV2Option[]>([anyOption()])
const sortKey = ref<UserSortKey>('displayName')
const sortDescending = ref(false)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

const voicemailOptions = computed<NeDropdownFilterV2Option[]>(() => [
  anyOption(),
  { id: 'enabled', label: t('users.voicemail_enabled') },
  { id: 'disabled', label: t('users.voicemail_disabled') },
])

const phonesOptions = computed<NeDropdownFilterV2Option[]>(() => [
  anyOption(),
  { id: 'with', label: t('users.with_physical_phones') },
  { id: 'without', label: t('users.without_physical_phones') },
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

const firstId = (options: NeDropdownFilterV2Option[]) => options[0]?.id ?? 'any'

const filters = computed<UserFilters>(() => ({
  text: textFilter.value,
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
const currentUser = computed<UserRow | undefined>(() =>
  currentUsername.value === ''
    ? undefined
    : rows.value.find((row) => row.username === currentUsername.value),
)
const isShownUserDrawer = ref(false)
const isShownImport = ref(false)
const isShownRemoveExtension = ref(false)
const isShownReassignExtension = ref(false)
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
  await sync()

  if (syncError.value) {
    notificationsStore.createNotificationFromError(syncError.value, t('users.cannot_sync_users'))
    return
  }
  directoryQuery.refetch()
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
    icon: faCircleArrowDown,
    disabled: exporting.value || users.value.length === 0,
    action: exportUsers,
  },
  {
    id: 'sync',
    label: syncing.value ? t('users.synchronizing_users') : t('users.sync_users'),
    icon: faRotate,
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

const rowMenuItems = (row: UserRow): NeDropdownItem[] => [
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
  {
    id: 'remove-extension',
    label: t('users.remove_extension'),
    icon: faLinkSlash,
    danger: true,
    disabled: row.mainExtension === '',
    action: () => {
      currentUsername.value = row.username
      isShownRemoveExtension.value = true
    },
  },
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
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <p class="text-secondary-neutral max-w-[608px]">
        {{ t('users.description_line_1') }}<br />{{ t('users.description_line_2') }}
      </p>
      <div class="flex items-center gap-4">
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
      v-if="orphans.length > 0"
      kind="warning"
      class="mb-6"
      :title="t('users.orphan_extensions_found', { count: orphans.length }, orphans.length)"
      :description="t('users.orphan_extensions_found_description')"
      :primary-button-label="t('users.show_orphan_extensions')"
      data-testid="orphan-extensions-warning"
      @primary-click="isShownOrphans = true"
    />
    <LoadError
      v-if="loadError"
      :error="loadError"
      :title="t('users.cannot_load_users')"
      @retry="reload"
    />
    <template v-else>
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
          :show-options-filter="groupOptions.length > 8"
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="profilesFilter"
          kind="checkbox"
          :label="t('users.profiles')"
          :options="profileOptions"
          v-bind="filterLabels"
        />
        <NeDropdownFilterV2
          v-model="devicesFilter"
          kind="checkbox"
          :label="t('users.devices')"
          :options="deviceOptions"
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
            :data-testid="`user-${row.username}`"
          >
            <NeTableCell :data-label="t('users.user')">
              <div class="flex max-w-xs min-w-0 flex-col">
                <span class="text-primary-neutral flex min-w-0 items-center gap-2">
                  <span class="truncate" :title="row.displayName">{{ row.displayName }}</span>
                  <NeTooltip v-if="row.voicemail" trigger-event="mouseenter focus" placement="top">
                    <template #trigger>
                      <span tabindex="0" class="flex text-indigo-500 dark:text-indigo-300">
                        <FontAwesomeIcon :icon="faVoicemail" class="size-4" aria-hidden="true" />
                        <span class="sr-only">{{ t('users.voicemail_enabled') }}</span>
                      </span>
                    </template>
                    <template #content>{{ t('users.voicemail_enabled') }}</template>
                  </NeTooltip>
                </span>
                <span class="text-secondary-neutral truncate" :title="row.username">
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
              <span v-else class="flex items-center gap-2">
                <FontAwesomeIcon :icon="faOfficePhone" class="size-4" aria-hidden="true" />
                {{ row.physicalPhones.length }}
              </span>
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
                />
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
      @close="isShownUserDrawer = false"
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
