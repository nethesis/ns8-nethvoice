<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeButton, NeEmptyState } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus, faIdCard } from '@fortawesome/free-solid-svg-icons'
import CardTemplatesTable from './CardTemplatesTable.vue'
import CustomerCardsTable from './CustomerCardsTable.vue'
import DbConnectionsTable from './DbConnectionsTable.vue'
import {
  useCardTemplates,
  useCustomerCards,
  useDbConnections,
} from '@/queries/integrations/customerCards'

const { t } = useI18n()
const { state: cardsState } = useCustomerCards()
const { state: connectionsState } = useDbConnections()
const { state: templatesState } = useCardTemplates()
const connectionsTableRef =
  useTemplateRef<InstanceType<typeof DbConnectionsTable>>('connectionsTableRef')

const isNothingConfigured = computed(
  () =>
    cardsState.value.data?.length === 0 &&
    connectionsState.value.data?.length === 0 &&
    templatesState.value.data?.length === 0,
)
</script>

<template>
  <div class="flex flex-col gap-10">
    <p class="text-secondary-neutral max-w-2xl">
      {{ t('integrations.cards.description') }}
    </p>
    <NeEmptyState
      v-if="isNothingConfigured"
      :title="t('integrations.cards.nothing_configured')"
      :description="t('integrations.cards.nothing_configured_description')"
      :icon="faIdCard"
      class="elevation-0"
    >
      <NeButton kind="primary" size="lg" @click="connectionsTableRef?.showDrawer()">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ t('integrations.cards.create_connection') }}
      </NeButton>
    </NeEmptyState>
    <CustomerCardsTable :hide-empty-state="isNothingConfigured" />
    <CardTemplatesTable :hide-empty-state="isNothingConfigured" />
    <DbConnectionsTable ref="connectionsTableRef" :hide-empty-state="isNothingConfigured" />
  </div>
</template>
