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
  NePaginator,
  NeSortDropdown,
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
  faMagnifyingGlass,
  faPenToSquare,
  faRoute,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import DeleteInboundRouteModal from './DeleteInboundRouteModal.vue'
import { useInboundRoutes } from '@/queries/routes/inbound'
import {
  filterInboundRoutes,
  getInboundRouteName,
  getVisualPlanRouteUrl,
  INBOUND_ROUTE_SORT_KEYS,
  sortInboundRoutes,
  type InboundRoute,
  type InboundRouteSortKey,
  type RouteDestination,
} from '@/lib/routes/inbound'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate } from '@/lib/common'

const DEFAULT_SORT_KEY: InboundRouteSortKey = 'number'

const { t } = useI18n()
const { state, refetch } = useInboundRoutes()

const textFilter = ref('')
const sortKey = ref<string | undefined>(DEFAULT_SORT_KEY)
const sortDescending = ref(false)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const currentRoute = ref<InboundRoute | undefined>()
const isShownDeleteRouteModal = ref(false)

const sortOptions = computed(() => [
  { id: 'number', label: t('routes.route') },
  { id: 'description', label: t('routes.description') },
  { id: 'destination', label: t('routes.destination') },
])

const routes = computed(() => state.value.data ?? [])

const filteredRoutes = computed(() => {
  const activeSortKey =
    INBOUND_ROUTE_SORT_KEYS.find((key) => key === sortKey.value) ?? DEFAULT_SORT_KEY

  return sortInboundRoutes(
    filterInboundRoutes(routes.value, textFilter.value, describeDestination),
    activeSortKey,
    sortDescending.value,
    describeDestination,
  )
})

const routesPage = computed(() => paginate(filteredRoutes.value, pageNum.value, pageSize.value))

const areDefaultFiltersApplied = computed(
  () => !textFilter.value.trim() && sortKey.value === DEFAULT_SORT_KEY && !sortDescending.value,
)

const isNoDataEmptyStateShown = computed(
  () => state.value.status === 'success' && routes.value.length === 0,
)

const isNoMatchEmptyStateShown = computed(
  () =>
    state.value.status === 'success' &&
    routes.value.length > 0 &&
    filteredRoutes.value.length === 0,
)

const isTableShown = computed(
  () =>
    state.value.status === 'pending' ||
    (state.value.data !== undefined && filteredRoutes.value.length > 0),
)

watch([textFilter, sortKey, sortDescending, pageSize], () => {
  pageNum.value = 1
})

watch(
  () => filteredRoutes.value.length,
  (total) => {
    if ((pageNum.value - 1) * pageSize.value >= total) {
      pageNum.value = Math.max(1, Math.ceil(total / pageSize.value))
    }
  },
)

function describeDestination(destination: RouteDestination): string {
  if (!destination.description) {
    return ''
  }
  const prefix = destination.kind
    ? t(`routes.destination_kind.${destination.kind}`)
    : destination.category

  return prefix ? `${prefix}: ${destination.description}` : destination.description
}

function clearFilters() {
  textFilter.value = ''
  sortKey.value = DEFAULT_SORT_KEY
  sortDescending.value = false
}

function editRoute(route: InboundRoute) {
  window.open(getVisualPlanRouteUrl(route), '_blank', 'noopener')
}

function showDeleteRouteModal(route: InboundRoute) {
  currentRoute.value = route
  isShownDeleteRouteModal.value = true
}

