<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeDropdownFilterV2,
  NeEmptyState,
  NePaginator,
  NeSortDropdown,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  type NeDropdownFilterV2Option,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowRight,
  faCirclePlus,
  faClone,
  faMagnifyingGlass,
  faPenToSquare,
  faRotateLeft,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateModelDrawer from './CreateModelDrawer.vue'
import DeleteModelModal from './DeleteModelModal.vue'
import ResetModelModal from './ResetModelModal.vue'
import PhoneModelDetail from './PhoneModelDetail.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { compareNatural, matchesText, PAGE_SIZES } from '@/lib/common'
import { buildModelRows, type PhoneModel, type PhoneModelRow } from '@/lib/phones/models'
import { usePhoneModels } from '@/queries/phones/models'
import { useTancrediPhones } from '@/queries/phones/phones'

const SORT_KEYS = ['displayName', 'brand', 'phones'] as const

type SortKey = (typeof SORT_KEYS)[number]

const DEFAULT_SORT_KEY: SortKey = 'displayName'

const { t } = useI18n()
const router = useRouter()
const { state: modelsState, refetch: refetchModels } = usePhoneModels()
const { state: phonesState, refetch: refetchPhones } = useTancrediPhones()

const textFilter = ref('')
const brandFilter = ref<NeDropdownFilterV2Option[]>([])
const typeFilter = ref<NeDropdownFilterV2Option[]>([])
const sortKey = ref<string | undefined>(DEFAULT_SORT_KEY)
const sortDescending = ref(false)
const currentModel = ref<PhoneModelRow | undefined>()
const isShownCreateDrawer = ref(false)
const isDuplicating = ref(false)
const isShownResetModal = ref(false)
const isShownDeleteModal = ref(false)

const selectedModelName = ref('')

const loading = computed(
  () => modelsState.value.status === 'pending' || phonesState.value.status === 'pending',
)

const loadError = computed(() => modelsState.value.error ?? phonesState.value.error)

const allModels = computed(() => modelsState.value.data ?? [])

const rows = computed(() =>
  buildModelRows(
    allModels.value,
    (phonesState.value.data ?? []).map((phone) => phone.model),
  ),
)

const brandOptions = computed<NeDropdownFilterV2Option[]>(() =>
  [...new Set(rows.value.map((row) => row.brand))]
    .sort(compareNatural)
    .map((brand) => ({ id: brand, label: brand })),
)

const typeOptions = computed<NeDropdownFilterV2Option[]>(() => [
  { id: 'default', label: t('phones.models.type_default') },
  { id: 'custom', label: t('phones.models.type_custom') },
])

const sortOptions = computed(() => [
  { id: 'displayName', label: t('phones.model') },
  { id: 'brand', label: t('phones.models.brand') },
  { id: 'phones', label: t('phones.models.phones') },
])

const filteredRows = computed(() => {
  const brands = brandFilter.value.map((option) => option.id)
  const types = typeFilter.value.map((option) => option.id)
  const key = SORT_KEYS.find((item) => item === sortKey.value) ?? DEFAULT_SORT_KEY
  const direction = sortDescending.value ? -1 : 1

  return rows.value
    .filter(
      (row) =>
        (brands.length === 0 || brands.includes(row.brand)) &&
        (types.length === 0 || types.includes(row.custom ? 'custom' : 'default')) &&
        matchesText(textFilter.value, row.displayName, row.name, row.brand),
    )
    .sort((a, b) => {
      const result =
        key === 'phones' ? a.phones - b.phones : compareNatural(String(a[key]), String(b[key]))
      return (result || compareNatural(a.displayName, b.displayName)) * direction
    })
})

const { pageNum, pageSize, page } = useClientPagination(filteredRows)

watch([textFilter, brandFilter, typeFilter, sortKey, sortDescending], () => {
  pageNum.value = 1
})

const areFiltersApplied = computed(
  () =>
    textFilter.value.trim() !== '' ||
    brandFilter.value.length > 0 ||
    typeFilter.value.length > 0 ||
    sortKey.value !== DEFAULT_SORT_KEY ||
    sortDescending.value,
)

