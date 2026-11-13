<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faChevronDown,
  faCircleCheck,
  faCircleMinus,
  faCirclePlus,
  faClone,
  faMagnifyingGlass,
  faPenToSquare,
  faStar,
  faTrash,
  faUserGear,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import {
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeSkeleton,
  NeTextInput,
  NeTooltip,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditProfileDrawer from '@/components/profiles/CreateOrEditProfileDrawer.vue'
import DeleteProfileModal from '@/components/profiles/DeleteProfileModal.vue'
import {
  DEFAULT_PROFILE_IDS,
  filterProfiles,
  getProfileUsers,
  isDefaultProfile,
  type Profile,
  type ProfileDrawerMode,
} from '@/lib/profiles/profiles'
import { useProfiles, useSubscriptionActive } from '@/queries/profiles/profiles'
import { useUsers } from '@/queries/users/users'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const { t } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()
const { state: profilesState, refetch: refetchProfiles } = useProfiles()
const { state: usersState, refetch: refetchUsers } = useUsers()
const { state: subscriptionState } = useSubscriptionActive()

const textFilter = ref('')
const drawerMode = ref<ProfileDrawerMode | undefined>()
const isShownDrawer = ref(false)
const profileToDelete = ref<Profile | undefined>()
const isShownDeleteModal = ref(false)

const CARDS_GRID_CLASSES = 'grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3'

const DEFAULT_PROFILE_ICONS: Record<number, IconDefinition> = {
  1: faCircleMinus,
  2: faCircleCheck,
  3: faCirclePlus,
}

const loading = computed(
  () => profilesState.value.status === 'pending' || usersState.value.status === 'pending',
)

const loadError = computed(() => profilesState.value.error ?? usersState.value.error)

const profiles = computed(() => profilesState.value.data ?? [])

const users = computed(() => usersState.value.data ?? [])

const filteredProfiles = computed(() => filterProfiles(profiles.value, textFilter.value))

const createFromItems = computed<NeDropdownItem[]>(() =>
  profiles.value.map((profile) => ({
    id: `create-from-${profile.id}`,
    label: profile.name,
    icon: getProfileIcon(profile),
    action: () => showCreateDrawer(profile),
  })),
)

function getProfileIcon(profile: Profile): IconDefinition {
  return DEFAULT_PROFILE_ICONS[profile.id] ?? faStar
}

function usersCount(profile: Profile) {
  return getProfileUsers(profile.id, users.value).length
}

function showCreateDrawer(source: Profile) {
  drawerMode.value = { kind: 'create', source }
  isShownDrawer.value = true
}

function showEditDrawer(profile: Profile) {
  drawerMode.value = { kind: 'edit', profile }
  isShownDrawer.value = true
}

function showDeleteModal(profile: Profile) {
  profileToDelete.value = profile
  isShownDeleteModal.value = true
}

function getKebabMenuItems(profile: Profile): NeDropdownItem[] {
  return [
    {
      id: 'duplicate',
      label: t('profiles.duplicate'),
      icon: faClone,
      action: () => showCreateDrawer(profile),
    },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => showDeleteModal(profile),
    },
  ]
}

function reload() {
  refetchProfiles()
  refetchUsers()
}
</script>

