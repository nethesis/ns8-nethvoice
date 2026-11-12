<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeSpinner,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faAddressBook,
  faCircleCheck,
  faCirclePause,
  faCirclePlay,
  faCirclePlus,
  faMagnifyingGlass,
  faPenToSquare,
  faRotate,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditPhonebookSourceDrawer from './CreateOrEditPhonebookSourceDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { matchesText, PAGE_SIZES } from '@/lib/common'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import {
  buildPhonebookSourcePayload,
  deletePhonebookSource,
  PHONEBOOK_SOURCES_KEY,
  type PhonebookSource,
  savePhonebookSource,
  syncPhonebookSource,
  toPhonebookSourceForm,
} from '@/lib/integrations/phonebookSources'
import { usePhonebookSources } from '@/queries/integrations/phonebookSources'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state, refetch } = usePhonebookSources()

const textFilter = ref('')
const currentSource = ref<PhonebookSource | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)
const syncingIds = ref<string[]>([])
const togglingIds = ref<string[]>([])

const sources = computed(() => state.value.data ?? [])

const filteredSources = computed(() =>
  sources.value.filter((source) =>
    matchesText(
      textFilter.value,
      source.name,
      describeKind(source),
      source.host,
      source.database,
      source.url,
      ...source.groups,
    ),
  ),
)

const { pageNum, pageSize, page: sourcesPage } = useClientPagination(filteredSources)

const isNoDataEmptyStateShown = computed(
  () => state.value.status === 'success' && sources.value.length === 0,
)

const isNoMatchEmptyStateShown = computed(
  () =>
    state.value.status === 'success' &&
    sources.value.length > 0 &&
    filteredSources.value.length === 0,
)

const isTableShown = computed(
  () =>
    state.value.status === 'pending' ||
    (state.value.data !== undefined && filteredSources.value.length > 0),
)

watch(textFilter, () => {
  pageNum.value = 1
})

const { mutate: syncMutate } = useMutation({
  mutation: (source: PhonebookSource) => syncPhonebookSource(source.id),
  onMutate(source) {
    syncingIds.value = [...syncingIds.value, source.id]
  },
  onSuccess(_data, source) {
    notificationsStore.createNotification({
      kind: 'success',
      title: t('integrations.phonebook.sync_completed'),
      description: t('integrations.phonebook.sync_completed_description', { name: source.name }),
    })
  },
  onError(error, source) {
    notificationsStore.createNotification({
      kind: 'error',
      title: t('integrations.phonebook.sync_failed', { name: source.name }),
      description: getLegacyStatusMessage(error) || describeError(error),
    })
  },
  onSettled(_data, _error, source) {
    syncingIds.value = syncingIds.value.filter((id) => id !== source.id)
  },
})

const { mutate: toggleMutate } = useMutation({
  mutation: (source: PhonebookSource) =>
    savePhonebookSource(
      buildPhonebookSourcePayload(
        { ...toPhonebookSourceForm(source), enabled: !source.enabled },
        source,
      ),
      source.id,
    ),
  onMutate(source) {
    togglingIds.value = [...togglingIds.value, source.id]
  },
  onSuccess(_data, source) {
    notificationsStore.createNotification({
      kind: 'success',
      title: source.enabled
        ? t('integrations.phonebook.source_disabled')
        : t('integrations.phonebook.source_enabled'),
      description: t('common.object_saved_successfully', { name: source.name }),
    })
  },
  onError(error, source) {
    notificationsStore.createNotification({
      kind: 'error',
      title: t('integrations.phonebook.cannot_save_source_name', { name: source.name }),
      description: getLegacyStatusMessage(error) || describeError(error),
    })
  },
  onSettled(_data, _error, source) {
    togglingIds.value = togglingIds.value.filter((id) => id !== source.id)
    queryCache.invalidateQueries({ key: [PHONEBOOK_SOURCES_KEY] })
  },
})

function describeKind(source: PhonebookSource): string {
  return t(`integrations.phonebook.kind_${source.kind}`)
}

function describeInterval(minutes: number): string {
  return minutes % 60 === 0
    ? t('integrations.phonebook.every_hours', { count: minutes / 60 }, minutes / 60)
    : t('integrations.phonebook.every_minutes', { count: minutes }, minutes)
}

function showCreateDrawer() {
  currentSource.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(source: PhonebookSource) {
  currentSource.value = source
  isShownDrawer.value = true
}

function getKebabMenuItems(source: PhonebookSource): NeDropdownItem[] {
  const busy = syncingIds.value.includes(source.id) || togglingIds.value.includes(source.id)

  return [
    {
      id: 'sync',
      label: t('integrations.phonebook.sync_now'),
      icon: faRotate,
      disabled: busy || !source.enabled || source.kind === 'unknown',
      action: () => syncMutate(source),
    },
    {
      id: 'toggle',
      label: source.enabled ? t('common.disable') : t('common.enable'),
      icon: source.enabled ? faCirclePause : faCirclePlay,
      disabled: busy || source.kind === 'unknown',
      action: () => toggleMutate(source),
    },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      disabled: busy,
      action: () => {
        currentSource.value = source
        isShownDeleteModal.value = true
      },
    },
  ]
}

