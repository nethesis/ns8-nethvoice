<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NeHeading, NeTabs } from '@nethesis/vue-components'
import { vKeyboardTabs } from '@/lib/keyboardTabs'
import { useRouteTab } from '@/composables/useRouteTab'
import PhonebookSourcesPanel from '@/components/integrations/PhonebookSourcesPanel.vue'
import VideoSourcesPanel from '@/components/integrations/VideoSourcesPanel.vue'
import ParameterizedUrlsPanel from '@/components/integrations/ParameterizedUrlsPanel.vue'
import CustomerCardsPanel from '@/components/integrations/CustomerCardsPanel.vue'
import ExternalServicesPanel from '@/components/integrations/ExternalServicesPanel.vue'

const TAB_NAMES = [
  'phonebook',
  'video-sources',
  'parameterized-urls',
  'customer-cards',
  'external-services',
] as const

const { t } = useI18n()
const { selectedTab } = useRouteTab(TAB_NAMES)

const tabs = computed(() => [
  { name: 'phonebook', label: t('integrations.tab_phonebook') },
  { name: 'video-sources', label: t('integrations.tab_video_sources') },
  { name: 'parameterized-urls', label: t('integrations.tab_parameterized_urls') },
  { name: 'customer-cards', label: t('integrations.tab_customer_cards') },
  { name: 'external-services', label: t('integrations.tab_external_services') },
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
    <NeHeading tag="h3" class="mb-7">{{ $t('integrations.title') }}</NeHeading>
    <NeTabs
      v-keyboard-tabs
      :tabs="tabs"
      :selected="selectedTab"
      :sr-tabs-label="t('ne_tabs.tabs')"
      :sr-select-tab-label="t('ne_tabs.select_a_tab')"
      class="mb-8"
      @select-tab="selectTab"
    />
    <PhonebookSourcesPanel v-if="selectedTab === 'phonebook'" />
    <VideoSourcesPanel v-else-if="selectedTab === 'video-sources'" />
    <ParameterizedUrlsPanel v-else-if="selectedTab === 'parameterized-urls'" />
    <CustomerCardsPanel v-else-if="selectedTab === 'customer-cards'" />
    <ExternalServicesPanel v-else-if="selectedTab === 'external-services'" />
  </div>
</template>