function getKebabMenuItems(route: InboundRoute): NeDropdownItem[] {
  return [
    {
      id: 'deleteRoute',
      label: t('routes.delete_route'),
      icon: faTrash,
      danger: true,
      action: () => showDeleteRouteModal(route),
    },
  ]
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-4">
      <NeTextInput
        v-model="textFilter"
        is-search
        :placeholder="t('routes.filter_routes')"
        :aria-label="t('routes.filter_routes')"
        class="w-full max-w-xs"
        @blur="textFilter = textFilter.trim()"
      />
      <NeSortDropdown
        v-model:sort-key="sortKey"
        v-model:sort-descending="sortDescending"
        :label="t('sort.sort_by')"
        :options="sortOptions"
        :open-menu-aria-label="t('ne_dropdown.open_menu')"
        :sort-by-label="t('sort.sort_by')"
        :sort-direction-label="t('sort.direction')"
        :ascending-label="t('sort.ascending')"
        :descending-label="t('sort.descending')"
      />
      <NeButton kind="tertiary" :disabled="areDefaultFiltersApplied" @click="clearFilters">
        {{ t('routes.clear_filters') }}
      </NeButton>
    </div>
    <LoadError
      v-if="state.status === 'error'"
      :error="state.error"
      :title="t('routes.cannot_load_inbound_routes')"
      @retry="refetch()"
    />
    <NeEmptyState
      v-if="isNoDataEmptyStateShown"
      :title="t('routes.no_inbound_routes')"
      :description="t('routes.no_inbound_routes_description')"
      :icon="faRoute"
      class="elevation-0"
    />
    <NeEmptyState
      v-else-if="isNoMatchEmptyStateShown"
      :title="t('routes.no_routes_found')"
      :description="t('common.try_changing_search_filters')"
      :icon="faMagnifyingGlass"
      class="elevation-0"
    >
      <NeButton kind="tertiary" @click="clearFilters">{{ t('routes.clear_filters') }}</NeButton>
    </NeEmptyState>
    <NeTable
      v-if="isTableShown"
      :aria-label="t('routes.tab_inbound')"
      card-breakpoint="lg"
      :loading="state.status === 'pending'"
      :skeleton-columns="4"
      :skeleton-rows="5"
    >
      <NeTableHead>
        <NeTableHeadCell>{{ t('routes.route') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('routes.description') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('routes.destination') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="sr-only">{{ t('common.actions') }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="item in routesPage" :key="item.id">
          <NeTableCell :data-label="t('routes.route')">
            <span class="wrap-anywhere">{{ getInboundRouteName(item) || '-' }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('routes.description')">
            <span class="wrap-anywhere">{{ item.description || '-' }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('routes.destination')">
            <span class="wrap-anywhere">{{ describeDestination(item.destination) || '-' }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
              <NeButton kind="tertiary" @click="editRoute(item)">
                <template #prefix>
                  <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
                </template>
                {{ t('common.edit') }}
                <span class="sr-only">
                  {{ t('routes.edit_route_in_visual_plan', { name: getInboundRouteName(item) }) }}
                </span>
              </NeButton>
              <NeDropdown
                :items="getKebabMenuItems(item)"
                :align-to-right="true"
                :open-menu-aria-label="
                  t('routes.open_route_menu', { name: getInboundRouteName(item) })
                "
              />
            </div>
          </NeTableCell>
        </NeTableRow>
      </NeTableBody>
      <template v-if="filteredRoutes.length > PAGE_SIZES[0]" #paginator>
        <NePaginator
          :current-page="pageNum"
          :total-rows="filteredRoutes.length"
          :page-size="pageSize"
          :page-sizes="PAGE_SIZES"
          :nav-pagination-label="t('ne_table.pagination')"
          :next-label="t('ne_table.go_to_next_page')"
          :previous-label="t('ne_table.go_to_previous_page')"
          :range-of-total-label="t('ne_table.of')"
          :page-size-label="t('ne_table.show')"
          @select-page="
            (page: number) => {
              pageNum = page
            }
          "
          @select-page-size="
            (size: number) => {
              pageSize = size
            }
          "
        />
      </template>
    </NeTable>
    <DeleteInboundRouteModal
      :visible="isShownDeleteRouteModal"
      :route="currentRoute"
      @close="isShownDeleteRouteModal = false"
    />
  </div>
</template>
