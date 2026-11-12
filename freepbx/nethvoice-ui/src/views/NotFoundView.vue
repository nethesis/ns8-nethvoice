<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeEmptyState, NeButton } from '@nethesis/vue-components'
import { faCompass } from '@fortawesome/free-solid-svg-icons'
</script>

<template>
  <NeEmptyState
    :title="$t('not_found.title')"
    :description="$t('not_found.description')"
    :icon="faCompass"
  >
    <NeButton kind="primary" size="lg" @click="$router.push({ name: 'dashboard' })">
      {{ $t('common.go_to_page', { page: $t('dashboard.title') }) }}
    </NeButton>
  </NeEmptyState>
</template>
