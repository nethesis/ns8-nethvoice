<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeInlineNotification } from '@nethesis/vue-components'
</script>

<template>
  <NeInlineNotification
    kind="info"
    data-testid="live-data-unavailable"
    :title="$t('dashboard.live_unavailable.title')"
    :description="$t('dashboard.live_unavailable.description')"
  />
</template>
