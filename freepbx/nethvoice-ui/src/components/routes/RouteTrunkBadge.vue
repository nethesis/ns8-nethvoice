<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeBadgeV2, type NeBadgeV2Kind } from '@nethesis/vue-components'
import type { RouteTrunkState } from '@/lib/routes/outbound'

const { state } = defineProps<{
  state: RouteTrunkState
}>()

const BADGES: Record<Exclude<RouteTrunkState, 'active'>, { kind: NeBadgeV2Kind; label: string }> = {
  disabled: { kind: 'gray', label: 'common.disabled' },
  deleted: { kind: 'rose', label: 'routes.trunk_deleted' },
  voice_agents: { kind: 'amber', label: 'routes.trunk_voice_agents' },
}
</script>

<template>
  <NeBadgeV2 v-if="state !== 'active'" :kind="BADGES[state].kind" size="xs" class="shrink-0">
    {{ $t(BADGES[state].label) }}
  </NeBadgeV2>
</template>
