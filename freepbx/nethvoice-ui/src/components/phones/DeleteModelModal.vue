<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { deletePhoneModel, PHONE_MODELS_KEY, type PhoneModel } from '@/lib/phones/models'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, model = undefined } = defineProps<{
  visible?: boolean
  model?: PhoneModel
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
  mutation: (target: PhoneModel) => deletePhoneModel(target.name),
  onSuccess(_data, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('phones.models.model_deleted'),
        description: t('common.object_deleted_successfully', { name: target.displayName }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_MODELS_KEY] })
  },
})

watch(
  () => visible,
  (shown) => {
    if (shown) {
      deleteReset()
    }
  },
)

function confirmDelete() {
  if (model) {
    deleteMutate(model)
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="$t('phones.models.delete_model')"
    :primary-label="$t('common.delete')"
    :deleting="deleting"
    :confirmation-message="
      $t('phones.models.delete_model_confirmation', { name: model?.displayName ?? '' })
    "
    :error-title="deleteError ? $t('phones.models.cannot_delete_model') : ''"
    :error-description="describeError(deleteError)"
    @close="emit('close')"
    @primary-click="confirmDelete"
  />
</template>
