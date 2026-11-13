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
  NeInlineNotification,
  NePaginator,
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
  faCircleDown,
  faCirclePlus,
  faEthernet,
  faEye,
  faMagnifyingGlass,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import GatewayDrawer from './GatewayDrawer.vue'
import DeleteGatewayModal from './DeleteGatewayModal.vue'
import TrunkStatusIndicator from './TrunkStatusIndicator.vue'
import TrunksUpdatingIndicator from './TrunksUpdatingIndicator.vue'
import {
  filterGateways,
  formatMacAddress,
  getGatewayConfigFile,
  getGatewayConfigFileName,
  getGatewayLabel,
  getGatewayModelDescription,
  getGatewayStatus,
  type Gateway,
} from '@/lib/trunks/gateways'
import { TRUNKS_LIVE_STATE_REFRESH_INTERVAL } from '@/lib/trunks/liveState'
import { PAGE_SIZES } from '@/lib/common'
import { useGatewayModels, useGateways } from '@/queries/trunks/gateways'
import { useTrunks, useTrunksLiveState } from '@/queries/trunks/trunks'
import { useClientPagination } from '@/composables/useClientPagination'
import { usePolling } from '@/composables/usePolling'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { variant = 'admin' } = defineProps<{ variant?: 'admin' | 'setup' }>()

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const {
  state: gatewaysState,
  asyncStatus: gatewaysAsyncStatus,
  refetch: refetchGateways,
} = useGateways()
const { state: modelsState, refetch: refetchModels } = useGatewayModels()
const { state: trunksState } = useTrunks()
const {
  state: liveState,
  asyncStatus: liveAsyncStatus,
  refetch: refetchLiveState,
} = useTrunksLiveState()

const textFilter = ref('')
const currentGateway = ref<Gateway | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)
const downloadingId = ref<number | undefined>()

const loadError = computed(() => gatewaysState.value.error)

const isLoading = computed(
  () => gatewaysState.value.status === 'pending' || modelsState.value.status === 'pending',
)

const isLoaded = computed(() => !isLoading.value && !loadError.value)

const gateways = computed(() => gatewaysState.value.data ?? [])

usePolling(
  () => refetchLiveState(),
  TRUNKS_LIVE_STATE_REFRESH_INTERVAL,
  () => gateways.value.length > 0,
)

const models = computed(() => modelsState.value.data ?? [])

const existingMacAddresses = computed(() => gateways.value.map((gateway) => gateway.macAddress))

const filteredGateways = computed(() =>
  filterGateways(gateways.value, textFilter.value, models.value),
)

const { pageNum, pageSize, page } = useClientPagination(filteredGateways)

const liveData = computed(() =>
  liveState.value.status === 'error' ? undefined : liveState.value.data,
)

const isNoDataEmptyStateShown = computed(() => isLoaded.value && gateways.value.length === 0)

const emptyStateDescription = computed(() =>
  variant === 'admin'
    ? `${t('trunks.physical.empty_description_line_1')} ${t('trunks.physical.empty_description_line_2')}`
    : t('trunks.physical.no_trunks_setup_description'),
)

const isNoMatchEmptyStateShown = computed(
  () => isLoaded.value && gateways.value.length > 0 && filteredGateways.value.length === 0,
)

const isTableShown = computed(
  () => isLoading.value || (isLoaded.value && filteredGateways.value.length > 0),
)

const isUpdating = computed(
  () =>
    isLoaded.value &&
    gateways.value.length > 0 &&
    (gatewaysAsyncStatus.value === 'loading' || liveAsyncStatus.value === 'loading'),
)

const currentLabel = computed(() =>
  currentGateway.value ? getGatewayLabel(currentGateway.value, models.value) : '',
)

watch(textFilter, () => {
  pageNum.value = 1
})

function retry() {
  refetchGateways()
  refetchModels()
}

function showCreateDrawer() {
  currentGateway.value = undefined
  isShownDrawer.value = true
}

function showDetailsDrawer(gateway: Gateway) {
  currentGateway.value = gateway
  isShownDrawer.value = true
}

function showDeleteModal(gateway: Gateway) {
  currentGateway.value = gateway
  isShownDeleteModal.value = true
}

async function downloadConfiguration(gateway: Gateway) {
  downloadingId.value = gateway.id

  try {
    const file = await getGatewayConfigFile(gateway)
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = getGatewayConfigFileName(gateway)
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    notificationsStore.createNotificationFromError(
      error,
      t('trunks.physical.cannot_download_configuration'),
    )
  } finally {
    downloadingId.value = undefined
  }
}

