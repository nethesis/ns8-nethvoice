<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
  faArrowUpRightFromSquare,
  faEarthEurope,
  faFlag,
  faMagnifyingGlass,
  faMobileScreenButton,
  faPenToSquare,
  faPhone,
  faRoute,
  faStar,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateDefaultOutboundRoutesModal from './CreateDefaultOutboundRoutesModal.vue'
import EditOutboundRouteDrawer from './EditOutboundRouteDrawer.vue'
import { useOutboundRouteLabels } from '@/composables/useOutboundRouteLabels'
import { useOutboundRoutes } from '@/queries/routes/outbound'
import { useTrunkProviders, useTrunks } from '@/queries/trunks/trunks'
import { getTrunkLabelById } from '@/lib/trunks/providers'
import {
  filterOutboundRoutes,
  getOutboundRouteAdvancedUrl,
  OUTBOUND_ROUTE_SORT_KEYS,
  refreshFreepbxSession,
  sortOutboundRoutes,
  type OutboundRoute,
  type OutboundRouteKind,
  type OutboundRouteSortKey,
  type RouteTrunk,
} from '@/lib/routes/outbound'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate } from '@/lib/common'

const DEFAULT_SORT_KEY: OutboundRouteSortKey = 'position'

const ROUTE_ICONS: Record<OutboundRouteKind, IconDefinition> = {
  national: faFlag,
  cellphone: faMobileScreenButton,
  international: faEarthEurope,
  toll: faPhone,
}

const { showFilters = true, busy = false } = defineProps<{
  showFilters?: boolean
  busy?: boolean
}>()

const { t } = useI18n()
const { state, refetch } = useOutboundRoutes()
const { getRouteTitle, getRouteDescription } = useOutboundRouteLabels()
const { state: trunksState } = useTrunks()
const { state: providersState } = useTrunkProviders()

const textFilter = ref('')
const sortKey = ref<string | undefined>(DEFAULT_SORT_KEY)
const sortDescending = ref(false)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const currentRoute = ref<OutboundRoute | undefined>()
const isShownEditRouteDrawer = ref(false)
const isShownCreateDefaultRoutesModal = ref(false)

const sortOptions = computed(() => [
  { id: 'position', label: t('routes.sort_position') },
  { id: 'name', label: t('routes.sort_name') },
])

const routes = computed(() => state.value.data ?? [])

function getTrunkLabel(trunk: RouteTrunk): string {
  return getTrunkLabelById(
    trunk.id,
    trunk.name,
    trunksState.value.data ?? [],
    providersState.value.data ?? [],
  )
}

const loading = computed(() => busy || state.value.status === 'pending')

const filteredRoutes = computed(() => {
  const activeSortKey =
    OUTBOUND_ROUTE_SORT_KEYS.find((key) => key === sortKey.value) ?? DEFAULT_SORT_KEY

  return sortOutboundRoutes(
    filterOutboundRoutes(routes.value, textFilter.value, (route) => [
      getRouteTitle(route),
      getRouteDescription(route),
    ]),
    activeSortKey,
    sortDescending.value,
    getRouteTitle,
  )
})

const routesPage = computed(() => paginate(filteredRoutes.value, pageNum.value, pageSize.value))

const areDefaultFiltersApplied = computed(
  () => !textFilter.value.trim() && sortKey.value === DEFAULT_SORT_KEY && !sortDescending.value,
)

const isNoDataEmptyStateShown = computed(
  () => !loading.value && state.value.status === 'success' && routes.value.length === 0,
)

const isNoMatchEmptyStateShown = computed(
  () =>
    !loading.value &&
    state.value.status === 'success' &&
    routes.value.length > 0 &&
    filteredRoutes.value.length === 0,
)

const isTableShown = computed(
  () => loading.value || (state.value.data !== undefined && filteredRoutes.value.length > 0),
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

onMounted(() => {
  refreshFreepbxSession()
})

function clearFilters() {
  textFilter.value = ''
  sortKey.value = DEFAULT_SORT_KEY
  sortDescending.value = false
}

function showEditRouteDrawer(route: OutboundRoute) {
  currentRoute.value = route
  isShownEditRouteDrawer.value = true
}

function getKebabMenuItems(route: OutboundRoute): NeDropdownItem[] {
  return [
    {
      id: 'routeAdvancedSettings',
      label: t('routes.route_advanced_settings'),
      icon: faArrowUpRightFromSquare,
      action: () => window.open(getOutboundRouteAdvancedUrl(route), '_blank', 'noopener'),
    },
  ]
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="showFilters" class="flex flex-wrap items-center gap-4">
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
      v-if="state.status === 'error' && !busy"
      :error="state.error"
      :title="t('routes.cannot_load_outbound_routes')"
      @retry="refetch()"
    />
    <NeEmptyState
      v-if="isNoDataEmptyStateShown"
      :title="t('routes.no_outbound_routes')"
      :description="t('routes.no_outbound_routes_description')"
      :icon="faRoute"
      class="elevation-0"
    >
      <NeButton kind="primary" size="lg" @click="isShownCreateDefaultRoutesModal = true">
        {{ t('routes.create_default_routes') }}
      </NeButton>
    </NeEmptyState>
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
      :aria-label="t('routes.tab_outbound')"
      card-breakpoint="lg"
      :loading="loading"
      :skeleton-columns="3"
      :skeleton-rows="4"
    >
      <NeTableHead>
        <NeTableHeadCell>{{ t('routes.route') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('routes.trunk_priority') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="sr-only">{{ t('common.actions') }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="item in routesPage" :key="item.id">
          <NeTableCell :data-label="t('routes.route')">
            <div class="flex items-center gap-2">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-gray-50 dark:bg-gray-50 dark:text-gray-900"
              >
                <FontAwesomeIcon
                  :icon="item.kind ? ROUTE_ICONS[item.kind] : faStar"
                  class="h-4 w-4"
                  aria-hidden="true"
                />
              </span>
              <div class="flex min-w-0 flex-col">
                <span class="text-primary-neutral wrap-anywhere">{{ getRouteTitle(item) }}</span>
                <span class="wrap-anywhere">{{ getRouteDescription(item) }}</span>
              </div>
            </div>
          </NeTableCell>
          <NeTableCell :data-label="t('routes.trunk_priority')">
            <ol v-if="item.trunks.length" class="list-inside list-decimal">
              <li v-for="trunk in item.trunks" :key="trunk.id" class="wrap-anywhere">
                {{ getTrunkLabel(trunk) }}
              </li>
            </ol>
            <span v-else>
              <span aria-hidden="true">-</span>
              <span class="sr-only">{{ t('routes.no_trunks') }}</span>
            </span>
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
              <NeButton kind="tertiary" @click="showEditRouteDrawer(item)">
                <template #prefix>
                  <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
                </template>
                {{ t('common.edit') }}
                <span class="sr-only">{{ getRouteTitle(item) }}</span>
              </NeButton>
              <NeDropdown
                :items="getKebabMenuItems(item)"
                :align-to-right="true"
                :open-menu-aria-label="t('routes.open_route_menu', { name: getRouteTitle(item) })"
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
    <EditOutboundRouteDrawer
      :is-shown="isShownEditRouteDrawer"
      :route="currentRoute"
      @close="isShownEditRouteDrawer = false"
    />
    <CreateDefaultOutboundRoutesModal
      :visible="isShownCreateDefaultRoutesModal"
      @close="isShownCreateDefaultRoutesModal = false"
    />
  </div>
</template>
