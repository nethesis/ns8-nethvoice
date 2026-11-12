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
  NeEmptyState,
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
  faCirclePlus,
  faMagnifyingGlass,
  faPenToSquare,
  faTrash,
  faVideo,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditVideoSourceDrawer from './CreateOrEditVideoSourceDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { matchesText, PAGE_SIZES } from '@/lib/common'
import { getProfileNames } from '@/lib/integrations/lookups'
import {
  deleteVideoSource,
  VIDEO_SOURCES_KEY,
  type VideoSource,
} from '@/lib/integrations/videoSources'
import { useExtensionOptions, useProfileOptions } from '@/queries/integrations/lookups'
import { useVideoSources } from '@/queries/integrations/videoSources'

const { t } = useI18n()
const { state, refetch } = useVideoSources()
const { state: profilesState } = useProfileOptions()
const { state: extensionsState } = useExtensionOptions()

const textFilter = ref('')
const currentSource = ref<VideoSource | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const sources = computed(() => state.value.data ?? [])
const profiles = computed(() => profilesState.value.data ?? [])

const filteredSources = computed(() =>
  sources.value.filter((source) =>
    matchesText(textFilter.value, source.name, source.url, source.extension),
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

function describeExtension(extension: string): string {
  if (!extension) {
    return '-'
  }
  const name = extensionsState.value.data?.find((item) => item.extension === extension)?.name
  return name ? `${extension} - ${name}` : extension
}

function showCreateDrawer() {
  currentSource.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(source: VideoSource) {
  currentSource.value = source
  isShownDrawer.value = true
}

function getKebabMenuItems(source: VideoSource): NeDropdownItem[] {
  return [
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => {
        currentSource.value = source
        isShownDeleteModal.value = true
      },
    },
  ]
}

function deleteCurrentSource() {
  return currentSource.value ? deleteVideoSource(currentSource.value.name) : Promise.resolve()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <p class="text-secondary-neutral max-w-2xl">
        {{ t('integrations.video.description') }}
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
        {{ t('integrations.video.create_source') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <div v-if="!isNoDataEmptyStateShown" class="flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('integrations.video.filter_sources')"
          :aria-label="t('integrations.video.filter_sources')"
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
        :title="t('integrations.video.cannot_load_sources')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-if="isNoDataEmptyStateShown"
        :title="t('integrations.video.no_sources')"
        :description="t('integrations.video.no_sources_description')"
        :icon="faVideo"
        class="elevation-0"
      >
        <NeButton kind="primary" size="lg" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ t('integrations.video.create_source') }}
        </NeButton>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="isNoMatchEmptyStateShown"
        :title="t('integrations.video.no_sources_found')"
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
        :aria-label="t('integrations.tab_video_sources')"
        card-breakpoint="lg"
        :loading="state.status === 'pending'"
        :skeleton-columns="5"
        :skeleton-rows="5"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.url') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.video.extension') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.profiles') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="source in sourcesPage" :key="source.name">
            <NeTableCell :data-label="t('integrations.name')">
              <div class="flex flex-col">
                <span class="wrap-anywhere">{{ source.name }}</span>
                <span v-if="source.openCode" class="text-tertiary-neutral text-sm">
                  {{ t('integrations.video.open_code_value', { code: source.openCode }) }}
                </span>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.url')">
              <span class="wrap-anywhere">{{ source.url }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.video.extension')">
              {{ describeExtension(source.extension) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.profiles')">
              <span class="wrap-anywhere">
                {{ getProfileNames(source.profileIds, profiles).join(', ') || '-' }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
                <NeButton kind="tertiary" @click="showEditDrawer(source)">
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
    <CreateOrEditVideoSourceDrawer
      :is-shown="isShownDrawer"
      :current-source="currentSource"
      :sources="sources"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.video.delete_source')"
      :object-name="currentSource?.name ?? ''"
      :confirmation-message="
        t('integrations.video.delete_source_confirmation', { name: currentSource?.name ?? '' })
      "
      :success-title="t('integrations.video.source_deleted')"
      :error-title="t('integrations.video.cannot_delete_source')"
      :delete-object="deleteCurrentSource"
      :invalidate-keys="[VIDEO_SOURCES_KEY]"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
