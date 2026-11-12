<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import LogoLight from '@/assets/logo_light.svg'
import LogoDark from '@/assets/logo_dark.svg'

const { variant = 'navbar' } = defineProps<{
  variant?: 'navbar' | 'login'
}>()

const themeStore = useThemeStore()
const runtimeConfigStore = useRuntimeConfigStore()

const logoUrl = computed(() => {
  const customLogo =
    variant === 'login'
      ? runtimeConfigStore.config.loginLogoUrl
      : runtimeConfigStore.config.navbarLogoUrl

  if (customLogo) {
    return customLogo
  }
  return themeStore.isLight ? LogoLight : LogoDark
})
</script>

<template>
  <img
    :src="logoUrl"
    :alt="$t('shell.brand_logo', { brand: runtimeConfigStore.config.brandName })"
  />
</template>
