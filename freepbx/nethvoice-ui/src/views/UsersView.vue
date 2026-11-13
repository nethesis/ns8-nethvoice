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
import UsersPanel from '@/components/users/UsersPanel.vue'
import GroupsPanel from '@/components/groups/GroupsPanel.vue'
import ProfilesPanel from '@/components/profiles/ProfilesPanel.vue'
import UserOverviewPanel from '@/components/users/UserOverviewPanel.vue'

const TAB_NAMES = ['overview', 'users', 'groups', 'profiles'] as const

const { t } = useI18n()
const { selectedTab } = useRouteTab(TAB_NAMES)

const tabs = computed(() => [
  { name: 'overview', label: t('users.tab_overview') },
  { name: 'users', label: t('users.tab_users') },
  { name: 'groups', label: t('users.tab_groups') },
  { name: 'profiles', label: t('users.tab_profiles') },
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
    <NeHeading tag="h3" class="mb-7">{{ $t('users.title') }}</NeHeading>
    <NeTabs
      v-keyboard-tabs
      :tabs="tabs"
      :selected="selectedTab"
      :sr-tabs-label="t('ne_tabs.tabs')"
      :sr-select-tab-label="t('ne_tabs.select_a_tab')"
      class="mb-8"
      @select-tab="selectTab"
    />
    <UserOverviewPanel v-if="selectedTab === 'overview'" />
    <UsersPanel v-else-if="selectedTab === 'users'" />
    <GroupsPanel v-else-if="selectedTab === 'groups'" />
    <ProfilesPanel v-else-if="selectedTab === 'profiles'" />
  </div>
</template>
