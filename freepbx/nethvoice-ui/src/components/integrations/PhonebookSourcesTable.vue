<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  capitalizeFirst,
  formatDateTimeNoSeconds,
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeHeading,
  NeInlineNotification,
  NeSpinner,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTooltip,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faAddressBook,
  faArrowsRotate,
  faCircleCheck,
  faCircleInfo,
  faCirclePlus,
  faCircleXmark,
  faPenToSquare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditPhonebookSourceDrawer from './CreateOrEditPhonebookSourceDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import PhonebookUpdating from './PhonebookUpdating.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { usePhonebookServerMessage } from '@/composables/usePhonebookServerMessage'
import { usePolling } from '@/composables/usePolling'
import { useUpdatingIndicator } from '@/composables/useUpdatingIndicator'
import { isApiError } from '@/lib/api/errors'
import { PAGE_SIZES } from '@/lib/common'
import {
  deletePhonebookSource,
  getLastSyncDisplay,
  isPbxDatabaseSource,
  type LastSyncDisplay,
  PHONEBOOK_SOURCES_KEY,
  PHONEBOOK_STATUS_KEY,
  PHONEBOOK_STATUS_POLL_INTERVAL,
  PHONEBOOK_STATUS_REFRESH_INTERVAL,
  type PhonebookSource,
  syncPhonebookSource,
} from '@/lib/integrations/phonebookSources'
import {
  usePhonebookSources,
  usePhonebookSyncStatuses,
} from '@/queries/integrations/phonebookSources'
import { usePermissions } from '@/queries/permissions/me'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

type SyncTarget = { id: string; name: string }

const { t, locale } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { isSuperadmin } = usePermissions()
const { translate, describeStatus } = usePhonebookServerMessage()
const { state, asyncStatus, refetch } = usePhonebookSources()
const {
  state: statusState,
  asyncStatus: statusAsyncStatus,
  refetch: refetchStatus,
} = usePhonebookSyncStatuses()

const currentSource = ref<PhonebookSource | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)
const syncingIds = ref<string[]>([])
const now = ref(new Date())

const sources = computed(() => state.value.data ?? [])

const { pageNum, pageSize, page: sourcesPage } = useClientPagination(sources)

const isEmpty = computed(() => state.value.status === 'success' && sources.value.length === 0)

const isTableShown = computed(() => state.value.status === 'pending' || sources.value.length > 0)

const statuses = computed(() => statusState.value.data ?? [])

const isPolling = computed(
  () => syncingIds.value.length > 0 || statuses.value.some((status) => status.status === 'running'),
)

usePolling(
  () => refetchStatus(),
  PHONEBOOK_STATUS_POLL_INTERVAL,
  () => isPolling.value,
)

usePolling(
  () => refetchStatus(),
  PHONEBOOK_STATUS_REFRESH_INTERVAL,
  () => !isPolling.value,
)

const isUpdatingShown = useUpdatingIndicator(
  () =>
    (state.value.status === 'success' && asyncStatus.value === 'loading') ||
    (statusState.value.status !== 'pending' && statusAsyncStatus.value === 'loading'),
)

watch(statuses, () => {
  now.value = new Date()
})

const isSyncFailure = (error: unknown) => isApiError(error) && error.status === 500

const getSyncStatus = (id: string) => statuses.value.find((status) => status.id === id)

const { mutate: syncMutate } = useMutation({
  mutation: (source: SyncTarget) => syncPhonebookSource(source.id),
  onMutate(source) {
    syncingIds.value = [...syncingIds.value, source.id]
    return { previousStatus: JSON.stringify(getSyncStatus(source.id) ?? null) }
  },
  onError(error) {
    if (isSyncFailure(error)) {
      return
    }
    notificationsStore.createNotification({
      kind: 'error',
      title: t('integrations.phonebook.cannot_sync_source'),
      description: describeStatus(error) || describeError(error),
    })
  },
  async onSettled(_data, error, source, context) {
    await queryCache.invalidateQueries({ key: [PHONEBOOK_STATUS_KEY] }).catch(() => undefined)
    syncingIds.value = syncingIds.value.filter((id) => id !== source.id)

    if (isSyncFailure(error)) {
      await reportSyncFailure(source, context?.previousStatus)
    }
  },
})