function deleteCurrentSource() {
  return currentSource.value ? deletePhonebookSource(currentSource.value.id) : Promise.resolve()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <p class="text-secondary-neutral max-w-2xl">
        {{ t('integrations.phonebook.description') }}
      </p>
      <NeButton
        v-if="!isNoDataEmptyStateShown"
        kind="primary"
        size="lg"
        :disabled="state.status !== 'success'"
        @click="showCreateDrawer"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('integrations.phonebook.create_source') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <div v-if="!isNoDataEmptyStateShown" class="flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('integrations.phonebook.filter_sources')"
          :aria-label="t('integrations.phonebook.filter_sources')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="w-full max-w-xs"
          @blur="textFilter = textFilter.trim()"
        />
        <NeButton kind="tertiary" :disabled="!textFilter.trim()" @click="textFilter = ''">
          {{ t('common.reset_filters') }}
        </NeButton>
      </div>
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.phonebook.cannot_load_sources')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-if="isNoDataEmptyStateShown"
        :title="t('integrations.phonebook.no_sources')"
        :description="t('integrations.phonebook.no_sources_description')"
        :icon="faAddressBook"
        class="elevation-0"
      >
        <NeButton kind="primary" size="lg" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ t('integrations.phonebook.create_source') }}
        </NeButton>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="isNoMatchEmptyStateShown"
        :title="t('integrations.phonebook.no_sources_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
        class="elevation-0"
      >
        <NeButton kind="tertiary" @click="textFilter = ''">
          {{ t('common.reset_filters') }}
        </NeButton>
      </NeEmptyState>
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.tab_phonebook')"
        card-breakpoint="xl"
        :loading="state.status === 'pending'"
        :skeleton-columns="6"
        :skeleton-rows="5"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.source_type') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.sharing') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.sync_interval') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('common.status') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="source in sourcesPage" :key="source.id">
            <NeTableCell :data-label="t('integrations.name')">
              <div class="flex flex-col">
                <span class="wrap-anywhere">{{ source.name }}</span>
                <span class="text-tertiary-neutral text-sm wrap-anywhere">
                  {{ source.database || source.url || source.host }}
                </span>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.source_type')">
              {{ describeKind(source) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.sharing')">
              <span v-if="source.groups.length === 0">
                {{ t('integrations.phonebook.sharing_public') }}
              </span>
              <div v-else class="flex flex-wrap gap-1">
                <NeBadgeV2 v-for="group in source.groups" :key="group" kind="gray" size="xs">
                  {{ group }}
                </NeBadgeV2>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.sync_interval')">
              {{ describeInterval(source.interval) }}
            </NeTableCell>
            <NeTableCell :data-label="t('common.status')">
              <div class="flex items-center gap-2">
                <template v-if="syncingIds.includes(source.id)">
                  <NeSpinner size="4" />
                  <span>{{ t('integrations.phonebook.syncing') }}</span>
                </template>
                <template v-else-if="source.enabled">
                  <FontAwesomeIcon
                    :icon="faCircleCheck"
                    class="size-4 text-green-700 dark:text-green-500"
                    aria-hidden="true"
                  />
                  <span>{{ t('common.enabled') }}</span>
                </template>
                <template v-else>
                  <FontAwesomeIcon
                    :icon="faCirclePause"
                    class="text-tertiary-neutral size-4"
                    aria-hidden="true"
                  />
                  <span>{{ t('common.disabled') }}</span>
                </template>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton
                  kind="tertiary"
                  :disabled="source.kind === 'unknown'"
                  @click="showEditDrawer(source)"
                >
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ source.name }}</span>
                </NeButton>
                <NeDropdown
                  :items="getKebabMenuItems(source)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('integrations.open_menu_of', { name: source.name })"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="filteredSources.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="filteredSources.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditPhonebookSourceDrawer
      :is-shown="isShownDrawer"
      :current-source="currentSource"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.phonebook.delete_source')"
      :object-name="currentSource?.name ?? ''"
      :confirmation-message="
        t('integrations.phonebook.delete_source_confirmation', { name: currentSource?.name ?? '' })
      "
      :success-title="t('integrations.phonebook.source_deleted')"
      :error-title="t('integrations.phonebook.cannot_delete_source')"
      :delete-object="deleteCurrentSource"
      :invalidate-keys="[PHONEBOOK_SOURCES_KEY]"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
