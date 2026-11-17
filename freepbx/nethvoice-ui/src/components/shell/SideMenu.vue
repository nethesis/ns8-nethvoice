<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faHouse as fasHouse,
  faUserGroup as fasUserGroup,
  faNetworkWired as fasNetworkWired,
  faRoute as fasRoute,
  faCubes as fasCubes,
  faGear as fasGear,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone as fasOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import {
  faHouse as falHouse,
  faUserGroup as falUserGroup,
  faNetworkWired as falNetworkWired,
  faRoute as falRoute,
  faCubes as falCubes,
  faGear as falGear,
  faOfficePhone as falOfficePhone,
} from '@nethesis/nethesis-light-svg-icons'
import type { Section } from '@/lib/permissions/permissions'
import { usePermissions } from '@/queries/permissions/me'

type MenuItem = {
  name: string
  to: Section
  solidIcon: IconDefinition
  lightIcon: IconDefinition
}

const { t } = useI18n()
const route = useRoute()
const { can } = usePermissions()

const navigation: MenuItem[] = [
  { name: 'dashboard.title', to: 'dashboard', solidIcon: fasHouse, lightIcon: falHouse },
  { name: 'users.title', to: 'users', solidIcon: fasUserGroup, lightIcon: falUserGroup },
  { name: 'trunks.title', to: 'trunks', solidIcon: fasNetworkWired, lightIcon: falNetworkWired },
  { name: 'routes.title', to: 'routes', solidIcon: fasRoute, lightIcon: falRoute },
  { name: 'phones.title', to: 'phones', solidIcon: fasOfficePhone, lightIcon: falOfficePhone },
  { name: 'integrations.title', to: 'integrations', solidIcon: fasCubes, lightIcon: falCubes },
  { name: 'settings.title', to: 'settings', solidIcon: fasGear, lightIcon: falGear },
]

const allowedNavigation = computed(() => navigation.filter((item) => can(item.to)))

function isCurrentRoute(itemPath: string) {
  return route.path === `/${itemPath}` || route.path.startsWith(`/${itemPath}/`)
}
</script>

<template>
  <li v-for="item in allowedNavigation" :key="item.to">
    <router-link
      :to="`/${item.to}`"
      :aria-current="isCurrentRoute(item.to) ? 'page' : undefined"
      :class="[
        isCurrentRoute(item.to)
          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
          : 'text-tertiary-neutral dark:text-tertiary-neutral hover:text-gray-900 dark:hover:text-gray-50',
        'group relative flex h-12.5 cursor-pointer items-center gap-x-4 rounded-md px-3 text-base font-medium transition-colors duration-(--duration-small) hover:bg-gray-100 dark:hover:bg-gray-800',
      ]"
    >
      <span
        v-if="isCurrentRoute(item.to)"
        class="bg-primary-700 dark:bg-primary-500 absolute top-1/2 left-0 h-9 w-1 -translate-y-1/2 rounded-r-sm"
        aria-hidden="true"
      />
      <FontAwesomeIcon
        :icon="isCurrentRoute(item.to) ? item.solidIcon : item.lightIcon"
        class="size-6 shrink-0"
        aria-hidden="true"
      />
      {{ t(item.name) }}
    </router-link>
  </li>
</template>
