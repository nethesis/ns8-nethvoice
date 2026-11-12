<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { deleteTrunk, TRUNKS_KEY, type Trunk } from '@/lib/trunks/trunks'
import { TRUNKS_LIVE_STATE_KEY } from '@/lib/trunks/liveState'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, trunk = undefined } = defineProps<{
  visible: boolean
  trunk: Trunk | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const {
  mutate: deleteTrunkMutate,
  isLoading: deleting,
  reset,
  error,
} = useMutation({
  mutation: (item: Trunk) => deleteTrunk(item.id),
  onSuccess(_data, item) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('trunks.trunk_deleted'),
        description: t('common.object_deleted_successfully', { name: item.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [TRUNKS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_LIVE_STATE_KEY] })
  },
})

watch(
  () => visible,
  (isVisible) => {
    if (isVisible) {
      reset()
    }
  },
)

function confirmDelete() {
  if (trunk) {
    deleteTrunkMutate(trunk)
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('trunks.delete_trunk')"
    :primary-label="t('common.delete')"
    :deleting="deleting"
    :confirmation-message="t('trunks.voip.delete_confirmation', { name: trunk?.name ?? '' })"
    :error-title="error ? t('trunks.cannot_delete_trunk') : ''"
    :error-description="describeError(error)"
    @close="emit('close')"
    @primary-click="confirmDelete"
  />
</template>
