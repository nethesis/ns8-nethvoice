<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeAvatar,
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeInlineNotification,
  NeSkeleton,
  NeSortDropdown,
  NeSpinner,
  NeTextInput,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCheck,
  faCircleArrowDown,
  faCircleArrowUp,
  faCircleMinus,
  faCirclePlus,
  faGear,
  faMagnifyingGlass,
  faPenToSquare,
  faTrash,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import SetupStepLayout from './SetupStepLayout.vue'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditUserDrawer from '@/components/users/CreateOrEditUserDrawer.vue'
import DeleteUserModal from '@/components/users/DeleteUserModal.vue'
import ImportUsersFlow from '@/components/users/ImportUsersFlow.vue'
import RemoveExtensionModal from '@/components/users/RemoveExtensionModal.vue'
import UsersActionsDropdown from '@/components/users/UsersActionsDropdown.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useSetupNavigation } from '@/composables/useSetupNavigation'
import { matchesText } from '@/lib/common'
import { getInitials } from '@/lib/overview/overview'
import { findAccount, getAccountRestriction } from '@/lib/users/accounts'
import { buildExportFileName, downloadTextFile, getCsvExport } from '@/lib/users/csv'
import {
  buildUserRows,
  EMPTY_USERS_DIRECTORY,
  findBaseProfile,
  type UserRow,
} from '@/lib/users/directory'
import {
  countConfiguredDrafts,
  EXTENSION_ISSUE_MESSAGES,
  getExtensionErrorKind,
  validateExtensionDrafts,
} from '@/lib/users/extensions'
import {
  getDrafts,
  planProvisioning,
  MissingBaseProfileError,
  ProvisioningError,
  runProvisioning,
} from '@/lib/users/provisioning'
import { sortUsers, type UserSortKey } from '@/lib/users/userFilters'
import type { User } from '@/lib/users/users'
import { usePermissions } from '@/queries/permissions/me'
import { useUserAccounts, useUsersDomain } from '@/queries/users/accounts'
import { useUserLimits } from '@/queries/users/userLimits'
import { useInvalidateUsers, useUsers } from '@/queries/users/users'
import { useUsersDirectory } from '@/queries/users/usersDirectory'
import { useUsersProviderSync } from '@/queries/users/usersSync'
import { useLoginStore } from '@/stores/login'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useSetupStore } from '@/stores/setup'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const setupStore = useSetupStore()
const invalidateUsers = useInvalidateUsers()
const usersQuery = useUsers()
const directoryQuery = useUsersDirectory()
const { state: limitsState } = useUserLimits()
const { syncing, syncError, sync } = useUsersProviderSync()
const { advancing, goToNextStep } = useSetupNavigation('users')
const loginStore = useLoginStore()
const { isSuperadmin } = usePermissions()
const domainQuery = useUsersDomain()
const accountsQuery = useUserAccounts()

const edits = ref<Record<string, string>>({})
const serverIssues = ref<Record<string, string>>({})
const missingExtensionFor = ref('')
const provisioning = ref(false)
const textFilter = ref('')
const sortKey = ref<UserSortKey | undefined>()
const sortDescending = ref(false)
const currentUser = ref<UserRow | undefined>()
const isShownUserDrawer = ref(false)
const isShownImport = ref(false)
const isShownRemoveExtension = ref(false)
const isShownDeleteUser = ref(false)
const removingUser = ref<User | undefined>()
const deletingUser = ref<User | undefined>()
const exporting = ref(false)
const progress = ref({ done: 0, total: 0 })
const limitRef = useTemplateRef<HTMLElement>('limitRef')

useFocusReturn(() => isShownUserDrawer.value)
useFocusReturn(() => isShownImport.value)

async function syncUsers() {
  if (await sync()) {
    setupStore.usersSynced = true
  }
}