const isEmptyStateShown = computed(
  () => !loading.value && !loadError.value && rows.value.length === 0,
)

const isNoMatchShown = computed(
  () => !loading.value && rows.value.length > 0 && filteredRows.value.length === 0,
)

const filterLabels = computed(() => ({
  clearFilterLabel: t('ne_dropdown_filter.clear_selection'),
  openMenuAriaLabel: t('ne_dropdown_filter.open_filter'),
  noOptionsLabel: t('ne_dropdown_filter.no_options'),
  moreOptionsHiddenLabel: t('ne_dropdown_filter.more_options_hidden'),
  clearSearchLabel: t('ne_dropdown_filter.clear_search'),
  optionsFilterPlaceholder: t('ne_dropdown_filter.options_filter_placeholder'),
}))

function getRowMenuItems(row: PhoneModelRow): NeDropdownItem[] {
  const items: NeDropdownItem[] = [
    {
      id: 'duplicate',
      label: t('phones.models.duplicate'),
      icon: faClone,
      action: () => showCreateDrawer(row),
    },
  ]

  if (!row.custom) {
    items.push({
      id: 'reset',
      label: t('phones.models.reset_to_original_settings'),
      icon: faRotateLeft,
      action: () => showResetModal(row),
    })
  } else {
    items.push({
      id: 'delete',
      label: row.phones > 0 ? t('phones.models.delete_model_in_use') : t('common.delete'),
      icon: faTrash,
      danger: true,
      disabled: row.phones > 0,
      action: () => showDeleteModal(row),
    })
  }
  return items
}

function resetFilters() {
  textFilter.value = ''
  brandFilter.value = []
  typeFilter.value = []
  sortKey.value = DEFAULT_SORT_KEY
  sortDescending.value = false
}

function retry() {
  refetchModels()
  refetchPhones()
}

function openModel(name: string) {
  selectedModelName.value = name
}

function closeModel() {
  selectedModelName.value = ''
}

function showCreateDrawer(duplicateOf?: PhoneModelRow) {
  currentModel.value = duplicateOf
  isDuplicating.value = duplicateOf !== undefined
  isShownCreateDrawer.value = true
}

function showResetModal(row: PhoneModelRow) {
  currentModel.value = row
  isShownResetModal.value = true
}

function showDeleteModal(row: PhoneModelRow) {
  currentModel.value = row
  isShownDeleteModal.value = true
}

function goToPhones() {
  router.push({ name: 'phones', params: { tab: 'phones' } })
}

function onModelCreated(model: PhoneModel) {
  if (!isDuplicating.value) {
    openModel(model.name)
  }
}
</script>

