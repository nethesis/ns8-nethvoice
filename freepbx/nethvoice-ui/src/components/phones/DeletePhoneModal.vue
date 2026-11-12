<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { USERS_KEY } from '@/lib/users/users'
import { formatMac } from '@/lib/phones/mac'
import { PHONE_MODELS_KEY } from '@/lib/phones/models'
import { PHONE_ENCRYPTION_KEY } from '@/lib/phones/encryption'
import { deletePhone, PHONES_KEY, type Phone } from '@/lib/phones/phones'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { visible = false, phone = undefined } = defineProps<{
  visible?: boolean
  phone?: Phone
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const {
  mutate: deletePhoneMutate,
  isLoading: deleting,
  reset: deletePhoneReset,
  error: deletePhoneError,
} = useMutation({
  mutation: (target: Phone) => deletePhone(target),
  onSuccess(_data, target) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('phones.inventory.phone_deleted'),
        description: t('common.object_deleted_successfully', { name: formatMac(target.mac) }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONES_KEY] })
    queryCache.invalidateQueries({ key: [PHONE_MODELS_KEY] })
    queryCache.invalidateQueries({ key: [USERS_KEY] })
    queryCache.invalidateQueries({ key: [PHONE_ENCRYPTION_KEY] })
  },
})

watch(
  () => visible,
  (shown) => {
    if (shown) {
      deletePhoneReset()
    }
  },
)

function confirmDelete() {
  if (phone) {
    deletePhoneMutate(phone)
  }
}
</script>

<template>
  <DeleteObjectModal
    :visible="visible"
    :title="$t('phones.inventory.delete_phone')"
    :primary-label="$t('common.delete')"
    :deleting="deleting"
    :error-title="deletePhoneError ? $t('phones.inventory.cannot_delete_phone') : ''"
    :error-description="describeError(deletePhoneError)"
    @close="emit('close')"
    @primary-click="confirmDelete"
  >
    <p>
      {{
        phone?.user
          ? $t('phones.inventory.delete_assigned_phone_confirmation', {
              mac: formatMac(phone.mac),
              user: phone.user.displayName,
            })
          : $t('phones.inventory.delete_phone_confirmation', {
              mac: phone ? formatMac(phone.mac) : '',
            })
      }}
    </p>
  </DeleteObjectModal>
</template>