onMounted(() => {
  if (!setupStore.usersSynced) {
    syncUsers()
  }
})

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
const drafts = computed(() => getDrafts(users.value, edits.value))
const savedExtensions = computed<Record<string, string>>(() =>
  Object.fromEntries(users.value.map((user) => [user.username, user.mainExtension])),
)
const draftIssues = computed(() => validateExtensionDrafts(drafts.value, savedExtensions.value))
const configuredCount = computed(() => countConfiguredDrafts(drafts.value))
const usersLimit = computed(() => limitsState.value.data?.limit ?? null)
const overLimit = computed(
  () => usersLimit.value !== null && configuredCount.value > usersLimit.value,
)

const reservedExtensions = computed(() => Object.values(drafts.value).filter(Boolean))

const accountsManageable = computed(() => domainQuery.state.value.data?.manageable === true)
const accounts = computed(() =>
  accountsManageable.value ? (accountsQuery.state.value.data ?? []) : [],
)

const restrictionOf = (user: User) =>
  getAccountRestriction({
    username: user.username,
    signedInUsername: loginStore.username,
    isSuperadmin: isSuperadmin.value,
    account: findAccount(accounts.value, user.username),
    accountsLoaded: accountsQuery.state.value.status === 'success',
    mainExtension: user.mainExtension,
  })

const visibleUsers = computed(() =>
  sortUsers(
    users.value
      .map((user) => ({ ...user, mainExtension: drafts.value[user.username] ?? '' }))
      .filter((user) =>
        matchesText(textFilter.value, user.displayName, user.username, user.mainExtension),
      ),
    sortKey.value ?? 'displayName',
    sortDescending.value,
  ),
)

const issueFor = (username: string): string => {
  const issue = draftIssues.value[username]

  if (issue) {
    return t(EXTENSION_ISSUE_MESSAGES[issue])
  }

  if (serverIssues.value[username]) {
    return t(serverIssues.value[username])
  }
  return missingExtensionFor.value === username ? t('setup.users.extension_required') : ''
}

const isConfigured = (username: string) => {
  const draft = drafts.value[username]?.trim() ?? ''

  return draft !== '' && !issueFor(username)
}

const hasIssues = computed(() => Object.keys(draftIssues.value).length > 0)

function setDraft(username: string, value: string) {
  edits.value = { ...edits.value, [username]: value }
  missingExtensionFor.value = ''
  serverIssues.value = Object.fromEntries(
    Object.entries(serverIssues.value).filter(([key]) => key !== username),
  )
}

const sortOptions = computed(() => [
  { id: 'displayName', label: t('common.name') },
  { id: 'username', label: t('users.username') },
  { id: 'mainExtension', label: t('users.extension') },
])

function setSortKey(key: string | undefined) {
  sortKey.value =
    key === 'displayName' || key === 'username' || key === 'mainExtension' ? key : undefined
}

function showEditUser(username: string) {
  currentUser.value = buildUserRows(
    users.value.filter((user) => user.username === username),
    directory.value,
  )[0]
  isShownUserDrawer.value = true
}

function openFromMenu(open: () => void) {
  const buttonId = document.activeElement?.closest('[role="menu"]')?.getAttribute('aria-labelledby')
  const button = buttonId ? document.getElementById(buttonId) : null

  setTimeout(() => {
    button?.focus()
    open()
  })
}

const findUser = (username: string) => users.value.find((user) => user.username === username)

const rowMenuItems = (username: string): NeDropdownItem[] => {
  const user = findUser(username)

  return [
    {
      id: 'remove-extension',
      label: t('users.remove_extension'),
      icon: faCircleMinus,
      danger: true,
      disabled: !savedExtensions.value[username],
      action: () =>
        openFromMenu(() => {
          removingUser.value = findUser(username)
          isShownRemoveExtension.value = true
        }),
    },
    ...(accountsManageable.value && user
      ? [
          {
            id: 'delete-user',
            label: t('common.delete'),
            icon: faTrash,
            danger: true,
            disabled: restrictionOf(user) !== null,
            action: () =>
              openFromMenu(() => {
                deletingUser.value = findUser(username)
                isShownDeleteUser.value = true
              }),
          },
        ]
      : []),
  ]
}

