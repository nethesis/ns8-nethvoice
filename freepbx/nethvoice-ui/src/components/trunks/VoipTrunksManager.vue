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
  NeInlineNotification,
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
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCirclePlus,
  faLock,
  faMagnifyingGlass,
  faNetworkWired,
  faPenToSquare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditVoipTrunkDrawer from './CreateOrEditVoipTrunkDrawer.vue'
import DeleteVoipTrunkModal from './DeleteVoipTrunkModal.vue'
import TrunkStatusIndicator from './TrunkStatusIndicator.vue'
import TrunksUpdatingIndicator from './TrunksUpdatingIndicator.vue'
import {
  filterVoipTrunks,
  getTrunkManagement,
  getVoipTrunks,
  type Trunk,
} from '@/lib/trunks/trunks'
import { getCodecLabel, getProviderName } from '@/lib/trunks/providers'
import { getGatewayTrunkIds } from '@/lib/trunks/gateways'
import {
  getTrunkProviderStatus,
  getTrunkRegistrationStatus,
  TRUNKS_LIVE_STATE_REFRESH_INTERVAL,
} from '@/lib/trunks/liveState'
import { PAGE_SIZES } from '@/lib/common'
import { useTrunkProviders, useTrunks, useTrunksLiveState } from '@/queries/trunks/trunks'
import { useGateways } from '@/queries/trunks/gateways'
import { useClientPagination } from '@/composables/useClientPagination'
import { usePolling } from '@/composables/usePolling'
import { describeError } from '@/stores/notifications'

const { variant = 'admin' } = defineProps<{ variant?: 'admin' | 'setup' }>()

const { t } = useI18n()
const { state: trunksState, asyncStatus: trunksAsyncStatus, refetch: refetchTrunks } = useTrunks()
const { state: gatewaysState, refetch: refetchGateways } = useGateways()
const { state: providersState } = useTrunkProviders()
const {
  state: liveState,
  asyncStatus: liveAsyncStatus,
  refetch: refetchLiveState,
} = useTrunksLiveState()

usePolling(() => refetchLiveState(), TRUNKS_LIVE_STATE_REFRESH_INTERVAL)

const textFilter = ref('')
const currentTrunk = ref<Trunk | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const loadError = computed(() => trunksState.value.error)

const isLoading = computed(
  () => trunksState.value.status === 'pending' || gatewaysState.value.status === 'pending',
)

const voipTrunks = computed(() =>
  getVoipTrunks(
    trunksState.value.data ?? [],
    gatewaysState.value.data ? getGatewayTrunkIds(gatewaysState.value.data) : undefined,
  ),
)

const existingNames = computed(() => (trunksState.value.data ?? []).map((trunk) => trunk.name))

const filteredTrunks = computed(() =>
  filterVoipTrunks(voipTrunks.value, textFilter.value, getProviderLabel, getCodecLabel),
)

const { pageNum, pageSize, page } = useClientPagination(filteredTrunks)

const liveData = computed(() =>
  liveState.value.status === 'error' ? undefined : liveState.value.data,
)

const isLoaded = computed(() => !isLoading.value && !loadError.value)

const isNoDataEmptyStateShown = computed(() => isLoaded.value && voipTrunks.value.length === 0)

const emptyStateDescription = computed(() =>
  variant === 'admin'
    ? `${t('trunks.voip.empty_description_line_1')} ${t('trunks.voip.empty_description_line_2')}`
    : t('trunks.voip.no_trunks_setup_description'),
)

const isNoMatchEmptyStateShown = computed(
  () => isLoaded.value && voipTrunks.value.length > 0 && filteredTrunks.value.length === 0,
)

const isTableShown = computed(
  () => isLoading.value || (isLoaded.value && filteredTrunks.value.length > 0),
)

const isUpdating = computed(
  () =>
    isLoaded.value &&
    (trunksAsyncStatus.value === 'loading' || liveAsyncStatus.value === 'loading'),
)

watch(textFilter, () => {
  pageNum.value = 1
})

function getProviderLabel(trunk: Trunk): string {
  switch (getTrunkManagement(trunk)) {
    case 'voice_agents':
      return t('trunks.voip.ai_agents')
    case 'other_technology':
      return trunk.technology.toUpperCase()
    default:
      return getProviderName(trunk, providersState.value.data ?? []) || trunk.sipServer
  }
}

function getReadOnlyReason(trunk: Trunk): string {
  return getTrunkManagement(trunk) === 'voice_agents'
    ? t('trunks.voip.ai_agents_read_only')
    : t('trunks.voip.other_technology_read_only', {
        technology: trunk.technology.toUpperCase(),
      })
}

function getCodecsLabel(trunk: Trunk): string {
  return trunk.codecs.map(getCodecLabel).join(', ')
}

function retry() {
  refetchTrunks()
  refetchGateways()
}

