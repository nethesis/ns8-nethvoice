<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeSideDrawer, NeEmptyState } from '@nethesis/vue-components'
import { NeToastNotificationV2 } from '@nethesis/vue-components'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import isEmpty from 'lodash/isEmpty'
import { faBell } from '@fortawesome/free-solid-svg-icons'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()

function closeDrawer() {
  notificationsStore.setNotificationDrawerOpen(false)
}
</script>

<template>
  <NeSideDrawer
    :is-shown="notificationsStore.isNotificationDrawerOpen"
    :title="t('notifications.title')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="closeDrawer"
    class="z-130"
  >
    <NeEmptyState
      v-if="isEmpty(notificationsStore.notifications)"
      :title="t('notifications.no_notification')"
      :icon="faBell"
    />
    <div v-else class="flex w-full flex-col items-center space-y-4 sm:items-end">
      <TransitionGroup name="fade">
        <NeToastNotificationV2
          v-for="notification in notificationsStore.notifications"
          :key="notification.id"
          :notification="notification"
          full-width
          show-timestamp
          :sr-close-label="t('common.close')"
        />
      </TransitionGroup>
    </div>
  </NeSideDrawer>
</template>
