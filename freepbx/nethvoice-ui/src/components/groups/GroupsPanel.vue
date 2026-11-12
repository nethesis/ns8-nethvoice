<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCirclePlus,
  faMagnifyingGlass,
  faPenToSquare,
  faTrash,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import {
  NeButton,
  NeDropdown,
  NeEmptyState,
  NePaginator,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  NeTooltip,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditGroupDrawer from '@/components/groups/CreateOrEditGroupDrawer.vue'
import DeleteGroupModal from '@/components/groups/DeleteGroupModal.vue'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate } from '@/lib/common'
import {
  filterGroups,
  getGroupUsernames,
  MAX_GROUP_USERS_SHOWN,
  type Group,
} from '@/lib/groups/groups'
import { useGroups } from '@/queries/groups/groups'
import { useUsers } from '@/queries/users/users'

const { t } = useI18n()
const { state: groupsState, refetch: refetchGroups } = useGroups()
const { state: usersState, refetch: refetchUsers } = useUsers()

const textFilter = ref('')
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const currentGroup = ref<Group | undefined>()
const isShownCreateOrEditGroupDrawer = ref(false)
const isShownDeleteGroupModal = ref(false)

const loading = computed(
  () => groupsState.value.status === 'pending' || usersState.value.status === 'pending',
)

const loadError = computed(() => groupsState.value.error ?? usersState.value.error)

const groups = computed(() => groupsState.value.data ?? [])

const users = computed(() => usersState.value.data ?? [])

const filteredGroups = computed(() => filterGroups(groups.value, users.value, textFilter.value))

const groupsPage = computed(() => paginate(filteredGroups.value, pageNum.value, pageSize.value))

const isNoDataEmptyStateShown = computed(
  () => !loading.value && !loadError.value && groups.value.length === 0,
)

const isNoMatchEmptyStateShown = computed(
  () =>
    !loading.value &&
    !loadError.value &&
    groups.value.length > 0 &&
    filteredGroups.value.length === 0,
)

watch([textFilter, pageSize], () => {
  pageNum.value = 1
})

watch(filteredGroups, () => {
  const lastPage = Math.max(1, Math.ceil(filteredGroups.value.length / pageSize.value))

  if (pageNum.value > lastPage) {
    pageNum.value = lastPage
  }
})

function getUsernames(group: Group) {
  return getGroupUsernames(group, users.value)
}

function showCreateGroupDrawer() {
  currentGroup.value = undefined
  isShownCreateOrEditGroupDrawer.value = true
}

function showEditGroupDrawer(group: Group) {
  currentGroup.value = group
  isShownCreateOrEditGroupDrawer.value = true
}

function showDeleteGroupModal(group: Group) {
  currentGroup.value = group
  isShownDeleteGroupModal.value = true
}

function getKebabMenuItems(group: Group): NeDropdownItem[] {
  return [
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => showDeleteGroupModal(group),
    },
  ]
}

function reload() {
  refetchGroups()
  refetchUsers()
}
</script>

<template>
  <div>
    <LoadError v-if="loadError" :error="loadError" @retry="reload" />
    <NeEmptyState
      v-else-if="isNoDataEmptyStateShown"
      :title="t('groups.no_groups_configured')"
      :description="`${t('groups.description_line_1')} ${t('groups.description_line_2')}`"
      :icon="faUsers"
      class="bg-elevation-2"
    >
      <NeButton kind="primary" @click="showCreateGroupDrawer">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('groups.create_group') }}
      </NeButton>
    </NeEmptyState>
    <template v-else>
      <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
        <p class="text-secondary-neutral max-w-[608px]">
          {{ t('groups.description_line_1') }}<br />{{ t('groups.description_line_2') }}
        </p>
        <NeButton
          kind="primary"
          class="shrink-0"
          :disabled="loading"
          @click="showCreateGroupDrawer"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('groups.create_group') }}
        </NeButton>
      </div>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('groups.filter_groups')"
          :aria-label="t('groups.filter_groups')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="w-full max-w-[300px]"
        />
        <NeButton kind="tertiary" @click="textFilter = ''">
          {{ t('groups.clear_filters') }}
        </NeButton>
      </div>
      <NeEmptyState
        v-if="isNoMatchEmptyStateShown"
        :title="t('groups.no_groups_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
        class="bg-elevation-2"
      >
        <NeButton kind="tertiary" @click="textFilter = ''">
          {{ t('groups.clear_filters') }}
        </NeButton>
      </NeEmptyState>
      <NeTable
        v-else
        :aria-label="t('users.tab_groups')"
        card-breakpoint="md"
        :loading="loading"
        :skeleton-columns="3"
        :skeleton-rows="7"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('groups.group') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('groups.users') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="group in groupsPage" :key="group.id">
            <NeTableCell :data-label="t('groups.group')">
              <span class="wrap-anywhere">{{ group.name }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('groups.users')">
              <span v-if="getUsernames(group).length === 0">-</span>
              <span v-else class="wrap-anywhere">
                {{ getUsernames(group).slice(0, MAX_GROUP_USERS_SHOWN).join(', ') }}
                <NeTooltip
                  v-if="getUsernames(group).length > MAX_GROUP_USERS_SHOWN"
                  class="ml-1 inline-block"
                >
                  <template #trigger>
                    <span class="text-tertiary-neutral cursor-default whitespace-nowrap">
                      {{
                        t('common.plus_n_more', {
                          count: getUsernames(group).length - MAX_GROUP_USERS_SHOWN,
                        })
                      }}
                    </span>
                  </template>
                  <template #content>
                    {{ getUsernames(group).slice(MAX_GROUP_USERS_SHOWN).join(', ') }}
                  </template>
                </NeTooltip>
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-1 md:ml-0 md:justify-end">
                <NeButton kind="tertiary" @click="showEditGroupDrawer(group)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                </NeButton>
                <NeDropdown
                  :items="getKebabMenuItems(group)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('ne_dropdown.open_menu')"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template #paginator>
          <NePaginator
            :current-page="pageNum"
            :total-rows="filteredGroups.length"
            :page-size="pageSize"
            :page-sizes="PAGE_SIZES"
            :nav-pagination-label="t('ne_table.pagination')"
            :next-label="t('ne_table.go_to_next_page')"
            :previous-label="t('ne_table.go_to_previous_page')"
            :range-of-total-label="t('ne_table.of')"
            :page-size-label="t('ne_table.show')"
            @select-page="(page: number) => (pageNum = page)"
            @select-page-size="(size: number) => (pageSize = size)"
          />
        </template>
      </NeTable>
    </template>
    <CreateOrEditGroupDrawer
      :is-shown="isShownCreateOrEditGroupDrawer"
      :current-group="currentGroup"
      :groups="groups"
      :users="users"
      @close="isShownCreateOrEditGroupDrawer = false"
    />
    <DeleteGroupModal
      :visible="isShownDeleteGroupModal"
      :group="currentGroup"
      @close="isShownDeleteGroupModal = false"
    />
  </div>
</template>
