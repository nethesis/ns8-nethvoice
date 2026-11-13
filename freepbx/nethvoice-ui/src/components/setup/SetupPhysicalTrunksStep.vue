<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import SetupStepLayout from './SetupStepLayout.vue'
import PhysicalTrunksManager from '@/components/trunks/PhysicalTrunksManager.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'

const { advancing, goToNextStep } = useSetupNavigation('physical-trunks')
</script>

<template>
  <SetupStepLayout
    step-id="physical-trunks"
    :title="$t('setup.physical_trunks.title')"
    :description="$t('setup.physical_trunks.description')"
    :next-loading="advancing"
    @next="goToNextStep()"
  >
    <PhysicalTrunksManager variant="setup" />
  </SetupStepLayout>
</template>
