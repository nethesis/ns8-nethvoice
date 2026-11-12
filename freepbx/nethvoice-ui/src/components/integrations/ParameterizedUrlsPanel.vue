<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeBadgeV2,
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
  faLink,
  faMagnifyingGlass,
  faPenToSquare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditParameterizedUrlDrawer from './CreateOrEditParameterizedUrlDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { matchesText, PAGE_SIZES } from '@/lib/common'
import { getProfileNames } from '@/lib/integrations/lookups'
import {
  deleteParameterizedUrl,
  PARAMETERIZED_URLS_KEY,
  type ParameterizedUrl,
} from '@/lib/integrations/parameterizedUrls'
import { useProfileOptions } from '@/queries/integrations/lookups'
import { useParameterizedUrls } from '@/queries/integrations/parameterizedUrls'

const { t } = useI18n()
const { state, refetch } = useParameterizedUrls()
const { state: profilesState } = useProfileOptions()

const textFilter = ref('')
const currentUrl = ref<ParameterizedUrl | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const urls = computed(() => state.value.data ?? [])
const profiles = computed(() => profilesState.value.data ?? [])

const filteredUrls = computed(() =>
  urls.value.filter((item) =>
    matchesText(textFilter.value, item.url, ...getProfileNames(item.profileIds, profiles.value)),
  ),
)

const { pageNum, pageSize, page: urlsPage } = useClientPagination(filteredUrls)

const isNoDataEmptyStateShown = computed(
  () => state.value.status === 'success' && urls.value.length === 0,
)

const isNoMatchEmptyStateShown = computed(
  () =>
    state.value.status === 'success' && urls.value.length > 0 && filteredUrls.value.length === 0,
)

const isTableShown = computed(
  () =>
    state.value.status === 'pending' ||
    (state.value.data !== undefined && filteredUrls.value.length > 0),
)

watch(textFilter, () => {
  pageNum.value = 1
})

function showCreateDrawer() {
  currentUrl.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(item: ParameterizedUrl) {
  currentUrl.value = item
  isShownDrawer.value = true
}

function showDeleteModal(item: ParameterizedUrl) {
  currentUrl.value = item
  isShownDeleteModal.value = true
}

function getKebabMenuItems(item: ParameterizedUrl): NeDropdownItem[] {
  return [
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => showDeleteModal(item),
    },
  ]
}

function deleteCurrentUrl() {
  return currentUrl.value ? deleteParameterizedUrl(currentUrl.value) : Promise.resolve()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <p class="text-secondary-neutral max-w-2xl">
        {{ t('integrations.param_urls.description') }}
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
        {{ t('integrations.param_urls.create_url') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <div v-if="!isNoDataEmptyStateShown" class="flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('integrations.param_urls.filter_urls')"
          :aria-label="t('integrations.param_urls.filter_urls')"
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
        :title="t('integrations.param_urls.cannot_load_urls')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-if="isNoDataEmptyStateShown"
        :title="t('integrations.param_urls.no_urls')"
        :description="t('integrations.param_urls.no_urls_description')"
        :icon="faLink"
        class="elevation-0"
      >
        <NeButton kind="primary" size="lg" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ t('integrations.param_urls.create_url') }}
        </NeButton>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="isNoMatchEmptyStateShown"
        :title="t('integrations.param_urls.no_urls_found')"
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
        :aria-label="t('integrations.tab_parameterized_urls')"
        card-breakpoint="lg"
        :loading="state.status === 'pending'"
        :skeleton-columns="4"
        :skeleton-rows="5"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.url') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.profiles') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.param_urls.calls') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="item in urlsPage" :key="item.id">
            <NeTableCell :data-label="t('integrations.url')">
              <span class="wrap-anywhere">{{ item.url }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.profiles')">
              <span class="wrap-anywhere">
                {{ getProfileNames(item.profileIds, profiles).join(', ') || '-' }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.param_urls.calls')">
              <NeBadgeV2 :kind="item.onlyQueues ? 'indigo' : 'gray'" size="xs">
                {{
                  item.onlyQueues
                    ? t('integrations.param_urls.queue_calls_only')
                    : t('integrations.param_urls.all_calls')
                }}
              </NeBadgeV2>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
                <NeButton kind="tertiary" @click="showEditDrawer(item)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ item.url }}</span>
                </NeButton>
                <NeDropdown
                  :items="getKebabMenuItems(item)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('integrations.open_menu_of', { name: item.url })"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="filteredUrls.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="filteredUrls.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditParameterizedUrlDrawer
      :is-shown="isShownDrawer"
      :current-url="currentUrl"
      :urls="urls"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.param_urls.delete_url')"
      :object-name="currentUrl?.url ?? ''"
      :confirmation-message="
        t('integrations.param_urls.delete_url_confirmation', { url: currentUrl?.url ?? '' })
      "
      :success-title="t('integrations.param_urls.url_deleted')"
      :error-title="t('integrations.param_urls.cannot_delete_url')"
      :delete-object="deleteCurrentUrl"
      :invalidate-keys="[PARAMETERIZED_URLS_KEY]"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
