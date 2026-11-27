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
import { NeSkeleton } from '@nethesis/vue-components'
import BrandLogo from '@/components/shell/BrandLogo.vue'
import AppShell from '@/components/shell/AppShell.vue'
import ToastNotificationsArea from '@/components/shell/ToastNotificationsArea.vue'
import SignInSplash from '@/components/shell/SignInSplash.vue'
import { useThemeStore } from '@/stores/theme'
import { useDensityStore } from '@/stores/density'
import { useLoginStore } from '@/stores/login'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useWizardState } from '@/queries/setup/wizardState'
import { useMe } from '@/queries/permissions/me'
import { IS_E2E } from '@/lib/config'
import { canAccess } from '@/lib/permissions/permissions'
import { areSystemAlertsAllowed, useSystemAlerts } from '@/composables/useSystemAlerts'

const themeStore = useThemeStore()
const densityStore = useDensityStore()
const runtimeConfigStore = useRuntimeConfigStore()
const route = useRoute()
const router = useRouter()
const loginStore = useLoginStore()
const notificationsStore = useNotificationsStore()
const { state: wizardState } = useWizardState()
const { state: meState } = useMe()
const { t, te } = useI18n()
const initialTitle = document.title

const layout = computed(() => (route.matched.length > 0 ? (route.meta.layout ?? 'app') : null))

const pageTitle = computed(() => {
  if (!runtimeConfigStore.loaded) {
    return initialTitle
  }
  const brandName = runtimeConfigStore.failed ? initialTitle : runtimeConfigStore.config.brandName
  const titleKey = route.meta.titleKey

  if (!titleKey || !te(titleKey)) {
    return brandName
  }
  return `${t(titleKey, { brand: brandName })} - ${brandName}`
})

useTitle(pageTitle)

if (areSystemAlertsAllowed()) {
  useSystemAlerts(() => loginStore.isAuthenticated && layout.value === 'app')
}

watch(
  () => loginStore.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated && !route.meta.public) {
      router.push({
        name: 'login',
        query: route.fullPath === '/' ? {} : { redirect: route.fullPath },
      })
    }
  },
)

watch(
  () => meState.value.data?.permissions,
  (permissions) => {
    const section = route.meta.section

    if (permissions && section && !canAccess(permissions, section)) {
      router.replace({ path: route.path, query: route.query, hash: route.hash, force: true })
    }
  },
)

watch(
  () => wizardState.value.status === 'error',
  (failed) => {
    if (failed && loginStore.isAuthenticated) {
      notificationsStore.createNotification({
        kind: 'warning',
        title: t('setup.cannot_check_setup'),
        description: describeError(wizardState.value.error),
      })
    }
  },
)

onMounted(() => {
  themeStore.loadTheme()
  densityStore.loadDensity()
  runtimeConfigStore.load()
})
</script>

<template>
  <div class="h-full">
    <AppShell v-if="layout === 'app'" />
    <RouterView v-else-if="layout === 'blank'" />
    <div
      v-else-if="loginStore.isAuthenticated"
      role="status"
      :aria-label="t('common.loading')"
      data-testid="app-loading"
    >
      <div class="hidden lg:fixed lg:flex lg:h-screen lg:w-75 lg:flex-col">
        <div
          class="flex grow flex-col gap-y-5 border-r border-gray-200 bg-white px-2 pt-1 pb-4 dark:border-gray-700 dark:bg-gray-950"
        >
          <div class="flex h-12.5 shrink-0 items-center px-4">
            <BrandLogo class="h-5.5 w-auto" />
          </div>
          <NeSkeleton :lines="7" class="px-4" />
        </div>
      </div>
      <div class="lg:pl-75">
        <div
          class="h-16 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950"
        ></div>
        <div class="flex flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
          <NeSkeleton size="lg" class="max-w-xs" />
          <NeSkeleton :lines="8" />
        </div>
      </div>
    </div>
    <SignInSplash />
    <ToastNotificationsArea />
  </div>
  <PiniaColadaDevtools v-if="!IS_E2E" />
</template>