<template>
  <div>
    <LoadError v-if="loadError" :error="loadError" @retry="reload" />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
        <p class="text-secondary-neutral max-w-152">
          {{ t('profiles.description_line_1') }}<br />{{
            t('profiles.description_line_2', { brand: runtimeConfigStore.config.brandName })
          }}
        </p>
        <NeDropdown
          :items="createFromItems"
          :align-to-right="true"
          :open-menu-aria-label="t('profiles.create_profile')"
          menu-classes="min-w-48"
        >
          <template #button>
            <NeButton kind="primary" tabindex="-1" aria-hidden="true">
              <template #prefix>
                <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
              </template>
              {{ t('profiles.create_profile') }}
              <template #suffix>
                <FontAwesomeIcon :icon="faChevronDown" class="size-4" aria-hidden="true" />
              </template>
            </NeButton>
          </template>
          <template #menuHeader>
            <p class="text-tertiary-neutral px-4 pt-1 pb-2 text-xs font-medium uppercase">
              {{ t('profiles.create_profile_from') }}
            </p>
          </template>
        </NeDropdown>
      </div>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('profiles.filter_profiles')"
          :aria-label="t('profiles.filter_profiles')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="w-full max-w-xs"
        />
        <NeButton kind="tertiary" :disabled="textFilter === ''" @click="textFilter = ''">
          {{ t('common.reset_filters') }}
        </NeButton>
      </div>
      <ul v-if="loading" :class="CARDS_GRID_CLASSES">
        <li
          v-for="index in DEFAULT_PROFILE_IDS.length"
          :key="index"
          class="bg-elevation-0 flex min-w-0 flex-col gap-3 rounded-lg border-l-4 border-gray-300 p-5 shadow-xs dark:border-gray-600"
        >
          <NeSkeleton :lines="2" />
        </li>
      </ul>
      <NeEmptyState
        v-else-if="profiles.length === 0"
        :title="t('profiles.no_profiles_configured')"
        :icon="faUserGear"
        class="bg-elevation-2"
      />
      <NeEmptyState
        v-else-if="filteredProfiles.length === 0"
        :title="t('profiles.no_profiles_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
        class="bg-elevation-2"
      >
        <NeButton kind="tertiary" @click="textFilter = ''">
          {{ t('common.reset_filters') }}
        </NeButton>
      </NeEmptyState>
      <ul v-else :class="CARDS_GRID_CLASSES">
        <li
          v-for="profile in filteredProfiles"
          :key="profile.id"
          :data-profile="profile.id"
          class="bg-elevation-0 flex min-w-0 flex-col gap-3 rounded-lg p-5 shadow-xs"
          :class="
            isDefaultProfile(profile) ? 'border-l-4 border-gray-300 dark:border-gray-600' : ''
          "
        >
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-primary-neutral flex min-w-0 items-center gap-2 text-base font-medium">
              <FontAwesomeIcon
                :icon="getProfileIcon(profile)"
                class="size-4 shrink-0"
                aria-hidden="true"
              />
              <span class="truncate" :title="profile.name">
                {{
                  isDefaultProfile(profile)
                    ? t('profiles.default_profile_name', { name: profile.name })
                    : profile.name
                }}
              </span>
            </h4>
            <div class="flex shrink-0 items-center gap-1">
              <NeButton kind="tertiary" size="sm" @click="showEditDrawer(profile)">
                <template #prefix>
                  <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                </template>
                {{ t('common.edit') }}
                <span class="sr-only">{{ profile.name }}</span>
              </NeButton>
              <NeTooltip
                v-if="isDefaultProfile(profile)"
                trigger-event="mouseenter focus"
                placement="top"
              >
                <template #trigger>
                  <NeButton kind="tertiary" size="sm" @click="showCreateDrawer(profile)">
                    <FontAwesomeIcon :icon="faClone" class="size-4" aria-hidden="true" />
                    <span class="sr-only">
                      {{ t('profiles.duplicate_profile', { name: profile.name }) }}
                    </span>
                  </NeButton>
                </template>
                <template #content>{{
                  t('profiles.duplicate_profile', { name: profile.name })
                }}</template>
              </NeTooltip>
              <NeDropdown
                v-else
                :items="getKebabMenuItems(profile)"
                :align-to-right="true"
                :open-menu-aria-label="t('profiles.profile_actions', { name: profile.name })"
              />
            </div>
          </div>
          <p class="text-primary-700 dark:text-primary-500">
            {{ t('profiles.users_assigned', usersCount(profile)) }}
          </p>
        </li>
      </ul>
    </template>
    <CreateOrEditProfileDrawer
      :is-shown="isShownDrawer"
      :mode="drawerMode"
      :profiles="profiles"
      :users="users"
      :subscription-active="subscriptionState.data === true"
      @close="isShownDrawer = false"
    />
    <DeleteProfileModal
      :visible="isShownDeleteModal"
      :profile="profileToDelete"
      :users="users"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
