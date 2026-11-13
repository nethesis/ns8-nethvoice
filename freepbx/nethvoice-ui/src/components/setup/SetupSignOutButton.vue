<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NeButton, NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { useLoginStore } from '@/stores/login'
import { useSetupStore } from '@/stores/setup'

const { iconOnly = false, tooltipPlacement = 'right' } = defineProps<{
  iconOnly?: boolean
  tooltipPlacement?: 'right' | 'bottom'
}>()

const router = useRouter()
const loginStore = useLoginStore()
const setupStore = useSetupStore()
const signingOut = ref(false)

async function signOut() {
  signingOut.value = true

  try {
    await loginStore.logout()
    setupStore.reset()
    await router.push({ name: 'login' })
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <NeTooltip v-if="iconOnly" trigger-event="mouseenter focus" :placement="tooltipPlacement">
    <template #trigger>
      <button
        type="button"
        class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 flex rounded-full p-2"
        :disabled="signingOut"
        @click="signOut"
      >
        <span class="sr-only">{{ $t('shell.sign_out') }}</span>
        <FontAwesomeIcon :icon="faArrowRightFromBracket" class="h-4 w-4" aria-hidden="true" />
      </button>
    </template>
    <template #content>{{ $t('shell.sign_out') }}</template>
  </NeTooltip>
  <NeButton
    v-else
    kind="tertiary"
    size="lg"
    :loading="signingOut"
    :disabled="signingOut"
    @click="signOut"
  >
    <template #prefix>
      <FontAwesomeIcon :icon="faArrowRightFromBracket" class="h-4 w-4" aria-hidden="true" />
    </template>
    {{ $t('shell.sign_out') }}
  </NeButton>
</template>