function showCreateDrawer() {
  currentTrunk.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(trunk: Trunk) {
  currentTrunk.value = trunk
  isShownDrawer.value = true
}

function showDeleteModal(trunk: Trunk) {
  currentTrunk.value = trunk
  isShownDeleteModal.value = true
}

function getKebabMenuItems(trunk: Trunk): NeDropdownItem[] {
  return [
    {
      id: 'deleteTrunk',
      label: t('trunks.delete_trunk'),
      icon: faTrash,
      danger: true,
      action: () => showDeleteModal(trunk),
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
        <p>{{ t('trunks.voip.description_line_1') }}</p>
        <p>{{ t('trunks.voip.description_line_2') }}</p>
      </div>
      <NeButton kind="primary" class="shrink-0" @click="showCreateDrawer">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('trunks.voip.add_voip_trunk') }}
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
          {{ t('trunks.voip.add_voip_trunk') }}
        </NeButton>
      </div>
    </div>
    <LoadError
      v-if="loadError"
      :error="loadError"
      :title="t('trunks.voip.cannot_load_trunks')"
      @retry="retry"
    />
    <NeInlineNotification
      v-if="isLoaded && voipTrunks.length > 0 && liveState.status === 'error'"
      kind="warning"
      :title="t('trunks.cannot_load_live_status')"
      :description="describeError(liveState.error)"
    />
    <NeInlineNotification
      v-if="isLoaded && gatewaysState.status === 'error'"
      kind="warning"
      :title="t('trunks.voip.cannot_load_gateways')"
      :description="describeError(gatewaysState.error)"
      :primary-button-label="t('common.retry')"
      @primary-click="refetchGateways()"
    />
    <NeEmptyState
      v-if="isNoDataEmptyStateShown"
      :title="t('trunks.voip.no_trunks')"
      :description="emptyStateDescription"
      :icon="faNetworkWired"
      class="elevation-0"
    >
      <div class="flex justify-center">
        <NeButton :kind="variant === 'admin' ? 'primary' : 'secondary'" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
          </template>
          {{ t('trunks.voip.add_voip_trunk') }}
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
      :aria-label="t('trunks.tab_voip')"
      card-breakpoint="xl"
      :loading="isLoading"
      :skeleton-columns="6"
      :skeleton-rows="3"
    >
      <NeTableHead>
        <NeTableHeadCell>{{ t('trunks.trunk') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('trunks.voip.provider') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="whitespace-nowrap">{{ t('trunks.voip.phone_number') }}</span>
        </NeTableHeadCell>
        <NeTableHeadCell>{{ t('trunks.voip.codecs') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('trunks.voip.provider_status') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('trunks.voip.sip_registration') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="sr-only">{{ t('common.actions') }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="item in page" :key="item.id">
          <NeTableCell :data-label="t('trunks.trunk')">
            <div class="flex flex-wrap items-center gap-2">
              <span class="wrap-anywhere">{{ item.name }}</span>
              <NeBadgeV2 v-if="item.disabled" kind="gray" size="xs">
                {{ t('common.disabled') }}
              </NeBadgeV2>
            </div>
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.voip.provider')">
            <span class="break-words">{{ getProviderLabel(item) || '-' }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.voip.phone_number')">
            <span class="break-words">{{ item.phoneNumber || '-' }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.voip.codecs')">
            {{ getCodecsLabel(item) || '-' }}
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.voip.provider_status')">
            <TrunkStatusIndicator :status="getTrunkProviderStatus(item.name, liveData)" />
          </NeTableCell>
          <NeTableCell :data-label="t('trunks.voip.sip_registration')">
            <TrunkStatusIndicator :status="getTrunkRegistrationStatus(item.name, liveData)" />
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div v-if="getTrunkManagement(item) !== 'editable'" class="flex xl:justify-end">
              <NeTooltip>
                <template #trigger>
                  <span
                    tabindex="0"
                    class="text-secondary-neutral flex items-center gap-2 rounded-sm"
                  >
                    <FontAwesomeIcon :icon="faLock" class="size-4" aria-hidden="true" />
                    {{ t('trunks.voip.read_only') }}
                    <span class="sr-only">{{ getReadOnlyReason(item) }}</span>
                  </span>
                </template>
                <template #content>{{ getReadOnlyReason(item) }}</template>
              </NeTooltip>
            </div>
            <div v-else class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
              <NeButton kind="tertiary" @click="showEditDrawer(item)">
                <template #prefix>
                  <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
                </template>
                {{ t('common.edit') }}
                <span class="sr-only">{{ item.name }}</span>
              </NeButton>
              <NeDropdown
                :items="getKebabMenuItems(item)"
                :align-to-right="true"
                :open-menu-aria-label="t('trunks.open_trunk_menu', { name: item.name })"
              />
            </div>
          </NeTableCell>
        </NeTableRow>
      </NeTableBody>
      <template v-if="filteredTrunks.length > PAGE_SIZES[0]" #paginator>
        <NePaginator
          :current-page="pageNum"
          :total-rows="filteredTrunks.length"
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
    <CreateOrEditVoipTrunkDrawer
      :is-shown="isShownDrawer"
      :trunk="currentTrunk"
      :existing-names="existingNames"
      @close="isShownDrawer = false"
    />
    <DeleteVoipTrunkModal
      :visible="isShownDeleteModal"
      :trunk="currentTrunk"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
