<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeButton,
  NeEmptyState,
  NeInlineNotification,
  NeModal,
  NeSkeleton,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
} from '@nethesis/vue-components'
import { faDoorOpen } from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { ProfileOption } from '@/lib/integrations/lookups'
import {
  defaultProfileIds,
  prepareDoorPhone,
  profileOfExtension,
  VIDEO_DOOR_PHONES_KEY,
  type DoorPhone,
  type DoorPhonePrefill,
} from '@/lib/integrations/videoSources'
import { getUsers } from '@/lib/users/users'
import { useDoorPhones } from '@/queries/integrations/videoSources'
import { describeError } from '@/stores/notifications'

const { visible = false, profiles } = defineProps<{
  visible: boolean
  profiles: ProfileOption[]
}>()

const emit = defineEmits<{
  close: []
  use: [prefill: DoorPhonePrefill, profileIds: string[]]
}>()

const { t } = useI18n()
const queryCache = useQueryCache()
const { state, refetch } = useDoorPhones()

const {
  mutate: prepareMutate,
  isLoading: preparing,
  variables: preparingPhone,
  error: prepareError,
  reset: prepareReset,
} = useMutation({
  mutation: async (phone: DoorPhone) => {
    const [prefill, users] = await Promise.all([
      prepareDoorPhone(phone.mac),
      getUsers().catch(() => []),
    ])
    return { prefill, users }
  },
  onSuccess({ prefill, users }) {
    queryCache.invalidateQueries({ key: [VIDEO_DOOR_PHONES_KEY] })
    emit('use', prefill, defaultProfileIds(profiles, profileOfExtension(users, prefill.extension)))
  },
})

useFocusReturn(() => visible)

const freeDoorPhones = computed(() =>
  (state.value.data ?? []).filter((phone) => phone.sources.length === 0),
)

watch(
  () => visible,
  () => {
    if (visible) {
      prepareReset()
    }
  },
)

function use(phone: DoorPhone) {
  if (!preparing.value) {
    prepareMutate(phone)
  }
}

function close() {
  if (!preparing.value) {
    emit('close')
  }
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('integrations.video.create_from_door_phone')"
    size="xl"
    :primary-label="t('common.close')"
    primary-button-kind="tertiary"
    :close-aria-label="t('common.close')"
    @close="close"
    @primary-click="close"
  >
    <div class="flex flex-col gap-6">
      <p>{{ t('integrations.video.door_phones_description') }}</p>
      <NeSkeleton v-if="state.status === 'pending'" :lines="4" />
      <LoadError
        v-else-if="state.status === 'error'"
        :error="state.error"
        :title="t('integrations.video.cannot_load_door_phones')"
        @retry="refetch()"
      />
      <NeEmptyState
        v-else-if="freeDoorPhones.length === 0"
        :title="
          (state.data ?? []).length === 0
            ? t('integrations.video.no_door_phones')
            : t('integrations.video.all_door_phones_used')
        "
        :description="
          (state.data ?? []).length === 0 ? t('integrations.video.no_door_phones_description') : ''
        "
        :icon="faDoorOpen"
      />
      <NeTable v-else :aria-label="t('integrations.video.door_phones')" card-breakpoint="md">
        <NeTableHead>
          <NeTableHeadCell>{{ t('integrations.name') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.video.extension') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.video.model') }}</NeTableHeadCell>
          <NeTableHeadCell>{{ t('integrations.video.ip_address') }}</NeTableHeadCell>
          <NeTableHeadCell>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </NeTableHeadCell>
        </NeTableHead>
        <NeTableBody>
          <NeTableRow v-for="phone in freeDoorPhones" :key="phone.mac">
            <NeTableCell :data-label="t('integrations.name')">
              <span class="wrap-anywhere">{{ phone.name || '-' }}</span>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.video.extension')">
              {{ phone.extension }}
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.video.model')">
              <div class="flex flex-col">
                <span>{{ phone.modelName || '-' }}</span>
                <span class="text-tertiary-neutral text-xs">{{ phone.mac }}</span>
              </div>
            </NeTableCell>
            <NeTableCell :data-label="t('integrations.video.ip_address')">
              {{ phone.ip || t('integrations.video.not_registered') }}
            </NeTableCell>
            <NeTableCell :data-label="t('common.actions')">
              <div class="-ml-2.5 flex md:ml-0 md:justify-end">
                <NeButton
                  kind="secondary"
                  :loading="preparing && preparingPhone?.mac === phone.mac"
                  :disabled="preparing"
                  @click="use(phone)"
                >
                  {{ t('integrations.video.use') }}
                  <span class="sr-only">{{ phone.name || phone.extension }}</span>
                </NeButton>
              </div>
            </NeTableCell>
          </NeTableRow>
        </NeTableBody>
      </NeTable>
      <NeInlineNotification
        v-if="prepareError"
        kind="error"
        :title="t('integrations.video.cannot_use_door_phone')"
        :description="describeError(prepareError)"
      />
    </div>
  </NeModal>
</template>
