<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeEmptyState, NeLink } from '@nethesis/vue-components'
import { faPersonDigging } from '@fortawesome/free-solid-svg-icons'
import { LEGACY_WIZARD_URL } from '@/lib/config'

const { legacyPath = '' } = defineProps<{
  legacyPath?: string
}>()
</script>

<template>
  <NeEmptyState
    :title="$t('common.section_under_construction')"
    :description="$t('common.section_under_construction_description')"
    :icon="faPersonDigging"
  >
    <NeLink :href="`${LEGACY_WIZARD_URL}#!/${legacyPath}`">
      {{ $t('common.open_in_legacy_wizard') }}
    </NeLink>
  </NeEmptyState>
</template>