<template>
  <PhoneModelDetail v-if="selectedModelName" :model-name="selectedModelName" @back="closeModel" />
  <div v-else>
    <LoadError
      v-if="loadError"
      :error="loadError"
      :title="$t('phones.models.cannot_load_models')"
      class="mb-6"
      @retry="retry"
    />
    <NeEmptyState
      v-if="isEmptyStateShown"
      :title="$t('phones.models.no_models')"
      :description="$t('phones.models.no_models_description')"
      :icon="faOfficePhone"
    >
      <NeButton kind="primary" @click="goToPhones">
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowRight" class="size-4" aria-hidden="true" />
        </template>
        {{ $t('phones.models.go_to_phones') }}
      </NeButton>
    </NeEmptyState>
    <template v-else-if="!loadError">
      <div class="mb-6 flex flex-col gap-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <p class="text-secondary-neutral max-w-2xl">{{ $t('phones.models.description') }}</p>
          <NeButton kind="primary" :disabled="loading" @click="showCreateDrawer()">
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
            </template>
            {{ $t('phones.models.add_model') }}
          </NeButton>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <NeTextInput
            v-model="textFilter"
            is-search
            :placeholder="$t('phones.models.filter_models')"
            :aria-label="$t('phones.models.filter_models')"
            :clear-search-label="$t('ne_text_input.clear_search')"
            class="w-full max-w-xs"
          />
          <NeDropdownFilterV2
            v-model="brandFilter"
            kind="checkbox"
            :label="$t('phones.models.brand')"
            :options="brandOptions"
            v-bind="filterLabels"
          />
          <NeDropdownFilterV2
            v-model="typeFilter"
            kind="checkbox"
            :label="$t('phones.models.type')"
            :options="typeOptions"
            v-bind="filterLabels"
          />
          <NeSortDropdown
            v-model:sort-key="sortKey"
            v-model:sort-descending="sortDescending"
            :label="$t('sort.sort_by')"
            :options="sortOptions"
            :open-menu-aria-label="$t('ne_dropdown.open_menu')"
            :sort-by-label="$t('sort.sort_by')"
            :sort-direction-label="$t('sort.direction')"
            :ascending-label="$t('sort.ascending')"
            :descending-label="$t('sort.descending')"
          />
          <NeButton kind="tertiary" :disabled="!areFiltersApplied" @click="resetFilters">
            {{ $t('common.reset_filters') }}
          </NeButton>
        </div>
      </div>
      <NeEmptyState
        v-if="isNoMatchShown"
        :title="$t('phones.models.no_models_found')"
        :description="$t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
      >
        <NeButton kind="tertiary" @click="resetFilters">{{ $t('common.reset_filters') }}</NeButton>
      </NeEmptyState>
      <NeTable
        v-else
        :aria-label="$t('phones.models.models_table')"
        card-breakpoint="xl"
        :loading="loading"
        :skeleton-columns="5"
        :skeleton-rows="5"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ $t('phones.model') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.models.brand') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.models.phones') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ $t('phones.models.type') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ $t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="row in page" :key="row.name">
            <NeTableCell :data-label="$t('phones.model')">
              <div class="flex items-center gap-2">
                <FontAwesomeIcon
                  :icon="faOfficePhone"
                  class="text-tertiary-neutral size-4"
                  aria-hidden="true"
                />
                {{ row.displayName }}
              </div>
            </NeTableCell>
            <NeTableCell :data-label="$t('phones.models.brand')">{{ row.brand }}</NeTableCell>
            <NeTableCell :data-label="$t('phones.models.phones')">{{ row.phones }}</NeTableCell>
            <NeTableCell :data-label="$t('phones.models.type')">
              <NeBadgeV2 :kind="row.custom ? 'indigo' : 'gray'" size="xs">
                {{
                  row.custom ? $t('phones.models.type_custom') : $t('phones.models.type_default')
                }}
              </NeBadgeV2>
            </NeTableCell>
            <NeTableCell :data-label="$t('common.actions')">
              <div class="-ml-2.5 flex items-center gap-2 xl:ml-0 xl:justify-end">
                <NeButton kind="tertiary" @click="openModel(row.name)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ $t('common.edit') }}
                  <span class="sr-only">{{ row.displayName }}</span>
                </NeButton>
                <NeDropdown
                  :items="getRowMenuItems(row)"
                  align-to-right
                  :open-menu-aria-label="
                    $t('phones.models.open_model_menu', { name: row.displayName })
                  "
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template #paginator>
          <NePaginator
            :current-page="pageNum"
            :total-rows="filteredRows.length"
            :page-size="pageSize"
            :page-sizes="PAGE_SIZES"
            :nav-pagination-label="$t('ne_table.pagination')"
            :next-label="$t('ne_table.go_to_next_page')"
            :previous-label="$t('ne_table.go_to_previous_page')"
            :range-of-total-label="$t('ne_table.of')"
            :page-size-label="$t('ne_table.show')"
            @select-page="(selected: number) => (pageNum = selected)"
            @select-page-size="(size: number) => (pageSize = size)"
          />
        </template>
      </NeTable>
    </template>
    <CreateModelDrawer
      :is-shown="isShownCreateDrawer"
      :base-models="rows"
      :all-models="allModels"
      :duplicate-of="isDuplicating ? currentModel : undefined"
      @close="isShownCreateDrawer = false"
      @created="onModelCreated"
    />
    <ResetModelModal
      :visible="isShownResetModal"
      :model="currentModel"
      @close="isShownResetModal = false"
    />
    <DeleteModelModal
      :visible="isShownDeleteModal"
      :model="currentModel"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
