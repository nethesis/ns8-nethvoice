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
  NeTableRow,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus, faDatabase, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons'
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
  useDbConnectionTypes,
} from '@/queries/integrations/customerCards'

const { t } = useI18n()
const { state, refetch } = useDbConnections()
const { state: typesState } = useDbConnectionTypes()
const { state: cardsState } = useCustomerCards()

const currentConnection = ref<DbConnection | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const connections = computed(() => state.value.data ?? [])

const { pageNum, pageSize, page: connectionsPage } = useClientPagination(connections)

const isTableShown = computed(
  () => state.value.status === 'pending' || connections.value.length > 0,
)

const blockingCards = computed(() =>
  currentConnection.value
    ? getCardsUsingConnection(cardsState.value.data ?? [], currentConnection.value.id).map(
        (card) => card.name,
      )
    : [],
)

function showDrawer(connection?: DbConnection) {
  currentConnection.value = connection
  isShownDrawer.value = true
}

function getKebabMenuItems(connection: DbConnection): NeDropdownItem[] {
  return [
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      disabled: cardsState.value.status !== 'success',
      action: () => {
        currentConnection.value = connection
        isShownDeleteModal.value = true
      },
    },
  ]
}

function deleteCurrentConnection() {
  return currentConnection.value
    ? deleteDbConnection(currentConnection.value.id)
    : Promise.resolve()
}
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="db-connections-heading">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div class="flex flex-col gap-1">
        <NeHeading id="db-connections-heading" tag="h5">
          {{ t('integrations.cards.connections') }}
        </NeHeading>
        <p class="text-secondary-neutral max-w-2xl text-sm">
          {{ t('integrations.cards.connections_description') }}
        </p>
      </div>
      <NeButton kind="secondary" :disabled="state.status !== 'success'" @click="showDrawer()">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_connection') }}
      </NeButton>
    </div>
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
      card-breakpoint="lg"
      :loading="state.status === 'pending'"
      :skeleton-columns="5"
      :skeleton-rows="3"
    >
      <NeTableHead>
        <NeTableHeadCell>{{ t('integrations.database') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('integrations.cards.connection_type') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('integrations.host') }}</NeTableHeadCell>
        <NeTableHeadCell>{{ t('integrations.user') }}</NeTableHeadCell>
        <NeTableHeadCell>
          <span class="sr-only">{{ t('common.actions') }}</span>
        </NeTableHeadCell>
      </NeTableHead>
      <NeTableBody>
        <NeTableRow v-for="connection in connectionsPage" :key="connection.id">
          <NeTableCell :data-label="t('integrations.database')">
            <div class="flex flex-wrap items-center gap-2">
              <span class="wrap-anywhere">{{ connection.name }}</span>
              <NeBadgeV2 v-if="connection.builtIn" kind="gray" size="xs">
                {{ t('integrations.cards.built_in') }}
              </NeBadgeV2>
            </div>
          </NeTableCell>
          <NeTableCell :data-label="t('integrations.cards.connection_type')">
            {{ getDbConnectionTypeLabel(connection.type, typesState.data ?? []) }}
          </NeTableCell>
          <NeTableCell :data-label="t('integrations.host')">
            <span class="wrap-anywhere">{{ connection.host }}:{{ connection.port }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('integrations.user')">
            <span class="wrap-anywhere">{{ connection.user || '-' }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div v-if="!connection.builtIn" class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
              <NeButton kind="tertiary" @click="showDrawer(connection)">
                <template #prefix>
                  <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
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
            <span v-else class="text-tertiary-neutral text-sm lg:block lg:text-right">
              {{ t('integrations.cards.managed_by_system') }}
            </span>
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
    <CreateOrEditDbConnectionDrawer
      :is-shown="isShownDrawer"
      :current-connection="currentConnection"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.cards.delete_connection')"
      :object-name="currentConnection?.name ?? ''"
      :confirmation-message="
        t('integrations.cards.delete_connection_confirmation', {
          name: currentConnection?.name ?? '',
        })
      "
      :success-title="t('integrations.cards.connection_deleted')"
      :error-title="t('integrations.cards.cannot_delete_connection')"
      :delete-object="deleteCurrentConnection"
      :invalidate-keys="[DB_CONNECTIONS_KEY]"
      :blocked-by="blockingCards"
      :blocked-message="t('integrations.cards.connection_in_use')"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
