<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div
    class="flex min-h-full items-stretch justify-center bg-gray-200 p-0 sm:p-6 lg:items-center lg:p-10 dark:bg-gray-700"
  >
    <div
      class="elevation-1 flex w-full max-w-[1500px] overflow-hidden shadow-xl sm:rounded-3xl lg:h-[min(920px,calc(100vh-5rem))]"
    >
      <RouterView />
    </div>
  </div>
</template>
