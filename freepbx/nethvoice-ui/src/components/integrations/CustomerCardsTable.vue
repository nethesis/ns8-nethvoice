<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeHeading,
  NeInlineNotification,
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
  faAddressCard,
  faCirclePlus,
  faCircleXmark,
  faClone,
  faPenToSquare,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import CreateOrEditCustomerCardDrawer from './CreateOrEditCustomerCardDrawer.vue'
import DeleteIntegrationObjectModal from './DeleteIntegrationObjectModal.vue'
import IntegrationsPaginator from './IntegrationsPaginator.vue'
import { useClientPagination } from '@/composables/useClientPagination'
import { PAGE_SIZES } from '@/lib/common'
import {
  CUSTOMER_CARDS_KEY,
  type CustomerCard,
  deleteCustomerCard,
} from '@/lib/integrations/customerCards'
import { getProfileNames } from '@/lib/integrations/lookups'
import { PROFILES_KEY } from '@/lib/profiles/profiles'
import { useProfileOptions } from '@/queries/integrations/lookups'
import {
  useCardTemplates,
  useCustomerCards,
  useDbConnections,
  useDbConnectionStatuses,
} from '@/queries/integrations/customerCards'
import { describeError } from '@/stores/notifications'

type DrawerMode = 'create' | 'edit' | 'duplicate'

const { t } = useI18n()
const { state, refetch } = useCustomerCards()
const { state: connectionsState } = useDbConnections()
const { getStatus } = useDbConnectionStatuses()
const { state: profilesState } = useProfileOptions()
const { state: templatesState } = useCardTemplates()

const currentCard = ref<CustomerCard | undefined>()
const drawerMode = ref<DrawerMode>('create')
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const cards = computed(() => state.value.data ?? [])
const profiles = computed(() => profilesState.value.data ?? [])

const { pageNum, pageSize, page: cardsPage } = useClientPagination(cards)

const isEmpty = computed(() => state.value.status === 'success' && cards.value.length === 0)

const isTableShown = computed(() => state.value.status === 'pending' || cards.value.length > 0)

function isTemplateMissing(card: CustomerCard): boolean {
  return (
    templatesState.value.status === 'success' &&
    !templatesState.value.data.some((template) => template.id === card.templateId)
  )
}

function describeConnection(id: string): string {
  return connectionsState.value.data?.find((connection) => connection.id === id)?.name ?? `#${id}`
}

function showDrawer(mode: DrawerMode, card?: CustomerCard) {
  drawerMode.value = mode
  currentCard.value = card
  isShownDrawer.value = true
}

function getKebabMenuItems(card: CustomerCard): NeDropdownItem[] {
  return [
    {
      id: 'duplicate',
      label: t('integrations.cards.duplicate'),
      icon: faClone,
      action: () => showDrawer('duplicate', card),
    },
    { id: 'divider' },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: faTrash,
      danger: true,
      action: () => {
        currentCard.value = card
        isShownDeleteModal.value = true
      },
    },
  ]
}

function deleteCurrentCard() {
  return currentCard.value ? deleteCustomerCard(currentCard.value.id) : Promise.resolve()
}
</script>

