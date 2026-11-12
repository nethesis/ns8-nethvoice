<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import { type NeNotificationV2, NeToastNotificationV2 } from '@nethesis/vue-components'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()

const notificationsToShow = computed(() => {
  return notificationsStore.notifications.filter(
    (notification: NeNotificationV2) => notification.isShown,
  )
})
</script>

<template>
  <div>
    <Teleport to="body">
      <div
        aria-live="assertive"
        class="pointer-events-none fixed inset-0 z-120 flex items-start px-8 pt-24 pb-6 text-sm"
      >
        <div class="flex w-full flex-col items-end space-y-4">
          <TransitionGroup name="fade">
            <NeToastNotificationV2
              v-for="notification in notificationsToShow"
              :key="notification.id"
              :notification="notification"
              :sr-close-label="t('common.close')"
              show-close-button
              @close="notificationsStore.hideNotification(notification.id)"
            />
          </TransitionGroup>
        </div>
      </div>
    </Teleport>
  </div>
</template>
