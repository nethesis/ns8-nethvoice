<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import TrunkRoutesWarning from './TrunkRoutesWarning.vue'
import {
  deleteGateway,
  describeGatewayError,
  GATEWAYS_KEY,
  type Gateway,
} from '@/lib/trunks/gateways'
import { TRUNKS_KEY } from '@/lib/trunks/trunks'
import { TRUNKS_LIVE_STATE_KEY } from '@/lib/trunks/liveState'
import { FXS_USERS_KEY } from '@/lib/trunks/fxsUsers'
import { OUTBOUND_ROUTES_KEY } from '@/lib/routes/outbound'
import { useFocusReturn } from '@/composables/useFocusReturn'
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

useFocusReturn(() => visible)

const trunkIds = computed(() => gateway?.trunkIds ?? [])

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
    queryCache.invalidateQueries({ key: [OUTBOUND_ROUTES_KEY] })
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

function requestClose() {
  if (!deleting.value) {
    emit('close')
  }
}

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
    @close="requestClose"
    @primary-click="confirmDelete"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <p>{{ t('trunks.physical.delete_confirmation', { name: label }) }}</p>
        <p>{{ t('trunks.physical.delete_confirmation_details') }}</p>
      </div>
      <TrunkRoutesWarning :is-shown="visible" :trunk-ids="trunkIds" />
    </div>
  </DeleteObjectModal>
</template>
