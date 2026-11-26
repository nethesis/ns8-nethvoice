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
  NeDropdownFilterV2,
  NeEmptyState,
  NeInlineNotification,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextInput,
  NeTooltip,
  type NeDropdownFilterV2Option,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowRightArrowLeft,
  faCirclePlus,
  faEye,
  faMagnifyingGlass,
  faPenToSquare,
  faTrash,
  faTriangleExclamation,
  faVideo,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditVideoSourceDrawer from './CreateOrEditVideoSourceDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import PhonebookUpdating from './PhonebookUpdating.vue'
import VideoSourceDoorPhonesModal from './VideoSourceDoorPhonesModal.vue'
import VideoSourcePreviewModal from './VideoSourcePreviewModal.vue'
import VideoSourceStatusLabel from './VideoSourceStatusLabel.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { useUpdatingIndicator } from '@/composables/useUpdatingIndicator'
import { matchesText, PAGE_SIZES } from '@/lib/common'
import { getProfileNames } from '@/lib/integrations/lookups'
import {
  defaultProfileIds,
  deleteVideoSource,
  describeExtension,
  getFailureKey,
  VIDEO_DOOR_PHONES_KEY,
  VIDEO_SOURCES_KEY,
  type DoorContext,
  type DoorPhonePrefill,
  type VideoSource,
  type VideoSourceCheck,
  type VideoSourceStatus,
} from '@/lib/integrations/videoSources'
import { useExtensionOptions, useProfileOptions } from '@/queries/integrations/lookups'
import {
  useDoorPhones,
  useVideoSourceChecks,
  useVideoSources,
} from '@/queries/integrations/videoSources'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const STATUS_FILTER_IDS: VideoSourceStatus[] = ['connected', 'notConnected']

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const runtimeConfigStore = useRuntimeConfigStore()
const { state, asyncStatus, refetch } = useVideoSources()
const { state: profilesState } = useProfileOptions()
const { state: extensionsState } = useExtensionOptions()
const { state: doorPhonesState } = useDoorPhones()

const textFilter = ref('')
const profileFilter = ref<NeDropdownFilterV2Option[]>([])
const statusFilter = ref<NeDropdownFilterV2Option[]>([])
const currentSource = ref<VideoSource | undefined>()
const prefill = ref<DoorPhonePrefill | undefined>()
const prefillProfileIds = ref<string[]>([])
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)
const isShownDoorPhonesModal = ref(false)
const isShownPreviewModal = ref(false)

const cti = computed(() => runtimeConfigStore.config.ctiProductName)
const sources = computed(() => state.value.data ?? [])
const profiles = computed(() => profilesState.value.data ?? [])
const extensions = computed(() => extensionsState.value.data ?? [])
const doorPhones = computed(() => doorPhonesState.value.data ?? [])

const checks = useVideoSourceChecks(
  () => sources.value,
  () => state.value.data !== undefined,
)

const filtersApplied = computed(
  () =>
    textFilter.value.trim() !== '' ||
    profileFilter.value.length > 0 ||
    statusFilter.value.length > 0,
)

const filteredSources = computed(() => {
  const profileIds = profileFilter.value.map((option) => option.id)
  const statuses = statusFilter.value.map((option) => option.id)

  return sources.value.filter(
    (source) =>
      matchesText(
        textFilter.value,
        source.name,
        describeExtension(source.extension, extensions.value),
        describeGates(source),
        ...getProfileNames(source.profileIds, profiles.value),
      ) &&
      (profileIds.length === 0 || source.profileIds.some((id) => profileIds.includes(id))) &&
      (statuses.length === 0 || statuses.includes(checks.statusOf(source.name))),
  )
})

const { pageNum, pageSize, page: sourcesPage } = useClientPagination(filteredSources)

watch([textFilter, profileFilter, statusFilter], () => {
  pageNum.value = 1
})

const profileFilterOptions = computed<NeDropdownFilterV2Option[]>(() =>
  profiles.value.map((profile) => ({ id: profile.id, label: profile.name })),
)

const statusFilterOptions = computed<NeDropdownFilterV2Option[]>(() =>
  STATUS_FILTER_IDS.map((id) => ({
    id,
    label:
      id === 'connected'
        ? t('integrations.video.connected')
        : t('integrations.video.not_connected'),
  })),
)

