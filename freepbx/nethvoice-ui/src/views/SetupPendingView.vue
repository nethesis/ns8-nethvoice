<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NeButton, NeEmptyState } from '@nethesis/vue-components'
import { faArrowRightFromBracket, faHourglassHalf } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useLoginStore } from '@/stores/login'

const router = useRouter()
const loginStore = useLoginStore()

async function signOut() {
  await loginStore.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-full items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
    <NeEmptyState
      :title="$t('permissions.setup_pending_title')"
      :description="$t('permissions.setup_pending_description')"
      :icon="faHourglassHalf"
      class="w-full max-w-xl"
    >
      <NeButton kind="secondary" size="lg" @click="signOut">
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowRightFromBracket" class="size-4" aria-hidden="true" />
        </template>
        {{ $t('shell.sign_out') }}
      </NeButton>
    </NeEmptyState>
  </div>
</template>
