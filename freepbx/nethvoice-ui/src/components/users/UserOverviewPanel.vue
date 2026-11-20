<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faListUl,
  faMagnifyingGlass,
  faStar,
  faUserGroup,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faGrid2, faGridDividers } from '@nethesis/nethesis-solid-svg-icons'
import {
  getPreference,
  NeButton,
  NeDropdownFilterV2,
  NeEmptyState,
  NeSkeleton,
  NeBadgeV2,
  NeSortDropdown,
  NeTextInput,
  NeTooltip,
  savePreference,
  type NeDropdownFilterV2Option,
} from '@nethesis/vue-components'
import LoadError from '@/components/common/LoadError.vue'
import OperatorDetailsDrawer from '@/components/overview/OperatorDetailsDrawer.vue'
import OverviewCompactCard from '@/components/overview/OverviewCompactCard.vue'
import OverviewUserCard from '@/components/overview/OverviewUserCard.vue'
import OverviewUsersTable from '@/components/overview/OverviewUsersTable.vue'
import LiveDataUnavailableNotice from '@/components/common/LiveDataUnavailableNotice.vue'
import { useCtiLiveAccess } from '@/composables/useCtiLiveAccess'
import { usePolling } from '@/composables/usePolling'
import {
  buildModelLabels,
  buildOverviewUsers,
  FAVORITES_FILTER_ID,
  filterOverviewUsers,
  normalizeOverviewView,
  OVERVIEW_REFRESH_INTERVAL,
  OVERVIEW_SORT_KEYS,
  OVERVIEW_STATUSES,
  sortOverviewUsers,
  type OverviewSortKey,
  type OverviewUser,
  type OverviewView,
} from '@/lib/overview/overview'
import { useGroups } from '@/queries/groups/groups'
import { useOverviewLiveState } from '@/queries/overview/overview'
import { usePhoneModels } from '@/queries/phones/models'
import { useUsers } from '@/queries/users/users'
import { useFavoritesStore } from '@/stores/favorites'
import { useLoginStore } from '@/stores/login'

const VIEW_PREFERENCE = 'userOverviewView'

const { t } = useI18n()
const { state: liveState, refetch: refetchLive } = useOverviewLiveState()
const { state: usersState, refetch: refetchUsers } = useUsers()
const { state: groupsState, refetch: refetchGroups } = useGroups()
const { state: phoneModelsState } = usePhoneModels()

const liveAvailable = useCtiLiveAccess()

usePolling(() => {
  if (liveAvailable.value) {
    refetchLive()
  }
}, OVERVIEW_REFRESH_INTERVAL)

const textFilter = ref('')
const statusFilter = ref<NeDropdownFilterV2Option[]>([])
const groupFilter = ref<NeDropdownFilterV2Option[]>([])
const groupByFilter = ref<NeDropdownFilterV2Option[]>([])
const favoritesStore = useFavoritesStore()
const sortKey = ref<OverviewSortKey>('name')
const sortDescending = ref(false)
const loginStore = useLoginStore()

const readView = (): OverviewView => {
  try {
    return normalizeOverviewView(
      loginStore.username ? getPreference(VIEW_PREFERENCE, loginStore.username) : undefined,
    )
  } catch {
    return normalizeOverviewView(undefined)
  }
}

const view = ref<OverviewView>(readView())

function selectView(selected: OverviewView) {
  view.value = selected

  if (loginStore.username) {
    try {
      savePreference(VIEW_PREFERENCE, selected, loginStore.username)
    } catch {
      return
    }
  }
}
const selectedUsername = ref('')
const isShownDetails = ref(false)

const VIEW_OPTIONS: { id: OverviewView; icon: IconDefinition }[] = [
  { id: 'grid', icon: faGrid2 },
  { id: 'list', icon: faListUl },
  { id: 'compact', icon: faGridDividers },
]

const loading = computed(
  () =>
    liveState.value.status === 'pending' ||
    usersState.value.status === 'pending' ||
    groupsState.value.status === 'pending',
)

const loadError = computed(
  () => liveState.value.error ?? usersState.value.error ?? groupsState.value.error,
)

const overviewUsers = computed(() =>
  liveState.value.data
    ? buildOverviewUsers(
        liveState.value.data,
        usersState.value.data ?? [],
        groupsState.value.data ?? [],
        buildModelLabels(phoneModelsState.value.data ?? []),
      )
    : [],
)

const shownUsers = computed(() =>
  sortOverviewUsers(
    filterOverviewUsers(overviewUsers.value, {
      text: textFilter.value,
      statuses: OVERVIEW_STATUSES.filter((status) =>
        statusFilter.value.some((option) => option.id === status),
      ),
      groups: groupFilter.value.map((option) => option.id),
      favorites: favoritesStore.favorites,
    }),
    sortKey.value,
    sortDescending.value,
    favoritesStore.favorites,
  ),
)

