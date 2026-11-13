<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeButton, NeCheckbox, NeSideDrawer } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import DeleteObjectModal from '@/components/common/DeleteObjectModal.vue'
import { PHONES_KEY } from '@/lib/phones/phones'
import {
  countOrphanPhones,
  getOrphanSoftwareDevices,
  ORPHAN_EXTENSIONS_KEY,
  releaseOrphanExtensions,
  type OrphanExtension,
} from '@/lib/users/orphans'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { isShown = false, orphans = [] } = defineProps<{
  isShown: boolean
  orphans?: OrphanExtension[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const notificationsStore = useNotificationsStore()
const queryCache = useQueryCache()
const invalidateUsers = useInvalidateUsers()

const selected = ref<string[]>([])
const isShownConfirmation = ref(false)

const allSelected = computed(
  () => orphans.length > 0 && orphans.every((orphan) => selected.value.includes(orphan.extension)),
)

const selectedOrphans = computed(() =>
  orphans.filter((orphan) => selected.value.includes(orphan.extension)),
)

const selectedExtensions = computed(() =>
  selectedOrphans.value.map((orphan) => orphan.extension).join(', '),
)

const dateFormat = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }),
)

watch(
  () => isShown,
  (shown) => {
    if (shown) {
      selected.value = []
      isShownConfirmation.value = false
      reset()
    }
  },
)

watch(
  () => orphans,
  (current) => {
    selected.value = selected.value.filter((extension) =>
      current.some((orphan) => orphan.extension === extension),
    )
  },
)

function setSelected(extension: string, value: boolean) {
  selected.value = value
    ? [...selected.value, extension]
    : selected.value.filter((item) => item !== extension)
}

function setAllSelected(value: boolean) {
  selected.value = value ? orphans.map((orphan) => orphan.extension) : []
}

function orphanLabel(orphan: OrphanExtension): string {
  return orphan.displayName === orphan.username
    ? orphan.username
    : `${orphan.displayName} (${orphan.username})`
}

function describeOrphan(orphan: OrphanExtension): string {
  const parts = [t('users.orphan_extension', { extension: orphan.extension })]
  const devices = getOrphanSoftwareDevices(orphan).map((device) => t(`users.device_${device}`))
  const phones = countOrphanPhones(orphan)

  if (devices.length > 0) {
    parts.push(devices.join(', '))
  }

  if (phones > 0) {
    parts.push(t('users.orphan_physical_phones', { count: phones }, phones))
  }

  if (orphan.removedAt) {
    parts.push(t('users.orphan_removed_on', { date: dateFormat.value.format(orphan.removedAt) }))
  }
  return parts.join(' · ')
}

const { mutate, isLoading, error, reset } = useMutation({
  mutation: (extensions: string[]) => releaseOrphanExtensions(extensions),
  onSuccess(_, extensions) {
    isShownConfirmation.value = false
    emit('close')
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.orphan_extensions_deleted'),
        description: t(
          'users.orphan_extensions_deleted_description',
          { extensions: extensions.join(', ') },
          extensions.length,
        ),
      })
    }, 500)
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [ORPHAN_EXTENSIONS_KEY] }).catch(() => undefined)
    queryCache.invalidateQueries({ key: [PHONES_KEY] }).catch(() => undefined)
    invalidateUsers()
  },
})

function showConfirmation() {
  reset()
  isShownConfirmation.value = true
}

function closeConfirmation() {
  if (!isLoading.value) {
    isShownConfirmation.value = false
  }
}

function requestClose() {
  if (!isLoading.value) {
    emit('close')
  }
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('users.orphan_extensions')"
    :close-aria-label="t('common.close')"
    @close="requestClose"
  >
    <div class="flex flex-col gap-6">
      <p class="text-secondary-neutral">{{ t('users.orphan_extensions_description') }}</p>
      <NeCheckbox
        id="orphan-extensions-all"
        :model-value="allSelected"
        :label="t('users.select_all_extensions')"
        :disabled="orphans.length === 0 || isLoading"
        @update:model-value="setAllSelected"
      />
      <ul class="flex flex-col gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <li
          v-for="orphan in orphans"
          :key="orphan.extension"
          :data-testid="`orphan-${orphan.extension}`"
        >
          <NeCheckbox
            :id="`orphan-extension-${orphan.extension}`"
            :model-value="selected.includes(orphan.extension)"
            :label="orphanLabel(orphan)"
            :disabled="isLoading"
            @update:model-value="(value: boolean) => setSelected(orphan.extension, value)"
          >
            <template #description>{{ describeOrphan(orphan) }}</template>
          </NeCheckbox>
        </li>
      </ul>
      <div class="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <NeButton kind="tertiary" :disabled="isLoading" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton
          kind="danger"
          :disabled="selected.length === 0 || isLoading"
          @click="showConfirmation"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faTrash" class="size-4" aria-hidden="true" />
          </template>
          {{ t('users.delete_orphan_extensions') }}
        </NeButton>
      </div>
    </div>
  </NeSideDrawer>
  <DeleteObjectModal
    :visible="isShownConfirmation"
    :title="t('users.delete_orphan_extensions')"
    :primary-label="t('common.delete')"
    :deleting="isLoading"
    :error-title="error ? t('users.cannot_delete_orphan_extensions') : ''"
    :error-description="describeError(error)"
    @close="closeConfirmation"
    @primary-click="mutate(selectedOrphans.map((orphan) => orphan.extension))"
  >
    <p>
      {{
        t(
          'users.delete_orphan_extensions_confirmation',
          { extensions: selectedExtensions },
          selectedOrphans.length,
        )
      }}
    </p>
    <p class="mt-3">{{ t('users.delete_orphan_extensions_consequences') }}</p>
  </DeleteObjectModal>
</template>
