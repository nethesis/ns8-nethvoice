<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import { NeInlineNotification, NeModal } from '@nethesis/vue-components'
import { getAdminErrorCode, removeAdmin, type AdminAccount } from '@/lib/admins/admins'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { useInvalidateAdmins } from '@/queries/admins/admins'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, admin = undefined } = defineProps<{
  visible: boolean
  admin: AdminAccount | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateAdmins = useInvalidateAdmins()

useFocusReturn(() => visible)

const { mutate, isLoading, error, reset } = useMutation({
  mutation: (target: AdminAccount) => removeAdmin(target.username),
  onSuccess(_data, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('admin_control.admin_removed'),
        description: t('admin_control.admin_removed_description', { name: target.username }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => invalidateAdmins(),
})

const isLocal = computed(() => admin?.source === 'local')

const errorDescription = computed(() => {
  const code = getAdminErrorCode(error.value)
  return code ? t(`admin_control.error_${code}`) : describeError(error.value)
})

watch(
  () => visible,
  () => {
    if (visible) {
      reset()
    }
  },
)

function requestClose() {
  if (!isLoading.value) {
    emit('close')
  }
}

function confirmRemove() {
  if (admin) {
    mutate(admin)
  }
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('admin_control.remove_admin')"
    kind="warning"
    :primary-label="t('common.remove')"
    :cancel-label="t('common.cancel')"
    primary-button-kind="danger"
    :primary-button-disabled="isLoading"
    :primary-button-loading="isLoading"
    :close-aria-label="t('common.close')"
    @close="requestClose"
    @primary-click="confirmRemove"
  >
    <div class="flex flex-col gap-3">
      <p>{{ t('admin_control.remove_admin_confirmation', { name: admin?.username ?? '' }) }}</p>
      <p>
        {{
          isLocal ? t('admin_control.remove_admin_local') : t('admin_control.remove_admin_domain')
        }}
      </p>
    </div>
    <NeInlineNotification
      v-if="error"
      kind="error"
      :title="t('admin_control.cannot_remove_admin')"
      :description="errorDescription"
      class="mt-4"
    />
  </NeModal>
</template>