const isLoading = computed(
  () => state.value.status === 'pending' || profilesState.value.status === 'pending',
)

const isUpdatingShown = useUpdatingIndicator(
  () => state.value.data !== undefined && asyncStatus.value === 'loading',
)

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
  () => isLoading.value || (state.value.data !== undefined && filteredSources.value.length > 0),
)

const statusFilterPending = computed(
  () => statusFilter.value.length > 0 && checks.testingCount.value > 0,
)

const doorPhonesUnavailable = computed(() => {
  if (doorPhonesState.value.status !== 'success') {
    return ''
  }
  if (doorPhones.value.length === 0) {
    return t('integrations.video.no_door_phones_tooltip')
  }
  return doorPhones.value.every((phone) => phone.sources.length > 0)
    ? t('integrations.video.all_door_phones_used')
    : ''
})

const doorContext = computed<DoorContext | null>(() => {
  if (prefill.value) {
    return {
      streams: prefill.value.streams,
      relays: prefill.value.relays,
      maxGates: prefill.value.maxGates,
    }
  }
  const mac = currentSource.value?.doorPhone

  if (!mac) {
    return null
  }
  const phone = doorPhones.value.find((item) => item.mac === mac)
  return phone ? { streams: phone.streams, relays: phone.relays, maxGates: phone.maxGates } : null
})

const drawerProfileIds = computed(() =>
  prefill.value ? prefillProfileIds.value : defaultProfileIds(profiles.value),
)

function resetFilters() {
  textFilter.value = ''
  profileFilter.value = []
  statusFilter.value = []
}

function describeGates(source: VideoSource): string {
  return source.gates.map((gate) => gate.name).join(', ')
}

function hasCertificateChanged(source: VideoSource): boolean {
  return checks.checkOf(source.name)?.warnings.includes('tls_certificate_changed') ?? false
}

