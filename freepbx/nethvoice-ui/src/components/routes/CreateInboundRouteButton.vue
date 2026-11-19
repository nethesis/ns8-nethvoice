<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeButton } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useRouter } from 'vue-router'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { getVisualPlanLocation } from '@/lib/routes/inbound'
import { usePermissions } from '@/queries/permissions/me'

const { kind = 'primary', size = 'md' } = defineProps<{
  kind?: 'primary' | 'secondary'
  size?: 'md' | 'lg'
}>()

const { isSuperadmin } = usePermissions()
const router = useRouter()

function createRoute() {
  router.push(getVisualPlanLocation())
}
</script>

<template>
  <NeButton v-if="isSuperadmin" :kind="kind" :size="size" class="shrink-0" @click="createRoute">
    <template #prefix>
      <FontAwesomeIcon :icon="faCirclePlus" class="h-4 w-4" aria-hidden="true" />
    </template>
    {{ $t('routes.create_route') }}
  </NeButton>
</template>
