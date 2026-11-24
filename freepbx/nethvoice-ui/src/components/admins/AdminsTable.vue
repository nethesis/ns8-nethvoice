<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCircleMinus,
  faCirclePlus,
  faCircleXmark,
  faLock,
  faPenToSquare,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeEmptyState,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTooltip,
  type NeDropdownItem,
} from '@nethesis/vue-components'
import { getAdminSections, isFullAccess, type AdminAccount } from '@/lib/admins/admins'

const {
  admins,
  loading = false,
  disabledReason = '',
} = defineProps<{
  admins: AdminAccount[]
  loading?: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{ add: []; edit: [admin: AdminAccount]; remove: [admin: AdminAccount] }>()

const { t } = useI18n()

const isEditable = (admin: AdminAccount) => admin.editable && !disabledReason

const isRemovable = (admin: AdminAccount) => admin.removable && !disabledReason

const readOnlyReason = (admin: AdminAccount) => {
  if (admin.reason) {
    return t(`admin_control.reason_${admin.reason}`)
  }
  return disabledReason || t('admin_control.reason_read_only')
}

const openFromMenu = (open: () => void) => {
  const buttonId = document.activeElement?.closest('[role="menu"]')?.getAttribute('aria-labelledby')
  const button = buttonId ? document.getElementById(buttonId) : null

  setTimeout(() => {
    button?.focus()
    open()
  })
}

const menuItems = (admin: AdminAccount): NeDropdownItem[] => [
  {
    id: 'remove',
    label: t('common.remove'),
    icon: faCircleMinus,
    danger: true,
    action: () => openFromMenu(() => emit('remove', admin)),
  },
]
</script>

<template>
  <NeEmptyState
    v-if="!loading && admins.length === 0"
    :title="t('admin_control.no_admins')"
    :icon="faShieldHalved"
    class="bg-elevation-2"
  >
    <NeButton v-if="!disabledReason" kind="primary" @click="emit('add')">
      <template #prefix>
        <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
      </template>
      {{ t('admin_control.add_admin') }}
    </NeButton>
  </NeEmptyState>
  <NeTable
    v-else
    :aria-label="t('admin_control.administrators')"
    card-breakpoint="lg"
    :loading="loading"
    :skeleton-columns="4"
    :skeleton-rows="4"
  >
    <NeTableHead>
      <NeTableHeadCell>{{ t('common.name') }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t('admin_control.access') }}</NeTableHeadCell>
      <NeTableHeadCell>{{ t('admin_control.source') }}</NeTableHeadCell>
      <NeTableHeadCell>
        <span class="sr-only">{{ t('common.actions') }}</span>
      </NeTableHeadCell>
    </NeTableHead>
    <NeTableBody>
      <NeTableRow
        v-for="admin in admins"
        :key="admin.username"
        :data-testid="`admin-${admin.username}`"
      >
        <NeTableCell :data-label="t('common.name')">
          <div class="flex max-w-xs min-w-0 flex-col">
            <span class="flex min-w-0 flex-wrap items-center gap-2">
              <span
                :class="[
                  'wrap-anywhere',
                  admin.locked === true ? 'text-tertiary-neutral' : 'text-primary-neutral',
                ]"
              >
                {{ admin.displayName || admin.username }}
              </span>
              <NeBadgeV2
                v-if="admin.locked === true"
                kind="gray"
                size="xs"
                class="shrink-0"
                :data-testid="`admin-disabled-${admin.username}`"
              >
                <FontAwesomeIcon :icon="faCircleXmark" class="size-3" aria-hidden="true" />
                {{ t('common.disabled') }}
              </NeBadgeV2>
            </span>
            <span v-if="admin.displayName" class="text-secondary-neutral text-sm wrap-anywhere">
              {{ admin.username }}
            </span>
          </div>
        </NeTableCell>
        <NeTableCell :data-label="t('admin_control.access')">
          <div class="flex flex-wrap gap-1">
            <NeBadgeV2 v-if="isFullAccess(admin.permissions)" kind="indigo" size="xs">
              {{ t('admin_control.full_access') }}
            </NeBadgeV2>
            <NeBadgeV2
              v-for="section in getAdminSections(admin.permissions)"
              v-else
              :key="section"
              kind="blue"
              size="xs"
            >
              {{ t(`${section}.title`) }}
            </NeBadgeV2>
          </div>
        </NeTableCell>
        <NeTableCell :data-label="t('admin_control.source')">
          {{ t(`admin_control.source_${admin.source}`) }}
        </NeTableCell>
        <NeTableCell :data-label="t('common.actions')">
          <div class="-ml-2.5 flex items-center gap-2 lg:ml-0 lg:justify-end">
            <NeButton v-if="isEditable(admin)" kind="tertiary" @click="emit('edit', admin)">
              <template #prefix>
                <FontAwesomeIcon :icon="faPenToSquare" class="size-4" aria-hidden="true" />
              </template>
              {{ t('common.edit') }}
              <span class="sr-only">{{ admin.username }}</span>
            </NeButton>
            <NeTooltip v-else trigger-event="mouseenter focus">
              <template #trigger>
                <span
                  tabindex="0"
                  class="text-secondary-neutral focus:ring-primary-500 dark:focus:ring-primary-300 ml-2.5 flex items-center gap-2 rounded-sm focus:ring-2 focus:outline-hidden lg:ml-0"
                  :data-testid="`admin-read-only-${admin.username}`"
                >
                  <FontAwesomeIcon :icon="faLock" class="size-4" aria-hidden="true" />
                  {{ t('admin_control.read_only') }}
                  <span class="sr-only">{{ readOnlyReason(admin) }}</span>
                </span>
              </template>
              <template #content>{{ readOnlyReason(admin) }}</template>
            </NeTooltip>
            <NeDropdown
              v-if="isRemovable(admin)"
              :items="menuItems(admin)"
              :align-to-right="true"
              :open-menu-aria-label="t('admin_control.admin_actions', { name: admin.username })"
            />
          </div>
        </NeTableCell>
      </NeTableRow>
    </NeTableBody>
  </NeTable>
</template>