async function reportSyncFailure(source: SyncTarget, previousStatus: string | undefined) {
  await queryCache.invalidateQueries({ key: [PHONEBOOK_SOURCES_KEY] }).catch(() => undefined)

  if (state.value.status === 'success' && !sources.value.some((item) => item.id === source.id)) {
    notificationsStore.createNotification({
      kind: 'error',
      title: t('integrations.phonebook.cannot_sync_source'),
      description: t('integrations.phonebook.sync_source_removed', { name: source.name }),
    })
    return
  }
  const status = getSyncStatus(source.id)

  if (status?.status === 'failed' && JSON.stringify(status) !== previousStatus) {
    return
  }
  notificationsStore.createNotification({
    kind: 'error',
    title: t('integrations.phonebook.cannot_sync_source'),
    description: t('integrations.phonebook.sync_failed_description', { name: source.name }),
  })
}

function isReadOnly(source: PhonebookSource): boolean {
  return !isSuperadmin.value && isPbxDatabaseSource(source)
}

function describeKind(source: PhonebookSource): string {
  return t(`integrations.phonebook.kind_${source.kind}`)
}

function describeVisibility(source: PhonebookSource): string {
  return source.groups.length > 0 ? source.groups.join(', ') : t('integrations.phonebook.everyone')
}

function getLastSync(source: PhonebookSource): LastSyncDisplay {
  return getLastSyncDisplay(
    statuses.value.find((status) => status.id === source.id),
    syncingIds.value.includes(source.id),
    now.value,
  )
}

function getSyncError(source: PhonebookSource): { message: string; details: string } | undefined {
  const message = statuses.value.find((status) => status.id === source.id)?.message?.trim()

  if (!message) {
    return undefined
  }
  const text = translate(message)

  return text === message
    ? { message: t('integrations.phonebook.sync_error_generic'), details: message }
    : { message: capitalizeFirst(text), details: '' }
}

function describeLastSync(display: LastSyncDisplay): string {
  if (display.state !== 'ok' && display.state !== 'failed') {
    return ''
  }
  const time = new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit' }).format(
    display.at,
  )
  const date = formatDateTimeNoSeconds(display.at, locale.value)

  if (display.state === 'ok') {
    return display.day === 'today'
      ? t('integrations.phonebook.last_sync_today', { time })
      : display.day === 'yesterday'
        ? t('integrations.phonebook.last_sync_yesterday', { time })
        : date
  }
  return display.day === 'today'
    ? t('integrations.phonebook.sync_failed_today', { time })
    : display.day === 'yesterday'
      ? t('integrations.phonebook.sync_failed_yesterday', { time })
      : t('integrations.phonebook.sync_failed_on', { date })
}