function getKebabMenuItems(gateway: Gateway): NeDropdownItem[] {
  return [
    {
      id: 'showTrunk',
      label: t('trunks.physical.show_configuration'),
      icon: faEye,
      action: () => showDetailsDrawer(gateway),
    },
    {
      id: 'deleteTrunk',
      label: t('trunks.delete_trunk'),
      icon: faTrash,
      danger: true,
      action: () => showDeleteModal(gateway),
    },
  ]
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      v-if="variant === 'admin' && !isNoDataEmptyStateShown"
      class="flex flex-col items-start justify-between gap-4 sm:flex-row"
    >
      <div class="text-secondary-neutral max-w-2xl">
        <p>{{ t('trunks.physical.description_line_1') }}</p>
        <p>{{ t('trunks.physical.description_line_2') }}</p>
      </div>
      <NeButton kind="primary" class="shrink-0" @click="showCreateDrawer">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('trunks.physical.add_physical_trunk') }}
      </NeButton>
    </div>
    <div
      v-if="!isNoDataEmptyStateShown && !loadError"
      class="flex flex-wrap items-center justify-between gap-4"
    >
      <div class="flex flex-wrap items-center gap-4">
        <NeTextInput
          v-model="textFilter"
          is-search
          :placeholder="t('trunks.filter_trunks')"
          :aria-label="t('trunks.filter_trunks')"
          :clear-search-label="t('ne_text_input.clear_search')"
          class="w-full max-w-xs"
          @blur="textFilter = textFilter.trim()"
        />
        <NeButton
          v-if="variant === 'admin'"
          kind="tertiary"
          :disabled="!textFilter"
          @click="textFilter = ''"
        >
          {{ t('common.reset_filters') }}
        </NeButton>
      </div>
      <div class="flex items-center gap-4">
        <TrunksUpdatingIndicator v-if="isUpdating" />
        <NeButton v-if="variant === 'setup'" kind="secondary" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ t('trunks.physical.add_physical_trunk') }}
        </NeButton>
      </div>
    </div>
    <LoadError
      v-if="loadError"
      :error="loadError"
      :title="t('trunks.physical.cannot_load_trunks')"
      @retry="retry"
    />
    <NeInlineNotification
      v-if="isLoaded && modelsState.status === 'error'"
      kind="warning"
      :title="t('trunks.physical.cannot_load_models')"
      :description="describeError(modelsState.error)"
      :primary-button-label="t('common.retry')"
      @primary-click="refetchModels()"
    />
    <NeEmptyState
      v-if="isNoDataEmptyStateShown"
      :title="t('trunks.physical.no_trunks')"
      :description="emptyStateDescription"
      :icon="faEthernet"
      class="elevation-0"
    >
      <div class="flex justify-center">
        <NeButton :kind="variant === 'admin' ? 'primary' : 'secondary'" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ t('trunks.physical.add_physical_trunk') }}
        </NeButton>
      </div>
    </NeEmptyState>
    <NeEmptyState
      v-else-if="isNoMatchEmptyStateShown"
      :title="t('trunks.no_trunks_found')"
      :description="t('common.try_changing_search_filters')"
      :icon="faMagnifyingGlass"
      class="elevation-0"
    >
      <NeButton kind="tertiary" @click="textFilter = ''">{{ t('common.reset_filters') }}</NeButton>
    </NeEmptyState>
    <NeTable
      v-if="isTableShown"
      :aria-label="t('trunks.tab_physical')"
      card-breakpoint="lg"
      :loading="isLoading"
      :skeleton-columns="5"
      :skeleton-rows="3"
    >
      <NeTableHead>
        <NeTableHeadCell>{{ t('trunks.trunk') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('trunks.physical.ip_address_column') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('trunks.physical.mac_column') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('common.status') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="sr-only">{{ t('common.actions') }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="item in page" :key="item.id">
          <NeTableCell :data-label="t('trunks.trunk')">
            <div class="flex flex-col">
              <span>{{ item.manufacturer || '-' }}</span>
              <span class="wrap-anywhere">
                {{ getGatewayModelDescription(item, models) || item.name }}
              </span>
            </div>
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.physical.ip_address_column')">
            {{ item.ipAddress || '-' }}
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.physical.mac_column')">
            {{ formatMacAddress(item.macAddress) || '-' }}
          </NeTableCell>
          <NeTableCell :data-label="t('common.status')">
            <TrunkStatusIndicator :status="getGatewayStatus(item, trunksState.data, liveData)" />
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
              <NeButton
                kind="tertiary"
                :loading="downloadingId === item.id"
                :disabled="downloadingId === item.id"
                @click="downloadConfiguration(item)"
              >
                <template #prefix>
                  <FontAwesomeIcon :icon="faCircleDown" class="h-4 w-4" aria-hidden="true" />
                </template>
                {{ t('trunks.physical.download') }}
                <span class="sr-only">{{ getGatewayLabel(item, models) }}</span>
              </NeButton>
              <NeDropdown
                :items="getKebabMenuItems(item)"
                :align-to-right="true"
                :open-menu-aria-label="
                  t('trunks.open_trunk_menu', { name: getGatewayLabel(item, models) })
                "
              />
            </div>
          </NeTableCell>
        </NeTableRow>
      </NeTableBody>
      <template v-if="filteredGateways.length > PAGE_SIZES[0]" #paginator>
        <NePaginator
          :current-page="pageNum"
          :total-rows="filteredGateways.length"
          :page-size="pageSize"
          :page-sizes="PAGE_SIZES"
          :nav-pagination-label="t('ne_table.pagination')"
          :next-label="t('ne_table.go_to_next_page')"
          :previous-label="t('ne_table.go_to_previous_page')"
          :range-of-total-label="t('ne_table.of')"
          :page-size-label="t('ne_table.show')"
          @select-page="(value: number) => (pageNum = value)"
          @select-page-size="(value: number) => (pageSize = value)"
        />
      </template>
    </NeTable>
    <GatewayDrawer
      :is-shown="isShownDrawer"
      :gateway="currentGateway"
      :label="currentLabel"
      :existing-mac-addresses="existingMacAddresses"
      @close="isShownDrawer = false"
      @download="downloadConfiguration"
    />
    <DeleteGatewayModal
      :visible="isShownDeleteModal"
      :gateway="currentGateway"
      :label="currentLabel"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