const menuRestriction = (username: string) => {
  const user = findUser(username)

  return accountsManageable.value && user ? restrictionOf(user) : null
}

function showCreateUser() {
  currentUser.value = undefined
  isShownUserDrawer.value = true
}

function onUsersImported(usernames: string[]) {
  edits.value = Object.fromEntries(
    Object.entries(edits.value).filter(([username]) => !usernames.includes(username)),
  )
}

async function exportUsers() {
  exporting.value = true

  try {
    downloadTextFile(buildExportFileName(), await getCsvExport())
  } catch (error) {
    notificationsStore.createNotificationFromError(error, t('users.cannot_export_users'), {
      serverDetail: false,
    })
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
])

function describeProvisioningError(error: unknown) {
  if (!(error instanceof ProvisioningError)) {
    return describeError(error, { serverDetail: false })
  }
  const kind = error.phase === 'extension' ? getExtensionErrorKind(error.cause) : 'unknown'
  const detail =
    error.cause instanceof MissingBaseProfileError
      ? t('users.base_profile_missing')
      : kind === 'unknown'
        ? describeError(error.cause, { serverDetail: false })
        : t(`users.extension_error_${kind}`, { limit: usersLimit.value ?? '' })

  return t('setup.users.provisioning_failed_for', {
    name: findUser(error.username)?.displayName || error.username,
    detail: !detail || /[.!?]$/.test(detail) ? detail : `${detail}.`,
  })
}

const focusExtension = (username: string) =>
  document.getElementById(`extension-${username}`)?.focus()

async function focusFirstIssue(fallbackUsername = '') {
  await nextTick()
  const username = visibleUsers.value.find((user) => issueFor(user.username))?.username

  if (username || fallbackUsername) {
    focusExtension(username || fallbackUsername)
  }
}

async function requireExtension() {
  if (visibleUsers.value.length === 0) {
    textFilter.value = ''
    await nextTick()
  }
  const username = visibleUsers.value[0]?.username

  if (username) {
    missingExtensionFor.value = username
    await nextTick()
    focusExtension(username)
  }
}

function saveAndContinue() {
  if (hasIssues.value) {
    focusFirstIssue()
    return
  }

  if (configuredCount.value === 0) {
    requireExtension()
    return
  }

  if (overLimit.value) {
    limitRef.value?.focus()
    return
  }
  provisionAndContinue()
}

function provisionAndContinue() {
  let failedUsername: string | null = null

  goToNextStep(async () => {
    provisioning.value = true
    progress.value = { done: 0, total: 0 }

    try {
      await runProvisioning(
        planProvisioning(users.value, edits.value),
        findBaseProfile(directory.value.profiles)?.id ?? null,
        (done, total) => (progress.value = { done, total }),
      )
      edits.value = {}
      return true
    } catch (error) {
      failedUsername = error instanceof ProvisioningError ? error.username : ''

      if (error instanceof ProvisioningError && error.phase === 'extension') {
        const kind = getExtensionErrorKind(error.cause)

        if (kind === 'in_use') {
          serverIssues.value = { ...serverIssues.value, [error.username]: 'users.extension_in_use' }
        }
      }
      notificationsStore.createNotification({
        kind: 'error',
        title: t('setup.users.provisioning_failed'),
        description: describeProvisioningError(error),
      })
      return false
    } finally {
      provisioning.value = false
      await invalidateUsers()
    }
  }).then(() => {
    if (failedUsername !== null) {
      focusFirstIssue(failedUsername)
    }
  })
}
</script>

