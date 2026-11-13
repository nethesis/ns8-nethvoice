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
import PhonesPanel from '@/components/phones/PhonesPanel.vue'
import PhoneModelsPanel from '@/components/phones/PhoneModelsPanel.vue'
import PhoneSettingsPanel from '@/components/phones/PhoneSettingsPanel.vue'

const TAB_NAMES = ['phones', 'models', 'settings'] as const

const { t } = useI18n()
const { selectedTab } = useRouteTab(TAB_NAMES)

const tabs = computed(() => [
  { name: 'phones', label: t('phones.tab_phones') },
  { name: 'models', label: t('phones.tab_models') },
  { name: 'settings', label: t('phones.tab_settings') },
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
    <NeHeading tag="h3" class="mb-7">{{ $t('phones.title') }}</NeHeading>
    <NeTabs
      v-keyboard-tabs
      :tabs="tabs"
      :selected="selectedTab"
      :sr-tabs-label="t('ne_tabs.tabs')"
      :sr-select-tab-label="t('ne_tabs.select_a_tab')"
      class="mb-8"
      @select-tab="selectTab"
    />
    <PhonesPanel v-if="selectedTab === 'phones'" />
    <PhoneModelsPanel v-else-if="selectedTab === 'models'" />
    <PhoneSettingsPanel v-else-if="selectedTab === 'settings'" />
  </div>
</template>
