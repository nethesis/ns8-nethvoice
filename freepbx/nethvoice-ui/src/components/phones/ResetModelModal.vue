<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeInlineNotification, NeModal } from '@nethesis/vue-components'
import {
  PHONE_MODEL_KEY,
  PHONE_MODELS_KEY,
  resetPhoneModel,
  type PhoneModel,
} from '@/lib/phones/models'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, model = undefined } = defineProps<{
  visible?: boolean
  model?: PhoneModel
}>()

const emit = defineEmits<{ close: []; reset: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const {
  mutate: resetMutate,
  isLoading: resetting,
  reset: resetMutationReset,
  error: resetError,
} = useMutation({
  mutation: (target: PhoneModel) => resetPhoneModel(target.name),
  onSuccess(_data, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('phones.models.model_reset'),
        description: t('phones.models.model_reset_description', { name: target.displayName }),
      })
    }, 500)
    emit('reset')
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_MODELS_KEY] })
    queryCache.invalidateQueries({ key: [PHONE_MODEL_KEY] })
  },
})

watch(
  () => visible,
  (shown) => {
    if (shown) {
      resetMutationReset()
    }
  },
)

function confirmReset() {
  if (model) {
    resetMutate(model)
  }
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="$t('phones.models.reset_to_original_settings')"
    kind="warning"
    :primary-label="$t('phones.models.reset')"
    :cancel-label="$t('common.cancel')"
    primary-button-kind="danger"
    :primary-button-disabled="resetting"
    :primary-button-loading="resetting"
    :close-aria-label="$t('common.close')"
    @close="emit('close')"
    @primary-click="confirmReset"
  >
    <p>{{ $t('phones.models.reset_confirmation', { name: model?.displayName ?? '' }) }}</p>
    <NeInlineNotification
      v-if="resetError"
      kind="error"
      :title="$t('phones.models.cannot_reset_model')"
      :description="describeError(resetError)"
      class="mt-4"
    />
  </NeModal>
</template>
