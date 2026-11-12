<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeModal } from '@nethesis/vue-components'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  visible = false,
  title,
  objectName,
  confirmationMessage,
  successTitle,
  errorTitle,
  deleteObject,
  invalidateKeys,
  blockedBy = [],
  blockedMessage = '',
} = defineProps<{
  visible: boolean
  title: string
  objectName: string
  confirmationMessage: string
  successTitle: string
  errorTitle: string
  deleteObject: () => Promise<void>
  invalidateKeys: string[]
  blockedBy?: string[]
  blockedMessage?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const {
  mutate: deleteMutate,
  isLoading: deleting,
  reset: deleteReset,
  error: deleteError,
} = useMutation({
  mutation: async (name: string) => {
    await deleteObject()
    return name
  },
  onSuccess(name) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: successTitle,
        description: t('common.object_deleted_successfully', { name }),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    for (const key of invalidateKeys) {
      queryCache.invalidateQueries({ key: [key] })
    }
  },
})

watch(
  () => visible,
  () => {
    if (visible) {
      deleteReset()
    }
  },
)
</script>

<template>
  <NeModal
    v-if="blockedBy.length > 0"
    :visible="visible"
    :title="title"
    kind="warning"
    :primary-label="t('common.delete')"
    :cancel-label="t('common.cancel')"
    primary-button-kind="danger"
    primary-button-disabled
    :close-aria-label="t('common.close')"
    @close="emit('close')"
  >
    <p>{{ blockedMessage }}</p>
    <ul class="mt-2 list-inside list-disc">
      <li v-for="name in blockedBy" :key="name">{{ name }}</li>
    </ul>
  </NeModal>
  <DeleteObjectModal
    v-else
    :visible="visible"
    :title="title"
    :primary-label="t('common.delete')"
    :deleting="deleting"
    :confirmation-message="confirmationMessage"
    :error-title="deleteError ? errorTitle : ''"
    :error-description="getLegacyStatusMessage(deleteError) || describeError(deleteError)"
    @close="emit('close')"
    @primary-click="deleteMutate(objectName)"
  />
</template>
