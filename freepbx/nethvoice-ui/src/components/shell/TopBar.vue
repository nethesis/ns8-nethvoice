<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { NeAvatar, NeDropdown, NeTooltip } from '@nethesis/vue-components'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useDensityStore } from '@/stores/density'
import { useLoginStore } from '@/stores/login'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'
import {
  faArrowRightFromBracket,
  faAward,
  faBars,
  faBell,
  faCircleQuestion,
  faClockRotateLeft,
  faGear,
  faMoon,
  faSun,
  faTableCells,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import { LEGACY_WIZARD_URL } from '@/lib/config'
import { useDashboardSubscription } from '@/queries/dashboard/subscription'
import { usePermissions } from '@/queries/permissions/me'

const emit = defineEmits<{ openSidebar: [] }>()

const openSidebarRef = useTemplateRef<HTMLButtonElement>('openSidebarRef')

defineExpose({ focusOpenSidebar: () => openSidebarRef.value?.focus() })

const { t } = useI18n()
const router = useRouter()
const themeStore = useThemeStore()
const densityStore = useDensityStore()
const loginStore = useLoginStore()
const { state: subscriptionState } = useDashboardSubscription()
const isEnterprise = computed(() => subscriptionState.value.data?.plan === 'enterprise')
const runtimeConfigStore = useRuntimeConfigStore()
const notificationsStore = useNotificationsStore()
const { can, isSuperadmin } = usePermissions()

const topBarButtonClasses =
  'flex rounded-full p-2.5 text-secondary-neutral hover:bg-elevation-2 hover:text-primary-neutral transition-colors duration-(--duration-small)'
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
  ...(can('settings')
    ? [
        {
          id: 'settings',
          label: t('settings.title'),
          icon: faGear,
          action: () => router.push({ name: 'settings' }),
        },
      ]
    : []),
  ...(isSuperadmin.value
    ? [
        {
          id: 'legacyWizard',
          label: t('shell.open_legacy_wizard'),
          icon: faClockRotateLeft,
          action: () => window.location.assign(LEGACY_WIZARD_URL),
        },
      ]
    : []),
  {
    id: 'switchDensity',
    label: densityStore.isCompact
      ? t('shell.switch_to_standard_view')
      : t('shell.switch_to_compact_view'),
    icon: densityStore.isCompact ? faTableCellsLarge : faTableCells,
    action: () => densityStore.toggleDensity(),
  },
  {
    id: 'switchTheme',
    label: themeStore.isLight ? t('shell.switch_to_dark_theme') : t('shell.switch_to_light_theme'),
    icon: themeStore.isLight ? faMoon : faSun,
    action: () => themeStore.toggleTheme(),
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
    <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex lg:hidden">
      <template #trigger>
        <button
          ref="openSidebarRef"
          type="button"
          class="text-tertiary-neutral hover:bg-elevation-2 hover:text-primary-neutral -mx-2.5 rounded-full p-2.5 transition-colors duration-(--duration-small)"
          @click="emit('openSidebar')"
        >
          <span class="sr-only">{{ $t('shell.open_sidebar') }}</span>
          <FontAwesomeIcon :icon="faBars" class="h-6 w-6 shrink-0" aria-hidden="true" />
        </button>
      </template>
      <template #content>{{ $t('shell.open_sidebar') }}</template>
    </NeTooltip>

    <div class="h-6 w-px bg-gray-200 lg:hidden dark:bg-gray-700" aria-hidden="true" />

    <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
      <div class="relative flex flex-1 items-center"></div>
      <div class="flex items-center gap-x-4 self-stretch">
        <NeTooltip
          v-if="isEnterprise"
          trigger-event="mouseenter focus"
          placement="bottom"
          class="hidden min-w-0 sm:flex"
        >
          <template #trigger>
            <p
              class="text-secondary-neutral flex min-w-0 items-center gap-2 text-sm"
              data-testid="topbar-subscription"
            >
              <FontAwesomeIcon :icon="faAward" class="size-4 shrink-0" aria-hidden="true" />
              <span class="sr-only">{{ $t('shell.enterprise_instance') }}:</span>
              <span class="truncate">{{ runtimeConfigStore.instanceLabel }}</span>
            </p>
          </template>
          <template #content>{{ $t('shell.enterprise_instance') }}</template>
        </NeTooltip>
        <div
          class="hidden w-px self-stretch bg-gray-200 lg:block dark:bg-gray-700"
          aria-hidden="true"
        />

        <div class="-mr-2.5 flex items-center gap-x-1">
          <NeTooltip
            v-if="runtimeConfigStore.showDocs"
            trigger-event="mouseenter focus"
            placement="bottom"
            class="flex"
          >
            <template #trigger>
              <a
                :href="runtimeConfigStore.docsUrl"
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
              {{ $t('shell.show_notifications') }}
            </template>
          </NeTooltip>

          <NeTooltip trigger-event="mouseenter focus" placement="bottom" class="flex">
            <template #trigger>
              <NeDropdown
                :items="accountMenuOptions"
                :align-to-right="true"
                :open-menu-aria-label="$t('shell.open_account_menu')"
                menu-classes="z-150!"
                class="relative *:focus-visible:outline-hidden"
              >
                <template #button>
                  <span
                    class="in-focus-visible:ring-primary-500 dark:in-focus-visible:ring-primary-300 flex rounded-full p-1 in-focus-visible:ring-2"
                    data-testid="account-menu"
                    aria-hidden="true"
                  >
                    <NeAvatar size="sm" :initials="initials" :alt="loginStore.username" />
                  </span>
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
