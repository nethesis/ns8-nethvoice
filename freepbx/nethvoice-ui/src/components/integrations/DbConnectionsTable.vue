<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeHeading,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeSpinner,
  NeTableRow,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowRightArrowLeft,
  faCircleCheck,
  faCirclePlus,
  faCircleHalfStroke,
  faCircleMinus,
  faCircleXmark,
  faDatabase,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditDbConnectionDrawer from './CreateOrEditDbConnectionDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { PAGE_SIZES } from '@/lib/common'
import { getCardsUsingConnection } from '@/lib/integrations/customerCards'
import {
  DB_CONNECTIONS_KEY,
  type DbConnection,
  deleteDbConnection,
  getDbConnectionTypeLabel,
} from '@/lib/integrations/dbConnections'
import {
  useCustomerCards,
  useDbConnections,
  useDbConnectionStatuses,
  useDbConnectionTypes,
} from '@/queries/integrations/customerCards'
import { usePermissions } from '@/queries/permissions/me'

const { t } = useI18n()
const { state, refetch } = useDbConnections()
const { state: typesState } = useDbConnectionTypes()
const { state: cardsState } = useCustomerCards()
const { getStatus, retest } = useDbConnectionStatuses()
const { isSuperadmin } = usePermissions()

const isReadOnly = (connection: DbConnection) =>
  connection.builtIn || (!isSuperadmin.value && connection.pbxServer)

const currentConnection = ref<DbConnection | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const connections = computed(() => state.value.data ?? [])

const { pageNum, pageSize, page: connectionsPage } = useClientPagination(connections)

const isTableShown = computed(
  () => state.value.status === 'pending' || connections.value.length > 0,
)

function getUsers(connection: DbConnection): string[] {
  return getCardsUsingConnection(cardsState.value.data ?? [], connection.id).map(
    (card) => card.name,
  )
}

function showDrawer(connection?: DbConnection) {
  currentConnection.value = connection
  isShownDrawer.value = true
}

function getKebabMenuItems(connection: DbConnection): NeDropdownItem[] {
  const items: NeDropdownItem[] = [
    {
      id: 'test',
      label: t('integrations.cards.test_connection'),
      icon: faArrowRightArrowLeft,
      disabled: getStatus(connection.id) === 'testing',
      action: () => retest(connection),
    },
  ]

  if (cardsState.value.status === 'success' && !getUsers(connection).length) {
    items.push(
      { id: 'divider' },
      {
        id: 'delete',
        label: t('common.remove'),
        icon: faCircleMinus,
        danger: true,
        action: () => {
          currentConnection.value = connection
          isShownDeleteModal.value = true
        },
      },
    )
  }
  return items
}

function deleteCurrentConnection() {
  return currentConnection.value
    ? deleteDbConnection(currentConnection.value.id)
    : Promise.resolve()
}
</script>

<template>
  <section aria-labelledby="db-connections-heading">
    <NeHeading id="db-connections-heading" tag="h5" class="mb-2">
      {{ t('integrations.cards.connections') }}
    </NeHeading>
    <div class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="text-tertiary-neutral max-w-2xl">
        {{ t('integrations.cards.connections_description') }}
      </p>
      <NeButton
        kind="secondary"
        size="lg"
        :disabled="state.status !== 'success'"
        class="mt-2 justify-self-start sm:mt-0"
        @click="showDrawer()"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_connection') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.cards.cannot_load_connections')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-else-if="state.status === 'success' && connections.length === 0"
        :title="t('integrations.cards.no_connections')"
        :icon="faDatabase"
        class="elevation-0"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.cards.connections')"
        card-breakpoint="xl"
        :loading="state.status === 'pending'"
        :skeleton-columns="7"
        :skeleton-rows="3"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.database_type') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.database_address') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.database_username') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.used_by') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('common.status') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="connection in connectionsPage" :key="connection.id">
            <NeTableCell :data-label="t('integrations.name')">
              <div class="flex flex-wrap items-center gap-2">
                <span class="wrap-break-word">{{ connection.name }}</span>
                <NeBadgeV2 v-if="connection.builtIn" kind="gray" size="xs">
                  {{ t('integrations.cards.built_in') }}
                </NeBadgeV2>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.database_type')">
              {{ getDbConnectionTypeLabel(connection.type, typesState.data ?? []) }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.database_address')">
              <span class="wrap-break-word">{{ connection.host }}:{{ connection.port }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.database_username')">
              <span class="wrap-break-word">{{ connection.user || '-' }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.used_by')">
              <span class="wrap-break-word">
                {{
                  cardsState.status === 'success'
                    ? getUsers(connection).join(', ') || t('integrations.cards.not_used')
                    : '-'
                }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.status')">
              <div
                v-if="getStatus(connection.id) === 'testing'"
                role="status"
                class="flex items-center gap-2"
              >
                <NeSpinner size="4" />
                <span>{{ t('integrations.cards.testing_connection') }}</span>
              </div>
              <div
                v-else-if="getStatus(connection.id) === 'connected'"
                class="flex items-center gap-2"
              >
                <FontAwesomeIcon
                  :icon="faCircleCheck"
                  class="text-icon-enabled size-4"
                  aria-hidden="true"
                />
                <span>{{ t('integrations.cards.connected') }}</span>
              </div>
              <div
                v-else-if="getStatus(connection.id) === 'notConnected'"
                class="flex items-center gap-2"
              >
                <FontAwesomeIcon
                  :icon="faCircleXmark"
                  class="text-danger size-4"
                  aria-hidden="true"
                />
                <span>{{ t('integrations.cards.not_connected') }}</span>
              </div>
              <div
                v-else-if="getStatus(connection.id) === 'unknown'"
                class="flex items-center gap-2"
              >
                <FontAwesomeIcon
                  :icon="faCircleHalfStroke"
                  class="text-icon-neutral size-4"
                  aria-hidden="true"
                />
                <span>{{ t('integrations.cards.status_unknown') }}</span>
              </div>
            </NeTableCell>
            <NeTableCell
              :data-label="t('common.actions')"
              :class="{ 'max-xl:hidden': isReadOnly(connection) }"
            >
              <div v-if="!isReadOnly(connection)" class="-ml-2.5 flex gap-2 xl:ml-0 xl:justify-end">
                <NeButton kind="tertiary" @click="showDrawer(connection)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ connection.name }}</span>
                </NeButton>
                <NeDropdown
                  :items="getKebabMenuItems(connection)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('integrations.open_menu_of', { name: connection.name })"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="connections.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="connections.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditDbConnectionDrawer
      :is-shown="isShownDrawer"
      :current-connection="currentConnection"
      :used-by="currentConnection ? getUsers(currentConnection) : []"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.cards.delete_connection')"
      :primary-label="t('common.remove')"
      :object-name="currentConnection?.name ?? ''"
      :confirmation-message="
        t('integrations.cards.delete_connection_confirmation', {
          name: currentConnection?.name ?? '',
        })
      "
      :success-title="t('integrations.cards.connection_deleted')"
      success-description-key="integrations.cards.connection_deleted_description"
      :error-title="t('integrations.cards.cannot_delete_connection')"
      :delete-object="deleteCurrentConnection"
      :invalidate-keys="[DB_CONNECTIONS_KEY]"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
