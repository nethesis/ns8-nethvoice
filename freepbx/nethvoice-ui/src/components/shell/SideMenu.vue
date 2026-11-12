<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
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

type MenuItem = {
  name: string
  to: string
  solidIcon: IconDefinition
  lightIcon: IconDefinition
}

const { t } = useI18n()
const route = useRoute()

const navigation: MenuItem[] = [
  { name: 'dashboard.title', to: 'dashboard', solidIcon: fasHouse, lightIcon: falHouse },
  { name: 'users.title', to: 'users', solidIcon: fasUserGroup, lightIcon: falUserGroup },
  { name: 'trunks.title', to: 'trunks', solidIcon: fasNetworkWired, lightIcon: falNetworkWired },
  { name: 'routes.title', to: 'routes', solidIcon: fasRoute, lightIcon: falRoute },
  { name: 'phones.title', to: 'phones', solidIcon: fasOfficePhone, lightIcon: falOfficePhone },
  { name: 'integrations.title', to: 'integrations', solidIcon: fasCubes, lightIcon: falCubes },
  { name: 'settings.title', to: 'settings', solidIcon: fasGear, lightIcon: falGear },
]

function isCurrentRoute(itemPath: string) {
  return route.path === `/${itemPath}` || route.path.startsWith(`/${itemPath}/`)
}
</script>

<template>
  <li v-for="item in navigation" :key="item.to">
    <router-link
      :to="`/${item.to}`"
      :aria-current="isCurrentRoute(item.to) ? 'page' : undefined"
      :class="[
        isCurrentRoute(item.to)
          ? 'border-primary-700 dark:border-primary-500 bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
          : 'text-tertiary-neutral dark:text-tertiary-neutral border-transparent hover:text-gray-900 dark:hover:text-gray-50',
        'group flex cursor-pointer items-center gap-x-3 rounded-md border-l-4 px-3 py-2 text-sm leading-6 font-medium transition-colors duration-(--duration-small) hover:bg-gray-100 dark:hover:bg-gray-800',
      ]"
    >
      <FontAwesomeIcon
        :icon="isCurrentRoute(item.to) ? item.solidIcon : item.lightIcon"
        class="h-6 w-8 shrink-0"
        aria-hidden="true"
      />
      {{ t(item.name) }}
    </router-link>
  </li>
</template>
