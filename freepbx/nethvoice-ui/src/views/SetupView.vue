<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import BrandLogo from '@/components/shell/BrandLogo.vue'
import LoadError from '@/components/common/LoadError.vue'
import SetupSignOutButton from '@/components/setup/SetupSignOutButton.vue'
import { getWizardRedirect } from '@/lib/setup/guard'
import { useWizardState } from '@/queries/setup/wizardState'

const route = useRoute()
const router = useRouter()
const { state: wizardState, refetch } = useWizardState()
const retrying = ref(false)

const isWizardStateUnknown = computed(
  () => wizardState.value.status === 'error' && !wizardState.value.data,
)

async function retry() {
  if (retrying.value) {
    return
  }
  retrying.value = true

  try {
    const state = await refetch()

    if (state.data) {
      const redirect = getWizardRedirect(route.name, state.data)

      if (redirect) {
        await router.replace(redirect)
      }
    }
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-full items-stretch justify-center bg-gray-200 p-0 sm:p-6 lg:items-center lg:p-10 dark:bg-gray-700"
  >
    <div
      class="elevation-1 flex w-full max-w-375 overflow-hidden shadow-xl sm:rounded-3xl lg:h-[min(920px,calc(100vh-5rem))]"
    >
      <div
        v-if="isWizardStateUnknown"
        class="flex w-full flex-col items-center justify-center gap-6 p-6 sm:p-10"
        data-testid="setup-state-error"
      >
        <BrandLogo class="h-8.25 w-auto" />
        <div class="w-full max-w-xl">
          <LoadError
            :error="wizardState.error"
            :title="$t('setup.cannot_check_setup')"
            :server-detail="false"
            @retry="retry"
          />
        </div>
        <SetupSignOutButton />
      </div>
      <RouterView v-else />
    </div>
  </div>
</template>
