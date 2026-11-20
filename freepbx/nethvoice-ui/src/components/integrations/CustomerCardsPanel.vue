<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import CardTemplatesTable from './CardTemplatesTable.vue'
import CustomerCardsTable from './CustomerCardsTable.vue'
import DbConnectionsTable from './DbConnectionsTable.vue'
</script>

<template>
  <div class="flex flex-col gap-16">
    <CustomerCardsTable />
    <CardTemplatesTable />
    <DbConnectionsTable />
  </div>
</template>
