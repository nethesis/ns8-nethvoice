<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import {
  NeButton,
  NeCard,
  NeHeading,
  NeInlineNotification,
  NeSpinner,
} from '@nethesis/vue-components'
import AdminDrawer from '@/components/admins/AdminDrawer.vue'
import AdminsTable from '@/components/admins/AdminsTable.vue'
import RemoveAdminModal from '@/components/admins/RemoveAdminModal.vue'
import ClickToCopy from '@/components/common/ClickToCopy.vue'
import LoadError from '@/components/common/LoadError.vue'
import { useUpdatingIndicator } from '@/composables/useUpdatingIndicator'
import type { AdminAccount } from '@/lib/admins/admins'
import { SECTIONS, SUPERADMIN, type Permission } from '@/lib/permissions/permissions'
import { useAdminControl } from '@/queries/admins/admins'
import { useRuntimeConfigStore } from '@/stores/runtimeConfig'

const { t } = useI18n()
const runtimeConfigStore = useRuntimeConfigStore()
const { state, asyncStatus, refetch } = useAdminControl()

const currentAdmin = ref<AdminAccount | undefined>()
const isShownDrawer = ref(false)
const isShownRemoveModal = ref(false)

const control = computed(() => state.value.data)
const admins = computed(() => control.value?.admins ?? [])
const loading = computed(() => state.value.status === 'pending')
const loadError = computed(() => (state.value.status === 'error' ? state.value.error : null))

const isUpdatingShown = useUpdatingIndicator(
  () => state.value.status === 'success' && asyncStatus.value === 'loading',
)

const disabledReason = computed(() => {
  if (!control.value || control.value.manageable) {
    return ''
  }
  return control.value.reason === 'external'
    ? t('admin_control.reason_external')
    : t('admin_control.reason_unavailable')
})

const groupRows = computed(() => {
  const groups = control.value?.groups

  if (!groups) {
    return []
  }
  const permissions: Permission[] = [SUPERADMIN, ...SECTIONS]

  return permissions
    .filter((permission) => groups[permission])
    .map((permission) => ({
      permission,
      label: permission === SUPERADMIN ? t('admin_control.full_access') : t(`${permission}.title`),
      group: groups[permission],
    }))
})

function showAddDrawer() {
  currentAdmin.value = undefined
  isShownDrawer.value = true
}

function showEditDrawer(admin: AdminAccount) {
  currentAdmin.value = admin
  isShownDrawer.value = true
}

function showRemoveModal(admin: AdminAccount) {
  currentAdmin.value = admin
  isShownRemoveModal.value = true
}
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div class="flex max-w-3xl flex-col gap-2">
        <NeHeading tag="h3">{{ t('admin_control.title') }}</NeHeading>
        <p class="text-secondary-neutral">
          {{ t('admin_control.description', { brand: runtimeConfigStore.config.brandName }) }}
        </p>
      </div>
      <NeButton
        v-if="!loadError"
        kind="primary"
        size="lg"
        class="shrink-0"
        :disabled="loading || disabledReason !== ''"
        @click="showAddDrawer"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faCirclePlus" class="size-4" aria-hidden="true" />
        </template>
        {{ t('admin_control.add_admin') }}
      </NeButton>
    </div>
    <LoadError
      v-if="loadError"
      :error="loadError"
      :title="t('admin_control.cannot_retrieve_admins')"
      @retry="refetch()"
    />
    <div v-else class="flex flex-col gap-8">
      <NeInlineNotification
        v-if="control && !control.manageable"
        :kind="control.reason === 'external' ? 'info' : 'warning'"
        :title="
          control.reason === 'external'
            ? t('admin_control.external_title')
            : t('admin_control.unavailable_title')
        "
        :description="disabledReason"
        data-testid="admin-control-not-manageable"
      />
      <div class="flex flex-col gap-4">
        <div
          v-if="isUpdatingShown"
          role="status"
          class="text-tertiary-neutral flex items-center gap-2 text-sm"
        >
          <NeSpinner color="gray" size="4" />
          <span>{{ t('admin_control.updating') }}</span>
        </div>
        <AdminsTable
          :admins="admins"
          :loading="loading"
          :disabled-reason="disabledReason"
          @add="showAddDrawer"
          @edit="showEditDrawer"
          @remove="showRemoveModal"
        />
      </div>
      <NeCard
        v-if="control && control.reason !== 'external' && groupRows.length > 0"
        :title="t('admin_control.domain_groups')"
        :description="t('admin_control.domain_groups_description')"
        data-testid="admin-control-groups"
      >
        <dl class="mt-4 flex flex-col gap-3">
          <div
            v-for="row in groupRows"
            :key="row.permission"
            class="flex flex-col gap-1 sm:flex-row sm:gap-6"
          >
            <dt class="text-secondary-neutral shrink-0 text-sm sm:w-48">{{ row.label }}</dt>
            <dd class="text-primary-neutral min-w-0 text-sm wrap-anywhere">
              <ClickToCopy :text="row.group" />
            </dd>
          </div>
        </dl>
      </NeCard>
    </div>
    <AdminDrawer
      :is-shown="isShownDrawer"
      :current-admin="currentAdmin"
      :admins="admins"
      @close="isShownDrawer = false"
    />
    <RemoveAdminModal
      :visible="isShownRemoveModal"
      :admin="currentAdmin"
      @close="isShownRemoveModal = false"
    />
  </div>
</template>