function showCreateDrawer() {
  currentSource.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(source: PhonebookSource) {
  currentSource.value = source
  isShownDrawer.value = true
}

function syncSavedSource(id: string, name: string) {
  syncMutate({ id, name })
}

function getKebabMenuItems(source: PhonebookSource): NeDropdownItem[] {
  return [
    {
      id: 'sync',
      label: t('integrations.phonebook.sync_now'),
      icon: faArrowsRotate,
      disabled: syncingIds.value.includes(source.id) || source.kind === 'unknown',
      action: () => syncMutate({ id: source.id, name: source.name }),
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

function deleteCurrentSource() {
  return currentSource.value ? deletePhonebookSource(currentSource.value.id) : Promise.resolve()
}
</script>

<template>
  <section aria-labelledby="phonebook-sources-heading">
    <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <NeHeading id="phonebook-sources-heading" tag="h5">
        {{ t('integrations.phonebook.sources') }}
      </NeHeading>
      <PhonebookUpdating v-if="isUpdatingShown" />
    </div>
    <div v-if="!isEmpty" class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="text-tertiary-neutral max-w-2xl">
        {{
          t('integrations.phonebook.sources_description', {
            cti: runtimeConfigStore.config.ctiProductName,
          })
        }}
      </p>
      <NeButton
        kind="primary"
        size="lg"
        :disabled="state.status !== 'success'"
        class="mt-2 justify-self-start sm:mt-0"
        @click="showCreateDrawer"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('integrations.phonebook.create_source') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.phonebook.cannot_load_sources')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-else-if="isEmpty"
        :title="t('integrations.phonebook.no_sources')"
        :description="
          t('integrations.phonebook.sources_description', {
            cti: runtimeConfigStore.config.ctiProductName,
          })
        "
        :icon="faAddressBook"
        class="elevation-0"
      >
        <NeButton kind="primary" size="lg" @click="showCreateDrawer">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('integrations.phonebook.create_source') }}
        </NeButton>
      </NeEmptyState>
      <NeInlineNotification
        v-if="sources.length > 0 && statusState.status === 'error'"
        kind="warning"
        :title="t('integrations.phonebook.cannot_load_sync_status')"
        :description="describeError(statusState.error)"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.phonebook.sources')"
        card-breakpoint="xl"
        :loading="state.status === 'pending'"
        :skeleton-columns="6"
        :skeleton-rows="4"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.type') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.visible_to') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.sync') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.phonebook.last_sync') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="source in sourcesPage" :key="source.id">
            <NeTableCell :data-label="t('integrations.name')">
              <span class="wrap-break-word">{{ source.name }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.type')">
              {{ describeKind(source) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.visible_to')">
              <span class="wrap-break-word">{{ describeVisibility(source) }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.sync')">
              {{ source.enabled ? t('integrations.phonebook.every_hour') : '-' }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.phonebook.last_sync')">
              <span
                v-if="getLastSync(source).state === 'syncing'"
                role="status"
                class="flex items-center gap-2"
              >
                <NeSpinner size="4" />
                {{ t('integrations.phonebook.syncing') }}
              </span>
              <span v-else-if="getLastSync(source).state === 'ok'" class="flex items-center gap-2">
                <FontAwesomeIcon
                  :icon="faCircleCheck"
                  class="text-icon-enabled size-4 shrink-0"
                  aria-hidden="true"
                />
                {{ describeLastSync(getLastSync(source)) }}
              </span>
              <span
                v-else-if="getLastSync(source).state === 'failed'"
                class="flex items-center gap-2"
              >
                <FontAwesomeIcon
                  :icon="faCircleXmark"
                  class="text-danger size-4 shrink-0"
                  aria-hidden="true"
                />
                {{ describeLastSync(getLastSync(source)) }}
                <NeTooltip v-if="getSyncError(source)" trigger-event="focusin">
                  <template #trigger>
                    <button
                      type="button"
                      @mousedown="($event.currentTarget as HTMLElement).focus()"
                      class="focus:ring-primary-500 dark:focus:ring-primary-300 flex rounded-sm focus:ring-2 focus:outline-hidden"
                      :aria-label="
                        t('integrations.phonebook.show_sync_error', { name: source.name })
                      "
                    >
                      <FontAwesomeIcon
                        :icon="faCircleInfo"
                        class="text-secondary size-4"
                        aria-hidden="true"
                      />
                    </button>
                  </template>
                  <template #content>
                    <p class="wrap-break-word">{{ getSyncError(source)?.message }}</p>
                    <p
                      v-if="getSyncError(source)?.details"
                      class="mt-1 font-mono text-xs wrap-anywhere"
                    >
                      {{ getSyncError(source)?.details }}
                    </p>
                  </template>
                </NeTooltip>
              </span>
              <span v-else>-</span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton
                  v-if="!isReadOnly(source)"
                  kind="tertiary"
                  :disabled="source.kind === 'unknown'"
                  @click="showEditDrawer(source)"
                >
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
        <template v-if="sources.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="sources.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditPhonebookSourceDrawer
      :is-shown="isShownDrawer"
      :current-source="currentSource"
      :sources="sources"
      @close="isShownDrawer = false"
      @saved="syncSavedSource"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.phonebook.delete_source')"
      :object-name="currentSource?.name ?? ''"
      :confirmation-message="
        t('integrations.phonebook.delete_source_confirmation', {
          cti: runtimeConfigStore.config.ctiProductName,
          name: currentSource?.name ?? '',
        })
      "
      :success-title="t('integrations.phonebook.source_deleted')"
      success-description-key="integrations.phonebook.source_deleted_description"
      :error-title="t('integrations.phonebook.cannot_delete_source')"
      :delete-object="deleteCurrentSource"
      :invalidate-keys="[PHONEBOOK_SOURCES_KEY, PHONEBOOK_STATUS_KEY]"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
