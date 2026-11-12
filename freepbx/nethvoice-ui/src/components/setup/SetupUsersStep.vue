<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
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
  faCircleArrowDown,
  faCircleArrowUp,
  faCirclePlus,
  faCircleUser,
  faGear,
  faMagnifyingGlass,
  faPenToSquare,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import SetupStepLayout from './SetupStepLayout.vue'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditUserDrawer from '@/components/users/CreateOrEditUserDrawer.vue'
import ImportUsersFlow from '@/components/users/ImportUsersFlow.vue'
import UsersActionsDropdown from '@/components/users/UsersActionsDropdown.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'
import { matchesText } from '@/lib/common'
import { downloadTextFile, getCsvExport } from '@/lib/users/csv'
import {
  buildUserRows,
  EMPTY_USERS_DIRECTORY,
  findBaseProfile,
  type UserRow,
} from '@/lib/users/directory'
import {
  countConfiguredDrafts,
  getExtensionErrorKind,
  validateExtensionDrafts,
} from '@/lib/users/extensions'
import {
  getDrafts,
  planProvisioning,
  ProvisioningError,
  runProvisioning,
} from '@/lib/users/provisioning'
import { sortUsers, type UserSortKey } from '@/lib/users/userFilters'
import { useUserLimits } from '@/queries/users/userLimits'
import { useInvalidateUsers, useUsers } from '@/queries/users/users'
import { useUsersDirectory } from '@/queries/users/usersDirectory'
import { useUsersProviderSync } from '@/queries/users/usersSync'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()
const usersQuery = useUsers()
const directoryQuery = useUsersDirectory()
const { state: limitsState } = useUserLimits()
const { syncing, sync } = useUsersProviderSync()
const { advancing, goToNextStep } = useSetupNavigation('users')

const edits = ref<Record<string, string>>({})
const serverIssues = ref<Record<string, string>>({})
const provisioning = ref(false)
const provisioningError = ref<unknown>(null)
const textFilter = ref('')
const sortKey = ref<UserSortKey>('displayName')
const sortDescending = ref(false)
const currentUser = ref<UserRow | undefined>()
const isShownUserDrawer = ref(false)
const isShownImport = ref(false)
const exporting = ref(false)

onMounted(sync)

const loading = computed(
  () =>
    usersQuery.state.value.status === 'pending' || directoryQuery.state.value.status === 'pending',
)
const loadError = computed(
  () => usersQuery.state.value.error ?? directoryQuery.state.value.error ?? null,
)
const users = computed(() => usersQuery.state.value.data ?? [])
const directory = computed(() => directoryQuery.state.value.data ?? EMPTY_USERS_DIRECTORY)
const drafts = computed(() => getDrafts(users.value, edits.value))
const draftIssues = computed(() => validateExtensionDrafts(drafts.value))
const configuredCount = computed(() => countConfiguredDrafts(drafts.value))
const usersLimit = computed(() => limitsState.value.data?.limit ?? null)
const overLimit = computed(
  () => usersLimit.value !== null && configuredCount.value > usersLimit.value,
)

const reservedExtensions = computed(() => Object.values(drafts.value).filter(Boolean))

const visibleUsers = computed(() =>
  sortUsers(
    users.value
      .map((user) => ({ ...user, mainExtension: drafts.value[user.username] ?? '' }))
      .filter((user) =>
        matchesText(textFilter.value, user.displayName, user.username, user.mainExtension),
      ),
    sortKey.value,
    sortDescending.value,
  ),
)

const issueFor = (username: string): string => {
  const issue = draftIssues.value[username]

  if (issue) {
    return t(issue === 'duplicate' ? 'users.extension_already_assigned' : 'users.extension_invalid')
  }
  return serverIssues.value[username] ? t(serverIssues.value[username]) : ''
}

const hasIssues = computed(() => Object.keys(draftIssues.value).length > 0)

function setDraft(username: string, value: string) {
  edits.value = { ...edits.value, [username]: value }
  serverIssues.value = Object.fromEntries(
    Object.entries(serverIssues.value).filter(([key]) => key !== username),
  )
}

const sortOptions = computed(() => [
  { id: 'displayName', label: t('users.name') },
  { id: 'username', label: t('users.username') },
  { id: 'mainExtension', label: t('users.extension') },
])

function setSortKey(key: string | undefined) {
  sortKey.value = key === 'username' || key === 'mainExtension' ? key : 'displayName'
}

function showEditUser(username: string) {
  currentUser.value = buildUserRows(
    users.value.filter((user) => user.username === username),
    directory.value,
  )[0]
  isShownUserDrawer.value = true
}

function showCreateUser() {
  currentUser.value = undefined
  isShownUserDrawer.value = true
}

function onUserCreated(username: string, extension: string) {
  if (extension) {
    setDraft(username, extension)
  }
}

function onUsersImported(usernames: string[]) {
  edits.value = Object.fromEntries(
    Object.entries(edits.value).filter(([username]) => !usernames.includes(username)),
  )
}

async function exportUsers() {
  exporting.value = true

  try {
    downloadTextFile('users.csv', await getCsvExport())
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
])

