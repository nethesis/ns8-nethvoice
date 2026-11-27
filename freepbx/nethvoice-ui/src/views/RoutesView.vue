<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeTabs } from '@nethesis/vue-components'
import { vKeyboardTabs } from '@/lib/keyboardTabs'
import { useRouteTab } from '@/composables/useRouteTab'
import InboundRoutesPanel from '@/components/routes/InboundRoutesPanel.vue'
import OutboundRoutesPanel from '@/components/routes/OutboundRoutesPanel.vue'

const TAB_NAMES = ['inbound', 'outbound'] as const

const { t } = useI18n()
const { selectedTab } = useRouteTab(TAB_NAMES)

const tabs = computed(() => [
  { name: 'inbound', label: t('routes.tab_inbound') },
  { name: 'outbound', label: t('routes.tab_outbound') },
])

function selectTab(tabName: string) {
  const tab = TAB_NAMES.find((name) => name === tabName)

  if (tab) {
    selectedTab.value = tab
  }
}
</script>

<template>
  <div>
    <h1 class="text-primary-neutral mb-7 text-2xl font-medium">{{ $t('routes.title') }}</h1>
    <NeTabs
      v-keyboard-tabs
      :tabs="tabs"
      :selected="selectedTab"
      :sr-tabs-label="t('ne_tabs.tabs')"
      :sr-select-tab-label="t('ne_tabs.select_a_tab')"
      class="mb-8"
      @select-tab="selectTab"
    />
    <InboundRoutesPanel v-if="selectedTab === 'inbound'" />
    <OutboundRoutesPanel v-else-if="selectedTab === 'outbound'" />
  </div>
</template>
