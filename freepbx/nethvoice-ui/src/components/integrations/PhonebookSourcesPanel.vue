<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import ContactImportsTable from './ContactImportsTable.vue'
import PhonebookSourcesTable from './PhonebookSourcesTable.vue'
</script>

<template>
  <div class="flex flex-col gap-16">
    <PhonebookSourcesTable />
    <ContactImportsTable />
  </div>
</template>