const selectedUser = computed(() =>
  overviewUsers.value.find((user) => user.username === selectedUsername.value),
)

const statusOptions = computed<NeDropdownFilterV2Option[]>(() =>
  OVERVIEW_STATUSES.map((status) => ({ id: status, label: t(`user_overview.status.${status}`) })),
)

const groupOptions = computed<NeDropdownFilterV2Option[]>(() => [
  { id: FAVORITES_FILTER_ID, label: t('user_overview.favorites') },
  ...(groupsState.value.data ?? []).map((group) => ({ id: group.name, label: group.name })),
])

const groupByOptions = computed<NeDropdownFilterV2Option[]>(() => [
  { id: 'group', label: t('user_overview.group_by.group') },
  { id: 'status', label: t('user_overview.group_by.status') },
])

const groupBy = computed(() => (groupByFilter.value[0]?.id === 'status' ? 'status' : 'group'))

type UserSection = {
  id: string
  label: string
  kind: 'blue' | 'gray'
  icon: IconDefinition
  users: OverviewUser[]
}

const groupedUsers = computed<UserSection[]>(() => {
  if (groupBy.value === 'status') {
    return OVERVIEW_STATUSES.map((status) => ({
      id: `status-${status}`,
      label: t(`user_overview.status.${status}`),
      kind: 'gray' as const,
      icon: faUserGroup,
      users: shownUsers.value.filter((user) => user.presence === status),
    })).filter((section) => section.users.length > 0)
  }
  const sections: UserSection[] = []
  const favorites = shownUsers.value.filter((user) => favoritesStore.isFavorite(user.username))

  if (favorites.length > 0) {
    sections.push({
      id: 'favorites',
      label: t('user_overview.favorites'),
      kind: 'blue',
      icon: faStar,
      users: favorites,
    })
  }
  const names = [...new Set(shownUsers.value.flatMap((user) => user.groups))].sort((a, b) =>
    a.localeCompare(b),
  )
  for (const name of names) {
    sections.push({
      id: `group-${name}`,
      label: name,
      kind: 'blue',
      icon: faUserGroup,
      users: shownUsers.value.filter((user) => user.groups.includes(name)),
    })
  }
  const withoutGroup = shownUsers.value.filter((user) => user.groups.length === 0)

  if (withoutGroup.length > 0) {
    sections.push({
      id: 'no-group',
      label: t('user_overview.no_group'),
      kind: 'gray',
      icon: faUserGroup,
      users: withoutGroup,
    })
  }
  return sections
})

const sortOptions = computed(() =>
  OVERVIEW_SORT_KEYS.map((key) => ({ id: key, label: t(`user_overview.sort.${key}`) })),
)

const sortKeyModel = computed({
  get: () => sortKey.value,
  set: (key: string) => {
    sortKey.value = OVERVIEW_SORT_KEYS.find((item) => item === key) ?? 'name'
  },
})

const defaultFilters = computed(
  () =>
    textFilter.value === '' &&
    statusFilter.value.length === 0 &&
    groupFilter.value.length === 0 &&
    groupByFilter.value.length === 0 &&
    sortKey.value === 'name' &&
    !sortDescending.value,
)

function resetFilters() {
  textFilter.value = ''
  statusFilter.value = []
  groupFilter.value = []
  groupByFilter.value = []
  sortKey.value = 'name'
  sortDescending.value = false
}

function showDetails(user: OverviewUser) {
  selectedUsername.value = user.username
  isShownDetails.value = true
}

function reload() {
  if (liveAvailable.value) {
    refetchLive()
  }
  refetchUsers()
  refetchGroups()
}
</script>

