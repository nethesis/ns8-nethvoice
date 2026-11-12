<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeSpinner } from '@nethesis/vue-components'
</script>

<template>
  <div class="text-placeholder flex items-center gap-2" role="status">
    <NeSpinner color="gray" size="4" />
    <span>{{ $t('trunks.updating') }}</span>
  </div>
</template>
