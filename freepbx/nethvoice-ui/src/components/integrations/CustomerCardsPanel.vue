<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeEmptyState } from '@nethesis/vue-components'
import { faIdCard } from '@fortawesome/free-solid-svg-icons'
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
    />
    <CustomerCardsTable />
    <CardTemplatesTable />
    <DbConnectionsTable />
  </div>
</template>