<template>
  <section aria-labelledby="customer-cards-heading">
    <NeHeading id="customer-cards-heading" tag="h5" class="mb-2">
      {{ t('integrations.cards.cards') }}
    </NeHeading>
    <div v-if="!isEmpty" class="mb-8 grid gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <p class="text-tertiary-neutral max-w-2xl">
        {{ t('integrations.cards.cards_description') }}
      </p>
      <NeButton
        kind="primary"
        size="lg"
        :disabled="state.status !== 'success'"
        class="mt-2 justify-self-start sm:mt-0"
        @click="showDrawer('create')"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_card') }}
      </NeButton>
    </div>
    <div class="flex flex-col gap-6">
      <LoadError
        v-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.cards.cannot_load_cards')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-else-if="isEmpty"
        :title="t('integrations.cards.no_cards')"
        :description="t('integrations.cards.cards_description')"
        :icon="faAddressCard"
        class="elevation-0"
      >
        <NeButton kind="primary" size="lg" @click="showDrawer('create')">
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
          </template>
          {{ t('integrations.cards.create_card') }}
        </NeButton>
      </NeEmptyState>
      <NeInlineNotification
        v-if="state.status === 'success' && cards.length > 0 && profilesState.status === 'error'"
        kind="warning"
        :title="t('integrations.cannot_load_profiles')"
        :description="describeError(profilesState.error)"
      />
      <NeTable
        v-if="isTableShown"
        :aria-label="t('integrations.cards.cards')"
        card-breakpoint="lg"
        :loading="state.status === 'pending'"
        :skeleton-columns="5"
        :skeleton-rows="3"
      >
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.database') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.cards.template') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.profiles') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="card in cardsPage" :key="card.id">
            <NeTableCell :data-label="t('integrations.name')">
              <span class="wrap-anywhere">{{ card.name }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.database')">
              <div class="flex items-center gap-2">
                <span class="wrap-anywhere">{{ describeConnection(card.dbConnectionId) }}</span>
                <NeTooltip
                  v-if="getStatus(card.dbConnectionId) === 'notConnected'"
                  trigger-event="mouseenter focus"
                >
                  <template #trigger>
                    <span
                      tabindex="0"
                      class="focus:ring-primary-500 dark:focus:ring-primary-300 flex rounded-sm focus:ring-2 focus:outline-hidden"
                    >
                      <FontAwesomeIcon
                        :icon="faCircleXmark"
                        class="text-danger size-4"
                        aria-hidden="true"
                      />
                      <span class="sr-only">
                        {{
                          t('integrations.cards.database_not_connected_named', {
                            name: describeConnection(card.dbConnectionId),
                          })
                        }}
                      </span>
                    </span>
                  </template>
                  <template #content>
                    {{ t('integrations.cards.database_not_connected') }}
                  </template>
                </NeTooltip>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.cards.template')">
              <div class="flex items-center gap-2">
                <span class="wrap-anywhere">{{ card.templateName }}</span>
                <NeTooltip v-if="isTemplateMissing(card)" trigger-event="mouseenter focus">
                  <template #trigger>
                    <span
                      tabindex="0"
                      class="focus:ring-primary-500 dark:focus:ring-primary-300 flex rounded-sm focus:ring-2 focus:outline-hidden"
                    >
                      <FontAwesomeIcon
                        :icon="faTriangleExclamation"
                        class="size-4 text-amber-700 dark:text-amber-500"
                        aria-hidden="true"
                      />
                      <span class="sr-only">{{ t('integrations.cards.template_not_listed') }}</span>
                    </span>
                  </template>
                  <template #content>{{ t('integrations.cards.template_not_listed') }}</template>
                </NeTooltip>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.profiles')">
              <span v-if="card.profileIds.length" class="wrap-anywhere">
                {{ getProfileNames(card.profileIds, profiles).join(', ') }}
              </span>
              <span v-else class="flex items-center gap-2">
                <FontAwesomeIcon
                  :icon="faTriangleExclamation"
                  class="size-4 text-amber-700 dark:text-amber-500"
                  aria-hidden="true"
                />
                {{ t('integrations.cards.profile_not_set') }}
              </span>
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
                <NeButton kind="tertiary" @click="showDrawer('edit', card)">
                  <template #prefix>
                    <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
                  </template>
                  {{ t('common.edit') }}
                  <span class="sr-only">{{ card.name }}</span>
                </NeButton>
                <NeDropdown
                  :items="getKebabMenuItems(card)"
                  :align-to-right="true"
                  :open-menu-aria-label="t('integrations.open_menu_of', { name: card.name })"
                />
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
        <template v-if="cards.length > PAGE_SIZES[0]" #paginator>
          <IntegrationsPaginator
            v-model:page-num="pageNum"
            v-model:page-size="pageSize"
            :total-rows="cards.length"
          />
        </template>
      </NeTable>
    </div>
    <CreateOrEditCustomerCardDrawer
      :is-shown="isShownDrawer"
      :mode="drawerMode"
      :current-card="currentCard"
      @close="isShownDrawer = false"
    />
    <DeleteIntegrationObjectModal
      :visible="isShownDeleteModal"
      :title="t('integrations.cards.delete_card')"
      :object-name="currentCard?.name ?? ''"
      :confirmation-message="
        t('integrations.cards.delete_card_confirmation', { name: currentCard?.name ?? '' })
      "
      :success-title="t('integrations.cards.card_deleted')"
      success-description-key="integrations.cards.card_deleted_description"
      :error-title="t('integrations.cards.cannot_delete_card')"
      :delete-object="deleteCurrentCard"
      :invalidate-keys="[CUSTOMER_CARDS_KEY, PROFILES_KEY]"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