<template>
  <SetupStepLayout
    step-id="users"
    :title="t('setup.users.title')"
    :hide-header="provisioning"
    :next-loading="advancing"
    :next-disabled="loading || syncing || !!loadError || users.length === 0"
    @next="saveAndContinue"
  >
    <template #description>
      <p class="text-secondary-neutral max-w-3xl">
        {{ t('setup.users.description_line_1') }}<br />{{ t('setup.users.description_line_2') }}
      </p>
    </template>
    <template v-if="!provisioning && !loading && users.length > 0" #actions>
      <UsersActionsDropdown :items="actionItems" kind="tertiary" />
      <NeButton kind="secondary" @click="showCreateUser">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('users.create_user') }}
      </NeButton>
    </template>
    <NeInlineNotification
      v-if="syncError && !provisioning"
      kind="warning"
      :title="t('users.cannot_sync_users')"
      :description="t('setup.users.cannot_sync_users_description')"
      :primary-button-label="t('common.retry')"
      @primary-click="syncUsers"
    />
    <div
      v-if="provisioning"
      class="elevation-2 flex flex-col items-center gap-2 rounded-lg px-6 py-8 text-center"
      role="status"
      data-testid="configuring-users"
    >
      <FontAwesomeIcon
        :icon="faGear"
        class="mb-2 size-10 animate-spin text-gray-400 motion-reduce:animate-none dark:text-gray-500"
        aria-hidden="true"
      />
      <p class="text-primary-neutral font-medium">{{ t('setup.users.configuring_users') }}</p>
      <p class="text-secondary-neutral text-sm">
        {{ t('setup.users.configuring_users_description_line_1') }}<br />
        {{ t('setup.users.configuring_users_description_line_2') }}
      </p>
      <p
        v-if="progress.total > 0"
        class="text-tertiary-neutral text-sm"
        data-testid="configuring-progress"
      >
        {{ t('setup.users.configuring_progress', progress) }}
      </p>
    </div>
    <template v-else>
      <LoadError
        v-if="loadError"
        :server-detail="false"
        :error="loadError"
        :title="t('users.cannot_load_users')"
        @retry="(usersQuery.refetch(), directoryQuery.refetch())"
      />
      <template v-if="!loadError || hasData">
        <div v-if="loading" class="flex flex-col gap-6">
          <NeSkeleton :lines="1" class="max-w-md" />
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NeSkeleton v-for="index in 6" :key="index" :lines="2" />
          </div>
        </div>
        <NeEmptyState
          v-else-if="users.length === 0"
          :title="t('users.no_users')"
          :description="t('users.no_users_description')"
          :icon="faUserGroup"
          class="elevation-2"
        >
          <div class="flex flex-col items-center gap-4">
            <NeSpinner v-if="syncing" />
            <NeButton kind="primary" @click="showCreateUser">
              <template #prefix>
                <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
              </template>
              {{ t('users.create_user') }}
            </NeButton>
            <NeButton kind="tertiary" @click="isShownImport = true">
              <template #prefix>
                <FontAwesomeIcon :icon="faCircleArrowUp" class="size-4" aria-hidden="true" />
              </template>
              {{ t('users.import_users_from_csv') }}
            </NeButton>
          </div>
        </NeEmptyState>
        <template v-else>
          <div v-if="overLimit" ref="limitRef" tabindex="-1" class="focus:outline-none">
            <NeInlineNotification
              kind="warning"
              :title="t('setup.users.users_limit_title')"
              :description="t('setup.users.users_limit_description', { limit: usersLimit ?? 0 })"
            />
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <NeTextInput
              v-model="textFilter"
              is-search
              :placeholder="t('users.filter_users')"
              :clear-search-label="t('ne_text_input.clear_search')"
              :aria-label="t('users.filter_users')"
              class="w-full max-w-xs"
            />
            <NeSortDropdown
              :sort-key="sortKey"
              :sort-descending="sortDescending"
              :label="t('sort.sort_by')"
              :options="sortOptions"
              :open-menu-aria-label="t('ne_dropdown.open_menu')"
              :sort-by-label="t('sort.sort_by')"
              :sort-direction-label="t('sort.direction')"
              :ascending-label="t('sort.ascending')"
              :descending-label="t('sort.descending')"
              @update:sort-key="setSortKey"
              @update:sort-descending="sortDescending = $event ?? false"
            />
            <span v-if="syncing" class="text-secondary-neutral flex items-center gap-2 text-sm">
              <NeSpinner />
              {{ t('setup.users.syncing_users') }}
            </span>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-primary-neutral text-sm font-medium">
              {{ t('setup.users.assign_extensions') }}
            </h2>
            <p class="text-tertiary-neutral text-sm" data-testid="users-counter">
              {{
                t('users.configured_counter', { configured: configuredCount, total: users.length })
              }}
            </p>
          </div>
          <NeEmptyState
            v-if="visibleUsers.length === 0"
            :title="t('users.no_users_found')"
            :description="t('common.try_different_words')"
            :icon="faMagnifyingGlass"
          >
            <NeButton kind="tertiary" @click="textFilter = ''">
              {{ t('common.clear_filter') }}
            </NeButton>
          </NeEmptyState>
          <ul v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <li
              v-for="user in visibleUsers"
              :key="user.username"
              class="elevation-0 flex flex-wrap items-center gap-4 rounded-lg px-4 py-3"
              :data-testid="`setup-user-${user.username}`"
            >
              <div class="flex min-w-48 flex-1 items-center gap-3">
                <div class="shrink-0" aria-hidden="true">
                  <NeAvatar size="sm" :initials="getInitials(user.displayName)" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="text-primary-neutral truncate text-sm font-medium">
                    {{ user.displayName }}
                  </span>
                  <span class="text-secondary-neutral truncate text-sm">{{ user.username }}</span>
                </div>
              </div>
              <div class="w-44 shrink-0">
                <NeTextInput
                  :id="`extension-${user.username}`"
                  :model-value="drafts[user.username] ?? ''"
                  :placeholder="t('users.extension_placeholder')"
                  :invalid-message="issueFor(user.username)"
                  :aria-label="t('setup.users.extension_of', { name: user.displayName })"
                  :disabled="advancing"
                  inputmode="numeric"
                  @update:model-value="setDraft(user.username, $event)"
                >
                  <template v-if="isConfigured(user.username)" #suffix>
                    <FontAwesomeIcon
                      :icon="faCheck"
                      class="text-icon-enabled size-4"
                      aria-hidden="true"
                    />
                  </template>
                </NeTextInput>
              </div>
              <div class="flex items-center gap-2">
                <NeButton kind="tertiary" @click="showEditUser(user.username)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ user.username }}</span>
                </NeButton>
                <NeDropdown
                  :items="rowMenuItems(user.username)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('users.user_actions', { name: user.username })"
                >
                  <template v-if="menuRestriction(user.username)" #menuHeader>
                    <p
                      class="text-secondary-neutral max-w-xs px-4 py-2 text-sm"
                      :data-testid="`account-restriction-${user.username}`"
                    >
                      {{ t(`users.${menuRestriction(user.username)}_restricted`) }}
                    </p>
                  </template>
                </NeDropdown>
              </div>
            </li>
          </ul>
        </template>
      </template>
    </template>
    <CreateOrEditUserDrawer
      :is-shown="isShownUserDrawer"
      :user="currentUser"
      :users="users"
      :directory="directory"
      variant="setup"
      :reserved-extensions="reservedExtensions"
      @close="isShownUserDrawer = false"
    />
    <ImportUsersFlow
      :is-shown="isShownImport"
      :users="users"
      :directory="directory"
      @close="isShownImport = false"
      @imported="onUsersImported"
    />
    <RemoveExtensionModal
      :visible="isShownRemoveExtension"
      :user="removingUser"
      @close="isShownRemoveExtension = false"
    />
    <DeleteUserModal
      :visible="isShownDeleteUser"
      :user="deletingUser"
      @close="isShownDeleteUser = false"
    />
  </SetupStepLayout>
</template>
