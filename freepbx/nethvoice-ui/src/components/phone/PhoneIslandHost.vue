<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { PHONE_ISLAND_EVENT_NAMES } from '@/lib/adminPhone/adminPhone'
import type { PhoneIslandInstance } from '@/lib/adminPhone/phoneIslandRuntime'
import { useAdminPhoneStore } from '@/stores/adminPhone'
import { useThemeStore } from '@/stores/theme'

const adminPhoneStore = useAdminPhoneStore()
const container = useTemplateRef<HTMLDivElement>('container')
const themeStore = useThemeStore()

const PHONE_ISLAND_THEME_KEY = 'phone-island-theme-selected'

const islandTheme = () => (themeStore.isLight ? 'light' : 'dark')

const storeIslandTheme = () => {
  try {
    localStorage.setItem(PHONE_ISLAND_THEME_KEY, JSON.stringify({ themeSelected: islandTheme() }))
  } catch {
    return
  }
}

watch(
  () => themeStore.isLight,
  () => {
    storeIslandTheme()
    window.dispatchEvent(
      new CustomEvent('phone-island-theme-change', { detail: { selectedTheme: islandTheme() } }),
    )
  },
)

let instance: PhoneIslandInstance | null = null
let mountRequest = 0

const unmountIsland = () => {
  mountRequest += 1
  instance?.unmount()
  instance = null
}

const mountIsland = async (dataConfig: string, displayName: string) => {
  const request = mountRequest

  try {
    const { mountPhoneIsland } = await import('@/lib/adminPhone/phoneIslandRuntime')

    if (request !== mountRequest || !container.value) {
      return
    }
    storeIslandTheme()
    instance = mountPhoneIsland(container.value, { dataConfig, displayName })
  } catch (error) {
    if (request === mountRequest) {
      adminPhoneStore.fail(error)
    }
  }
}

watch(
  [() => adminPhoneStore.dataConfig, container],
  ([dataConfig, element]) => {
    unmountIsland()

    if (dataConfig && element) {
      void mountIsland(dataConfig, adminPhoneStore.displayName)
    }
  },
  { immediate: true },
)

for (const name of PHONE_ISLAND_EVENT_NAMES) {
  useEventListener(window, name, (event: Event) => {
    adminPhoneStore.handleIslandEvent(name, event instanceof CustomEvent ? event.detail : null)
  })
}

onBeforeUnmount(() => {
  unmountIsland()
  adminPhoneStore.disable()
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="container"
      class="pointer-events-none fixed inset-0 z-110"
      data-testid="phone-island-host"
    />
  </Teleport>
</template>
