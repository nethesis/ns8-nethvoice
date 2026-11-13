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
  faCirclePlus,
  faIdCard,
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
} from '@/queries/integrations/customerCards'
import { describeError } from '@/stores/notifications'

const { hideEmptyState = false } = defineProps<{ hideEmptyState?: boolean }>()

const { t } = useI18n()
const { state, refetch } = useCustomerCards()
const { state: connectionsState } = useDbConnections()
const { state: profilesState } = useProfileOptions()
const { state: templatesState } = useCardTemplates()

const currentCard = ref<CustomerCard | undefined>()
const isShownDrawer = ref(false)
const isShownDeleteModal = ref(false)

const cards = computed(() => state.value.data ?? [])
const profiles = computed(() => profilesState.value.data ?? [])

const { pageNum, pageSize, page: cardsPage } = useClientPagination(cards)

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

function showCreateDrawer() {
  currentCard.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(card: CustomerCard) {
  currentCard.value = card
  isShownDrawer.value = true
}

function getKebabMenuItems(card: CustomerCard): NeDropdownItem[] {
  return [
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
  <section class="flex flex-col gap-4" aria-labelledby="customer-cards-heading">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div class="flex flex-col gap-1">
        <NeHeading id="customer-cards-heading" tag="h5">
          {{ t('integrations.cards.cards') }}
        </NeHeading>
        <p class="text-secondary-neutral max-w-2xl text-sm">
          {{ t('integrations.cards.cards_description') }}
        </p>
      </div>
      <NeButton kind="secondary" :disabled="state.status !== 'success'" @click="showCreateDrawer">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_card') }}
      </NeButton>
    </div>
    <LoadError
      v-if="state.status === 'error'"
      :error="state.error"
      :title="t('integrations.cards.cannot_load_cards')"
      @retry="refetch()"
    />
    <NeEmptyState
      v-else-if="state.status === 'success' && cards.length === 0 && !hideEmptyState"
      :title="t('integrations.cards.no_cards')"
      :description="t('integrations.cards.no_cards_description')"
      :icon="faIdCard"
      class="elevation-0"
    />
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
        <NeTableHeadCell>{{ t('integrations.cards.connection') }}</NeTableHeadCell>
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
          <NeTableCell :data-label="t('integrations.cards.connection_short')">
            {{ describeConnection(card.dbConnectionId) }}
          </NeTableCell>
          <NeTableCell :data-label="t('integrations.cards.template')">
            <div class="flex items-center gap-2">
              <span class="wrap-anywhere">{{ card.templateName }}</span>
              <NeTooltip v-if="isTemplateMissing(card)">
                <template #trigger>
                  <span tabindex="0" class="flex rounded-sm">
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
            <span v-else class="text-tertiary-neutral">{{
              t('integrations.cards.no_profiles')
            }}</span>
          </NeTableCell>
          <NeTableCell :data-label="t('common.actions')">
            <div class="-ml-2.5 flex gap-2 lg:ml-0 lg:justify-end">
              <NeButton kind="tertiary" @click="showEditDrawer(card)">
                <template #prefix>
                  <FontAwesomeIcon :icon="faPenToSquare" class="h-4 w-4" aria-hidden="true" />
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
    <CreateOrEditCustomerCardDrawer
      :is-shown="isShownDrawer"
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
      :error-title="t('integrations.cards.cannot_delete_card')"
      :delete-object="deleteCurrentCard"
      :invalidate-keys="[CUSTOMER_CARDS_KEY, PROFILES_KEY]"
      @close="isShownDeleteModal = false"
    />
  </section>
</template>