<template>
  <div>
    <LiveDataUnavailableNotice v-if="!liveAvailable" />
    <LoadError
      v-else-if="loadError"
      :error="loadError"
      :title="t('user_overview.cannot_load')"
      @retry="reload"
    />
    <template v-else>
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-4">
          <NeTextInput
            v-model="textFilter"
            is-search
            :placeholder="t('user_overview.filter_users')"
            :aria-label="t('user_overview.filter_users')"
            :clear-search-label="t('ne_text_input.clear_search')"
            class="w-full max-w-xs"
          />
          <NeDropdownFilterV2
            v-model="statusFilter"
            kind="checkbox"
            :label="t('common.status')"
            :options="statusOptions"
            :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
            :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
            :no-options-label="t('ne_dropdown_filter.no_options')"
            :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
            :clear-search-label="t('ne_dropdown_filter.clear_search')"
          />
          <NeDropdownFilterV2
            v-model="groupFilter"
            kind="checkbox"
            :label="t('user_overview.groups')"
            :options="groupOptions"
            show-options-filter
            :options-filter-placeholder="t('ne_dropdown_filter.options_filter_placeholder')"
            :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
            :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
            :no-options-label="t('ne_dropdown_filter.no_options')"
            :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
            :clear-search-label="t('ne_dropdown_filter.clear_search')"
          />
          <NeSortDropdown
            v-model:sort-key="sortKeyModel"
            v-model:sort-descending="sortDescending"
            :label="t('sort.sort_by')"
            :options="sortOptions"
            :open-menu-aria-label="t('ne_dropdown.open_menu')"
            :sort-by-label="t('sort.sort_by')"
            :sort-direction-label="t('sort.direction')"
            :ascending-label="t('sort.ascending')"
            :descending-label="t('sort.descending')"
          />
          <NeDropdownFilterV2
            v-if="view === 'compact'"
            v-model="groupByFilter"
            kind="radio"
            :label="t('user_overview.group_by.label')"
            :options="groupByOptions"
            :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
            :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
            :no-options-label="t('ne_dropdown_filter.no_options')"
            :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
            :clear-search-label="t('ne_dropdown_filter.clear_search')"
          />
          <NeButton kind="tertiary" :disabled="defaultFilters" @click="resetFilters">
            {{ t('common.reset_filters') }}
          </NeButton>
        </div>
        <div class="flex items-center gap-1" role="group" :aria-label="t('user_overview.view')">
          <NeTooltip
            v-for="option in VIEW_OPTIONS"
            :key="option.id"
            trigger-event="mouseenter focus"
            placement="top"
          >
            <template #trigger>
              <NeButton
                kind="tertiary"
                :class="['p-2.5!', { 'bg-elevation-3': view === option.id }]"
                :aria-pressed="view === option.id"
                @click="selectView(option.id)"
              >
                <FontAwesomeIcon :icon="option.icon" class="size-4" aria-hidden="true" />
                <span class="sr-only">{{ t(`user_overview.views.${option.id}`) }}</span>
              </NeButton>
            </template>
            <template #content>{{ t(`user_overview.views.${option.id}`) }}</template>
          </NeTooltip>
        </div>
      </div>
      <OverviewUsersTable
        v-if="loading && view === 'list'"
        :users="[]"
        loading
        :is-favorite="favoritesStore.isFavorite"
      />
      <div
        v-else-if="loading"
        class="3xl:grid-cols-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      >
        <div v-for="index in 5" :key="index" class="bg-elevation-0 rounded-lg p-5">
          <NeSkeleton :lines="4" />
        </div>
      </div>
      <NeEmptyState
        v-else-if="overviewUsers.length === 0"
        :title="t('user_overview.no_users')"
        :description="t('user_overview.no_users_description')"
        :icon="faUserGroup"
        class="bg-elevation-2"
      />
      <NeEmptyState
        v-else-if="shownUsers.length === 0"
        :title="t('user_overview.no_users_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
        class="bg-elevation-2"
      >
        <NeButton kind="tertiary" @click="resetFilters">{{ t('common.reset_filters') }}</NeButton>
      </NeEmptyState>
      <ul
        v-else-if="view === 'grid'"
        class="3xl:grid-cols-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      >
        <li v-for="user in shownUsers" :key="user.username" :data-user="user.username">
          <OverviewUserCard
            :user="user"
            :favorite="favoritesStore.isFavorite(user.username)"
            @details="showDetails(user)"
          />
        </li>
      </ul>
      <OverviewUsersTable
        v-else-if="view === 'list'"
        :users="shownUsers"
        :is-favorite="favoritesStore.isFavorite"
        @details="showDetails"
      />
      <div v-else class="flex flex-col gap-8">
        <section
          v-for="section in groupedUsers"
          :key="section.id"
          :aria-label="section.label"
          class="flex flex-col gap-4"
          data-testid="overview-group"
        >
          <h3 class="flex">
            <NeBadgeV2 :kind="section.kind" size="xs">
              <FontAwesomeIcon :icon="section.icon" class="size-4" aria-hidden="true" />
              {{ section.label }}
            </NeBadgeV2>
          </h3>
          <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <li v-for="user in section.users" :key="user.username" :data-user="user.username">
              <OverviewCompactCard
                :user="user"
                :favorite="favoritesStore.isFavorite(user.username)"
                @details="showDetails(user)"
              />
            </li>
          </ul>
        </section>
      </div>
    </template>
    <OperatorDetailsDrawer
      :is-shown="isShownDetails"
      :user="selectedUser"
      @close="isShownDetails = false"
    />
  </div>
</template>