const provisioningErrorDescription = computed(() => {
  const error = provisioningError.value

  if (!(error instanceof ProvisioningError)) {
    return describeError(error)
  }
  const kind = error.phase === 'extension' ? getExtensionErrorKind(error.cause) : 'unknown'
  const detail =
    kind === 'unknown' ? describeError(error.cause) : t(`users.extension_error_${kind}`)

  return t('setup.users.provisioning_failed_for', { username: error.username, detail })
})

async function focusFirstIssue() {
  await nextTick()
  const username = visibleUsers.value.find((user) => issueFor(user.username))?.username

  if (username) {
    document.getElementById(`extension-${username}`)?.focus()
  }
}

function saveAndContinue() {
  if (hasIssues.value) {
    focusFirstIssue()
    return
  }
  provisioningError.value = null

  goToNextStep(async () => {
    provisioning.value = true

    try {
      await runProvisioning(
        planProvisioning(users.value, edits.value),
        findBaseProfile(directory.value.profiles)?.id ?? null,
      )
      edits.value = {}
      return true
    } catch (error) {
      provisioningError.value = error

      if (error instanceof ProvisioningError && error.phase === 'extension') {
        const kind = getExtensionErrorKind(error.cause)

        if (kind === 'in_use') {
          serverIssues.value = { ...serverIssues.value, [error.username]: 'users.extension_in_use' }
        }
      }
      return false
    } finally {
      provisioning.value = false
      await invalidateUsers()
    }
  }).then(() => {
    if (provisioningError.value) {
      focusFirstIssue()
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
    :next-disabled="loading || !!loadError || configuredCount === 0 || overLimit"
    @next="saveAndContinue"
  >
    <template #description>
      <p class="text-secondary-neutral max-w-3xl">
        {{ t('setup.users.description_line_1') }}<br />{{ t('setup.users.description_line_2') }}
      </p>
    </template>
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
    </div>
    <LoadError
      v-else-if="loadError"
      :error="loadError"
      :title="t('users.cannot_load_users')"
      @retry="(usersQuery.refetch(), directoryQuery.refetch())"
    />
    <div v-else-if="loading" class="flex flex-col gap-6">
      <NeSkeleton :lines="1" class="max-w-md" />
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NeSkeleton v-for="index in 6" :key="index" :lines="2" />
      </div>
    </div>
    <NeEmptyState
      v-else-if="users.length === 0"
      :title="t('users.no_users_yet')"
      :description="t('users.no_users_yet_description')"
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
      <NeInlineNotification
        v-if="provisioningError"
        kind="error"
        :title="t('setup.users.provisioning_failed')"
        :description="provisioningErrorDescription"
      />
      <NeInlineNotification
        v-if="overLimit"
        kind="warning"
        :title="t('setup.users.users_limit_title')"
        :description="t('setup.users.users_limit_description', { limit: usersLimit ?? 0 })"
      />
      <div class="flex flex-wrap items-center justify-between gap-4">
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
        <div class="flex items-center gap-4">
          <UsersActionsDropdown :items="actionItems" kind="tertiary" />
          <NeButton kind="secondary" @click="showCreateUser">
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
            </template>
            {{ t('users.create_user') }}
          </NeButton>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-primary-neutral text-sm font-medium">
          {{ t('setup.users.assign_extensions') }}
        </h2>
        <p class="text-tertiary-neutral text-sm" data-testid="users-counter">
          {{ t('users.configured_counter', { configured: configuredCount, total: users.length }) }}
        </p>
      </div>
      <NeEmptyState
        v-if="visibleUsers.length === 0"
        :title="t('users.no_users_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
      >
        <NeButton kind="tertiary" @click="textFilter = ''">
          {{ t('common.reset_filters') }}
        </NeButton>
      </NeEmptyState>
      <ul v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <li
          v-for="user in visibleUsers"
          :key="user.username"
          class="elevation-0 flex flex-wrap items-start gap-4 rounded-lg px-4 py-3"
          :data-testid="`setup-user-${user.username}`"
        >
          <div class="flex min-w-48 flex-1 items-center gap-3 pt-1">
            <FontAwesomeIcon
              :icon="faCircleUser"
              class="size-8 shrink-0 text-gray-700 dark:text-gray-100"
              aria-hidden="true"
            />
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
            />
          </div>
          <NeButton kind="tertiary" class="mt-0.5" @click="showEditUser(user.username)">
            <template #prefix>
              <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
            </template>
            {{ t('common.edit') }}
            <span class="sr-only">{{ user.username }}</span>
          </NeButton>
        </li>
      </ul>
    </template>
    <CreateOrEditUserDrawer
      :is-shown="isShownUserDrawer"
      :user="currentUser"
      :users="users"
      :directory="directory"
      variant="setup"
      :reserved-extensions="reservedExtensions"
      @close="isShownUserDrawer = false"
      @created="onUserCreated"
    />
    <ImportUsersFlow
      :is-shown="isShownImport"
      :users="users"
      :directory="directory"
      @close="isShownImport = false"
      @imported="onUsersImported"
    />
  </SetupStepLayout>
</template>
