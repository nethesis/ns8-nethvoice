<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeHeading, NeTabs } from '@nethesis/vue-components'
import { useRouteTab } from '@/composables/useRouteTab'
import VoipTrunksPanel from '@/components/trunks/VoipTrunksPanel.vue'
import PhysicalTrunksPanel from '@/components/trunks/PhysicalTrunksPanel.vue'

const TAB_NAMES = ['voip', 'physical'] as const

const { t } = useI18n()
const { selectedTab } = useRouteTab(TAB_NAMES)

const tabs = computed(() => [
  { name: 'voip', label: t('trunks.tab_voip') },
  { name: 'physical', label: t('trunks.tab_physical') },
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
    <NeHeading tag="h3" class="mb-7">{{ $t('trunks.title') }}</NeHeading>
    <NeTabs
      :tabs="tabs"
      :selected="selectedTab"
      :sr-tabs-label="t('ne_tabs.tabs')"
      :sr-select-tab-label="t('ne_tabs.select_a_tab')"
      class="mb-8"
      @select-tab="selectTab"
    />
    <VoipTrunksPanel v-if="selectedTab === 'voip'" />
    <PhysicalTrunksPanel v-else-if="selectedTab === 'physical'" />
  </div>
</template>
