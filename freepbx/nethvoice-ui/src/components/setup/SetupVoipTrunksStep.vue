<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import SetupStepLayout from './SetupStepLayout.vue'
import VoipTrunksManager from '@/components/trunks/VoipTrunksManager.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'

const { advancing, goToNextStep } = useSetupNavigation('voip-trunks')
</script>

<template>
  <SetupStepLayout
    step-id="voip-trunks"
    :title="$t('setup.voip_trunks.title')"
    :next-loading="advancing"
    @next="goToNextStep()"
  >
    <template #description>
      <div class="text-secondary-neutral max-w-3xl">
        <p>{{ $t('setup.voip_trunks.description') }}</p>
        <p>{{ $t('setup.voip_trunks.description_details') }}</p>
      </div>
    </template>
    <VoipTrunksManager variant="setup" />
  </SetupStepLayout>
</template>