function showCreateDrawer() {
  currentSource.value = undefined
  prefill.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(source: VideoSource) {
  currentSource.value = source
  prefill.value = undefined
  isShownDrawer.value = true
}

function useDoorPhone(doorPhonePrefill: DoorPhonePrefill, profileIds: string[]) {
  isShownDoorPhonesModal.value = false
  currentSource.value = undefined
  prefill.value = doorPhonePrefill
  prefillProfileIds.value = profileIds
  isShownDrawer.value = true
}

function onSaved(name: string, check: VideoSourceCheck | null) {
  if (currentSource.value && currentSource.value.name !== name) {
    checks.forget(currentSource.value.name)
  }
  if (check?.success) {
    checks.seed(name, check)
  } else {
    checks.forget(name)
  }
}

async function testSource(source: VideoSource) {
  const check = await checks.retest(source.name)

  if (!check) {
    return
  }
  if (check.success) {
    notificationsStore.createNotification({
      kind: 'success',
      title: t('integrations.video.connection_verified'),
      description: t('integrations.video.connected_description', { name: source.name }),
    })
  } else {
    notificationsStore.createNotification({
      kind: 'error',
      title: t('integrations.video.cannot_connect_name', { name: source.name }),
      description: t(getFailureKey(check)),
    })
  }
}

function showPreview(source: VideoSource) {
  currentSource.value = source
  isShownPreviewModal.value = true

  if (checks.statusOf(source.name) !== 'testing') {
    void checks.retest(source.name)
  }
}

function getKebabMenuItems(source: VideoSource): NeDropdownItem[] {
  const testing = checks.statusOf(source.name) === 'testing'

  return [
    {
      id: 'preview',
      label: t('integrations.video.preview'),
      icon: faEye,
      action: () => showPreview(source),
    },
    {
      id: 'test',
      label: t('integrations.video.test_connection'),
      icon: faArrowRightArrowLeft,
      disabled: testing,
      action: () => void testSource(source),
    },
    { id: 'divider' },
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

async function deleteCurrentSource() {
  if (currentSource.value) {
    await deleteVideoSource(currentSource.value.name)
    checks.forget(currentSource.value.name)
  }
}
</script>

<template>
  <div>
    <div
      v-if="!isNoDataEmptyStateShown"
      class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <p class="text-tertiary-neutral max-w-2xl">
        {{ t('integrations.video.description', { cti }) }}
      </p>
      <div class="mt-2 flex flex-wrap gap-4 sm:mt-0">
        <NeTooltip
          v-if="doorPhonesUnavailable"
          trigger-event="mouseenter focus"
          placement="top"
          tabindex="0"
          data-testid="door-phone-unavailable"
          class="focus:ring-primary-500 dark:focus:ring-primary-300 dark:focus:ring-offset-primary-950 inline-flex rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:outline-hidden"
        >
          <template #trigger>
            <NeButton kind="secondary" size="lg" disabled>
              {{ t('integrations.video.create_from_door_phone') }}
            </NeButton>
          </template>
          <template #content>{{ doorPhonesUnavailable }}</template>
        </NeTooltip>
        <NeButton
          v-else
          kind="secondary"
          size="lg"
          :disabled="state.status !== 'success' || doorPhonesState.status === 'pending'"
          @click="isShownDoorPhonesModal = true"
        >
          {{ t('integrations.video.create_from_door_phone') }}
        </NeButton>
        <NeButton
          kind="primary"
          size="lg"
          :disabled="state.status !== 'success'"
          @click="showCreateDrawer"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('integrations.video.create_source') }}
        </NeButton>
      </div>
    </div>
    <div class="flex flex-col gap-6">
      <div v-if="!isNoDataEmptyStateShown && state.data !== undefined" class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-4">
          <NeTextInput
            v-model="textFilter"
            is-search
            :placeholder="t('integrations.video.filter_sources')"
            :aria-label="t('integrations.video.filter_sources')"
            :clear-search-label="t('ne_text_input.clear_search')"
            class="w-full max-w-xs"
            @blur="textFilter = textFilter.trim()"
          />
          <NeDropdownFilterV2
            v-model="profileFilter"
            kind="checkbox"
            :label="t('integrations.video.profile')"
            :options="profileFilterOptions"
            :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
            :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
            :no-options-label="t('ne_dropdown_filter.no_options')"
            :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
            :clear-search-label="t('ne_dropdown_filter.clear_search')"
          />
          <NeDropdownFilterV2
            v-model="statusFilter"
            kind="checkbox"
            :label="t('common.status')"
            :options="statusFilterOptions"
            :clear-filter-label="t('ne_dropdown_filter.clear_selection')"
            :open-menu-aria-label="t('ne_dropdown_filter.open_filter')"
            :no-options-label="t('ne_dropdown_filter.no_options')"
            :more-options-hidden-label="t('ne_dropdown_filter.more_options_hidden')"
            :clear-search-label="t('ne_dropdown_filter.clear_search')"
          />
          <NeButton kind="tertiary" :disabled="!filtersApplied" @click="resetFilters">
            {{ t('common.reset_filters') }}
          </NeButton>
          <PhonebookUpdating v-if="isUpdatingShown" />
        </div>
        <p v-if="statusFilterPending" role="status" class="text-tertiary-neutral text-sm">
          {{
            t(
              'integrations.video.status_filter_pending',
              { count: checks.testingCount.value },
              checks.testingCount.value,
            )
          }}
        </p>
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
        :description="t('integrations.video.no_sources_description', { cti })"
        :icon="faVideo"
        class="elevation-0"
      >
        <div class="flex flex-col items-center gap-2">
          <NeButton kind="primary" size="lg" @click="showCreateDrawer">
            <template #prefix>
              <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
            </template>
            {{ t('integrations.video.create_source') }}
          </NeButton>
          <NeTooltip
            v-if="doorPhonesUnavailable"
            trigger-event="mouseenter focus"
            placement="top"
            tabindex="0"
            class="focus:ring-primary-500 dark:focus:ring-primary-300 dark:focus:ring-offset-primary-950 inline-flex rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:outline-hidden"
          >
            <template #trigger>
              <NeButton kind="tertiary" size="lg" disabled>
                {{ t('integrations.video.create_from_door_phone') }}
              </NeButton>
            </template>
            <template #content>{{ doorPhonesUnavailable }}</template>
          </NeTooltip>
          <NeButton
            v-else
            kind="tertiary"
            size="lg"
            :disabled="doorPhonesState.status === 'pending'"
            @click="isShownDoorPhonesModal = true"
          >
            {{ t('integrations.video.create_from_door_phone') }}
          </NeButton>
        </div>
      </NeEmptyState>
      <NeEmptyState
        v-else-if="isNoMatchEmptyStateShown"
        :title="t('integrations.video.no_sources_found')"
        :description="t('common.try_changing_search_filters')"
        :icon="faMagnifyingGlass"
        class="elevation-0"
      >
        <NeButton kind="tertiary" @click="resetFilters">
          {{ t('common.reset_filters') }}
        </NeButton>
      </NeEmptyState>
      <NeInlineNotification
        v-if="isTableShown && profilesState.status === 'error'"
        kind="warning"
        :title="t('integrations.cannot_load_profiles')"
        :description="describeError(profilesState.error)"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.tab_video_sources')"
        card-breakpoint="xl"
        :loading="isLoading"
        :skeleton-columns="6"
        :skeleton-rows="5"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.video.extension') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.video.gates') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.profiles') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('common.status') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="source in sourcesPage" :key="source.name">
            <NeTableCell :data-label="t('integrations.name')">
              <div class="flex flex-col gap-1">
                <span class="wrap-break-word">{{ source.name }}</span>
                <NeTooltip
                  v-if="source.tlsUnpinned || hasCertificateChanged(source)"
                  trigger-event="mouseenter focus"
                >
                  <template #trigger>
                    <button
                      type="button"
                      class="focus:ring-primary-500 dark:focus:ring-primary-300 flex items-center gap-1.5 rounded-sm text-sm text-amber-700 focus:ring-2 focus:outline-hidden dark:text-amber-500"
                    >
                      <FontAwesomeIcon
                        :icon="faTriangleExclamation"
                        class="size-3.5"
                        aria-hidden="true"
                      />
                      {{
                        hasCertificateChanged(source)
                          ? t('integrations.video.certificate_changed')
                          : t('integrations.video.certificate_not_pinned')
                      }}
                    </button>
                  </template>
                  <template #content>
                    {{
                      hasCertificateChanged(source)
                        ? t('integrations.video.certificate_changed_tooltip')
                        : t('integrations.video.certificate_not_pinned_tooltip')
                    }}
                  </template>
                </NeTooltip>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.video.extension')">
              <span class="wrap-break-word">
                {{ describeExtension(source.extension, extensions) }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.video.gates')">
              <span class="wrap-break-word">{{ describeGates(source) || '-' }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.profiles')">
              <span class="wrap-break-word">
                {{ getProfileNames(source.profileIds, profiles).join(', ') || '-' }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.status')">
              <VideoSourceStatusLabel :status="checks.statusOf(source.name)" />
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton kind="tertiary" @click="showEditDrawer(source)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
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
      :prefill="prefill"
      :default-profile-ids="drawerProfileIds"
      :door-context="doorContext"
      :stored-check="currentSource ? checks.checkOf(currentSource.name) : null"
      @saved="onSaved"
      @close="isShownDrawer = false"
    />
    <VideoSourceDoorPhonesModal
      :visible="isShownDoorPhonesModal"
      :profiles="profiles"
      @use="useDoorPhone"
      @close="isShownDoorPhonesModal = false"
    />
    <VideoSourcePreviewModal
      :visible="isShownPreviewModal"
      :name="currentSource?.name ?? ''"
      :status="currentSource ? checks.statusOf(currentSource.name) : 'testing'"
      :check="currentSource ? checks.checkOf(currentSource.name) : null"
      @close="isShownPreviewModal = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.video.delete_source')"
      :object-name="currentSource?.name ?? ''"
      :confirmation-message="
        t('integrations.video.delete_source_confirmation', {
          cti,
          name: currentSource?.name ?? '',
        })
      "
      :success-title="t('integrations.video.source_deleted')"
      success-description-key="integrations.video.source_deleted_description"
      :error-title="t('integrations.video.cannot_delete_source')"
      :delete-object="deleteCurrentSource"
      :invalidate-keys="[VIDEO_SOURCES_KEY, VIDEO_DOOR_PHONES_KEY]"
      @close="isShownDeleteModal = false"
    />
  </div>
</template>
