<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeDropdown, NeTooltip } from '@nethesis/vue-components'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useLoginStore } from '@/stores/login'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import {
  faArrowRightFromBracket,
  faBars,
  faBell,
  faCircleQuestion,
  faClockRotateLeft,
  faGear,
  faMoon,
  faSun,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import { LEGACY_WIZARD_URL } from '@/lib/config'

const emit = defineEmits<{ openSidebar: [] }>()

const { t } = useI18n()
const router = useRouter()
const themeStore = useThemeStore()
const loginStore = useLoginStore()
const runtimeConfigStore = useRuntimeConfigStore()
const notificationsStore = useNotificationsStore()

const topBarButtonClasses =
  'flex rounded-full p-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-50 transition-colors duration-(--duration-small)'
const shakeNotificationsIcon = ref(false)

const initials = computed(() =>
  loginStore.username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(''),
)

const accountMenuOptions = computed(() => [
  {
    id: 'settings',
    label: t('settings.title'),
    icon: faGear,
    action: () => router.push({ name: 'settings' }),
  },
  {
    id: 'legacyWizard',
    label: t('shell.open_legacy_wizard'),
    icon: faClockRotateLeft,
    action: () => window.location.assign(LEGACY_WIZARD_URL),
  },
  { id: 'divider' },
  {
    id: 'logout',
    label: t('shell.sign_out'),
    icon: faArrowRightFromBracket,
    action: signOut,
  },
])

watch(
  () => notificationsStore.numNotifications,
  (newNum, oldNum) => {
    if (newNum > oldNum) {
      setTimeout(() => {
        shakeNotificationsIcon.value = true
      }, 700)

      setTimeout(() => {
        shakeNotificationsIcon.value = false
      }, 2700)
    }
  },
)

async function signOut() {
  await loginStore.logout()
  router.push({ name: 'login' })
}

function openNotificationsDrawer() {
  notificationsStore.setNotificationDrawerOpen(true)
}
</script>

<template>
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 sm:gap-x-6 sm:px-6 lg:px-8 dark:border-gray-700 dark:bg-gray-950"
  >
    <button
      type="button"
      class="text-tertiary-neutral dark:text-tertiary-neutral -mx-2.5 rounded-full p-2.5 transition-colors duration-(--duration-small) hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:hover:bg-gray-800 dark:hover:text-gray-50"
      @click="emit('openSidebar')"
    >
      <span class="sr-only">{{ $t('shell.open_sidebar') }}</span>
      <FontAwesomeIcon :icon="faBars" class="h-6 w-6 shrink-0" aria-hidden="true" />
    </button>

    <div class="h-6 w-px bg-gray-200 lg:hidden dark:bg-gray-700" aria-hidden="true" />

    <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
      <div class="relative flex flex-1 items-center"></div>
      <div class="flex items-center gap-x-4">
        <div
          class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-gray-700"
          aria-hidden="true"
        />

        <div class="-mr-2.5 flex items-center gap-x-1">
          <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex">
            <template #trigger>
              <a
                :href="runtimeConfigStore.config.docsUrl"
                target="_blank"
                rel="noreferrer"
                :class="[topBarButtonClasses, 'items-center gap-3']"
              >
                <span class="sr-only">{{ $t('shell.help') }}</span>
                <FontAwesomeIcon
                  :icon="faCircleQuestion"
                  class="h-6 w-6 shrink-0"
                  aria-hidden="true"
                />
              </a>
            </template>
            <template #content>
              {{ $t('shell.help') }}
            </template>
          </NeTooltip>

          <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex">
            <template #trigger>
              <button
                type="button"
                :class="topBarButtonClasses"
                data-testid="theme-toggle"
                @click="themeStore.toggleTheme()"
              >
                <span class="sr-only">{{
                  themeStore.isLight
                    ? $t('shell.switch_to_dark_theme')
                    : $t('shell.switch_to_light_theme')
                }}</span>
                <FontAwesomeIcon
                  :icon="themeStore.isLight ? faMoon : faSun"
                  class="h-6 w-6 shrink-0"
                  aria-hidden="true"
                />
              </button>
            </template>
            <template #content>
              {{
                themeStore.isLight
                  ? $t('shell.switch_to_dark_theme')
                  : $t('shell.switch_to_light_theme')
              }}
            </template>
          </NeTooltip>

          <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex">
            <template #trigger>
              <button type="button" :class="topBarButtonClasses" @click="openNotificationsDrawer">
                <span class="sr-only">{{ $t('shell.show_notifications') }}</span>
                <FontAwesomeIcon
                  :icon="faBell"
                  :class="['h-6 w-6 shrink-0', { 'fa-shake': shakeNotificationsIcon }]"
                  aria-hidden="true"
                />
              </button>
            </template>
            <template #content>
              {{ $t('notifications.title') }}
            </template>
          </NeTooltip>

          <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex">
            <template #trigger>
              <NeDropdown
                :items="accountMenuOptions"
                :align-to-right="true"
                :open-menu-aria-label="$t('shell.open_account_menu')"
                menu-classes="z-150!"
                class="relative"
              >
                <template #button>
                  <button type="button" class="flex rounded-full p-1" data-testid="account-menu">
                    <span class="sr-only">{{ $t('shell.open_account_menu') }}</span>
                    <span
                      class="flex size-8 items-center justify-center rounded-full bg-gray-700 text-sm text-gray-50 uppercase dark:bg-gray-200 dark:text-gray-900"
                      aria-hidden="true"
                    >
                      {{ initials }}
                    </span>
                  </button>
                </template>
                <template #menuHeader>
                  <div class="px-4 py-3">
                    <p class="text-primary-neutral text-sm font-medium">
                      {{ loginStore.username }}
                    </p>
                    <p class="text-secondary-neutral text-xs">{{ $t('shell.administrator') }}</p>
                  </div>
                  <hr class="my-1" />
                </template>
              </NeDropdown>
            </template>
            <template #content>
              {{ $t('shell.account') }}
            </template>
          </NeTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
