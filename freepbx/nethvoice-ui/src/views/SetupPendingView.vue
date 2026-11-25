<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useIntervalFn } from '@vueuse/core'
import { NeButton, NeEmptyState } from '@nethesis/vue-components'
import {
  faArrowRightFromBracket,
  faArrowsRotate,
  faHourglassHalf,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useWizardState } from '@/queries/setup/wizardState'
import { useLoginStore } from '@/stores/login'
import { useNotificationsStore } from '@/stores/notifications'

const SETUP_PENDING_REFRESH_INTERVAL = 30_000

const { t } = useI18n()
const router = useRouter()
const loginStore = useLoginStore()
const notificationsStore = useNotificationsStore()
const { refetch, asyncStatus } = useWizardState()

async function checkSetup(reportError: boolean) {
  const state = await refetch()

  if (state.data && !state.data.inProgress) {
    await router.replace({ name: 'dashboard' })
    return
  }

  if (reportError && state.status === 'error') {
    notificationsStore.createNotificationFromError(state.error, t('setup.cannot_check_setup'), {
      serverDetail: false,
    })
  }
}

useIntervalFn(() => checkSetup(false), SETUP_PENDING_REFRESH_INTERVAL)

async function signOut() {
  await loginStore.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="elevation-1 flex min-h-full items-center justify-center p-6">
    <NeEmptyState
      :title="$t('permissions.setup_pending_title')"
      :description="$t('permissions.setup_pending_description')"
      :icon="faHourglassHalf"
      class="w-full max-w-xl"
    >
      <div class="flex flex-wrap items-center justify-center gap-4">
        <NeButton
          kind="primary"
          size="lg"
          :loading="asyncStatus === 'loading'"
          :disabled="asyncStatus === 'loading'"
          @click="checkSetup(true)"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faArrowsRotate" class="size-4" aria-hidden="true" />
          </template>
          {{ $t('permissions.check_again') }}
        </NeButton>
        <NeButton kind="secondary" size="lg" @click="signOut">
          <template #prefix>
            <FontAwesomeIcon :icon="faArrowRightFromBracket" class="size-4" aria-hidden="true" />
          </template>
          {{ $t('shell.sign_out') }}
        </NeButton>
      </div>
    </NeEmptyState>
  </div>
</template>
