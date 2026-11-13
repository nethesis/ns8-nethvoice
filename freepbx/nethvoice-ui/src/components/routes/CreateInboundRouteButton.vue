<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeButton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { getVisualPlanRouteUrl } from '@/lib/routes/inbound'

const { kind = 'primary', size = 'lg' } = defineProps<{
  kind?: 'primary' | 'secondary'
  size?: 'md' | 'lg'
}>()

function createRoute() {
  window.open(getVisualPlanRouteUrl(), '_blank', 'noopener')
}
</script>

<template>
  <NeButton :kind="kind" :size="size" class="shrink-0" @click="createRoute">
    <template #prefix>
      <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="h-4 w-4" aria-hidden="true" />
    </template>
    {{ $t('routes.create_route') }}
    <span class="sr-only">{{ $t('routes.opens_in_new_tab') }}</span>
  </NeButton>
</template>
