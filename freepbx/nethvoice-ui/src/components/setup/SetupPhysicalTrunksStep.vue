<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { NeButton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import SetupStepLayout from './SetupStepLayout.vue'
import PhysicalTrunksManager from '@/components/trunks/PhysicalTrunksManager.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'

const { advancing, goToNextStep } = useSetupNavigation('physical-trunks')

const manager = useTemplateRef<InstanceType<typeof PhysicalTrunksManager>>('manager')
</script>

<template>
  <SetupStepLayout
    step-id="physical-trunks"
    :title="$t('setup.physical_trunks.title')"
    :description="$t('setup.physical_trunks.description')"
    :next-loading="advancing"
    @next="goToNextStep()"
  >
    <template v-if="manager?.isCreateActionShown" #actions>
      <NeButton kind="secondary" @click="manager.showCreateDrawer()">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ $t('trunks.physical.add_physical_trunk') }}
      </NeButton>
    </template>
    <PhysicalTrunksManager ref="manager" variant="setup" />
  </SetupStepLayout>
</template>
