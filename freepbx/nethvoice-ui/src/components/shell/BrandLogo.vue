<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import { customLoginLogoUrl, customLogoUrl } from '@/lib/brandLogo'
import { isRebranded } from '@/lib/signInSplash'
import LogoLight from '@/assets/logo_light.svg'
import LogoDark from '@/assets/logo_dark.svg'

defineOptions({ inheritAttrs: false })

const { variant = 'navbar' } = defineProps<{
  variant?: 'navbar' | 'login'
}>()

const themeStore = useThemeStore()
const runtimeConfigStore = useRuntimeConfigStore()

const customLogoFailed = ref(false)

const customLogo = computed(() => {
  const background = themeStore.isLight ? 'light' : 'dark'

  return variant === 'login'
    ? customLoginLogoUrl(runtimeConfigStore.config, background)
    : customLogoUrl(runtimeConfigStore.config, background)
})

const stockLogo = computed(() => {
  if (isRebranded(runtimeConfigStore.config)) {
    return ''
  }
  return themeStore.isLight ? LogoLight : LogoDark
})

const logoUrl = computed(() => {
  if (customLogo.value && !customLogoFailed.value) {
    return customLogo.value
  }
  return stockLogo.value
})

watch(customLogo, () => {
  customLogoFailed.value = false
})
</script>

<template>
  <img
    v-if="runtimeConfigStore.loaded && logoUrl"
    v-bind="$attrs"
    :src="logoUrl"
    :alt="$t('shell.brand_logo', { brand: runtimeConfigStore.config.brandName })"
    @error="customLogoFailed = true"
  />
  <span
    v-else-if="runtimeConfigStore.loaded && variant === 'login'"
    class="text-primary-active max-w-full text-center text-2xl font-medium break-words"
  >
    {{ runtimeConfigStore.config.brandName }}
  </span>
  <span
    v-else-if="runtimeConfigStore.loaded"
    v-bind="$attrs"
    class="text-primary-active flex max-w-full min-w-0 items-center text-xl font-medium"
  >
    <span class="min-w-0 truncate">{{ runtimeConfigStore.config.brandName }}</span>
  </span>
</template>
