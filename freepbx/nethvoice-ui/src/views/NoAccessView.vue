<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NeEmptyState } from '@nethesis/vue-components'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import { useMe } from '@/queries/permissions/me'

const router = useRouter()
const { state, refetch } = useMe()

async function retry() {
  await refetch()
  await router.replace({ name: 'dashboard' })
}
</script>

<template>
  <LoadError
    v-if="state.status === 'error'"
    :error="state.error"
    :title="$t('permissions.cannot_load_permissions')"
    @retry="retry"
  />
  <NeEmptyState
    v-else
    :title="$t('permissions.no_access_title')"
    :description="$t('permissions.no_access_description')"
    :icon="faLock"
  />
</template>
