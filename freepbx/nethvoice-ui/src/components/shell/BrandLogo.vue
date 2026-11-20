<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import LogoLight from '@/assets/logo_light.svg'
import LogoDark from '@/assets/logo_dark.svg'

const { variant = 'navbar' } = defineProps<{
  variant?: 'navbar' | 'login'
}>()

const themeStore = useThemeStore()
const runtimeConfigStore = useRuntimeConfigStore()

const customLogoFailed = ref(false)

const customLogo = computed(() =>
  variant === 'login'
    ? runtimeConfigStore.config.loginLogoUrl
    : runtimeConfigStore.config.navbarLogoUrl,
)

const logoUrl = computed(() => {
  if (customLogo.value && !customLogoFailed.value) {
    return customLogo.value
  }
  return themeStore.isLight ? LogoLight : LogoDark
})

watch(customLogo, () => {
  customLogoFailed.value = false
})
</script>

<template>
  <img
    :src="logoUrl"
    :alt="$t('shell.brand_logo', { brand: runtimeConfigStore.config.brandName })"
    @error="customLogoFailed = true"
  />
</template>
