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
import VoipTrunksManager from '@/components/trunks/VoipTrunksManager.vue'
import { useSetupNavigation } from '@/composables/useSetupNavigation'

const { advancing, goToNextStep } = useSetupNavigation('voip-trunks')

const manager = useTemplateRef<InstanceType<typeof VoipTrunksManager>>('manager')
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
    <template v-if="manager?.isCreateActionShown" #actions>
      <NeButton kind="secondary" @click="manager.showCreateDrawer()">
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
        </template>
        {{ $t('trunks.voip.add_voip_trunk') }}
      </NeButton>
    </template>
    <VoipTrunksManager ref="manager" variant="setup" />
  </SetupStepLayout>
</template>
