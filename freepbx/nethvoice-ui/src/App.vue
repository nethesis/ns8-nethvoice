<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTitle } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { PiniaColadaDevtools } from '@pinia/colada-devtools'
import AppShell from '@/components/shell/AppShell.vue'
import ToastNotificationsArea from '@/components/shell/ToastNotificationsArea.vue'
import { useThemeStore } from '@/stores/theme'
import { useLoginStore } from '@/stores/login'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { IS_E2E } from '@/lib/config'

const themeStore = useThemeStore()
const runtimeConfigStore = useRuntimeConfigStore()
const route = useRoute()
const router = useRouter()
const loginStore = useLoginStore()
const { t, te } = useI18n()

const layout = computed(() => route.meta.layout ?? 'app')

const pageTitle = computed(() => {
  const brandName = runtimeConfigStore.config.brandName
  const titleKey = route.meta.titleKey

  if (!titleKey || !te(titleKey)) {
    return brandName
  }
  return `${t(titleKey)} - ${brandName}`
})

useTitle(pageTitle)

watch(
  () => loginStore.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated && !route.meta.public) {
      router.push({ name: 'login' })
    }
  },
)

onMounted(() => {
  themeStore.loadTheme()
  runtimeConfigStore.load()
})
</script>

<template>
  <div class="h-full">
    <AppShell v-if="layout === 'app'" />
    <RouterView v-else />
    <ToastNotificationsArea />
  </div>
  <PiniaColadaDevtools v-if="!IS_E2E" />
</template>
