<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import {
  deleteGateway,
  describeGatewayError,
  GATEWAYS_KEY,
  type Gateway,
} from '@/lib/trunks/gateways'
import { TRUNKS_KEY } from '@/lib/trunks/trunks'
import { TRUNKS_LIVE_STATE_KEY } from '@/lib/trunks/liveState'
import { FXS_USERS_KEY } from '@/lib/trunks/fxsUsers'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  visible = false,
  gateway = undefined,
  label = '',
} = defineProps<{
  visible: boolean
  gateway: Gateway | undefined
  label: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const {
  mutate: deleteGatewayMutate,
  isLoading: deleting,
  reset,
  error,
} = useMutation({
  mutation: (item: Gateway) => deleteGateway(item.id),
  onSuccess(_data, item) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('trunks.trunk_deleted'),
        description: t('common.object_deleted_successfully', { name: label || item.name }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [GATEWAYS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_LIVE_STATE_KEY] })
    queryCache.invalidateQueries({ key: [FXS_USERS_KEY] })
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
  if (gateway) {
    deleteGatewayMutate(gateway)
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="t('trunks.delete_trunk')"
    :primary-label="t('common.delete')"
    :deleting="deleting"
    :error-title="error ? t('trunks.cannot_delete_trunk') : ''"
    :error-description="describeGatewayError(error) || describeError(error)"
    @close="emit('close')"
    @primary-click="confirmDelete"
  >
    <p>{{ t('trunks.physical.delete_confirmation', { name: label }) }}</p>
    <p class="mt-2">{{ t('trunks.physical.delete_confirmation_details') }}</p>
  </DeleteObjectModal>
</template>
