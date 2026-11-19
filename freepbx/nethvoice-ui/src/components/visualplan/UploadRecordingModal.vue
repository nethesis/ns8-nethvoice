<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import { NeFileInput, NeInlineNotification, NeModal, NeTextInput } from '@nethesis/vue-components'
import { uploadRecording, type RecordingData } from '@/lib/visualplan/api'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useVisualPlanStore } from '@/stores/visualPlan'

const { visible = false } = defineProps<{ visible: boolean }>()

const emit = defineEmits<{ close: []; uploaded: [id: number] }>()

const { t } = useI18n()
const store = useVisualPlanStore()
const notificationsStore = useNotificationsStore()

const file = ref<File | null>(null)
const name = ref('')
const errors = ref<{ file?: string; name?: string }>({})

const { mutate, isLoading, error, reset } = useMutation({
  mutation: (input: { file: File; name: string }) => uploadRecording(input.file, input.name),
  onSuccess(recording: RecordingData) {
    store.addRecording(recording)
    emit('uploaded', recording.id)
    emit('close')
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('visual_plan.recording_uploaded'),
        description: t('visual_plan.recording_uploaded_description', { name: recording.name }),
      })
    }, 500)
  },
})

watch(
  () => visible,
  () => {
    if (visible) {
      file.value = null
      name.value = ''
      errors.value = {}
      reset()
    }
  },
)

watch(file, (value) => {
  if (value && !name.value) {
    name.value = value.name.replace(/\.[^.]+$/, '')
  }
})

function upload() {
  errors.value = {
    file: file.value ? undefined : t('visual_plan.issues.required'),
    name: name.value.trim() ? undefined : t('visual_plan.issues.required'),
  }
  if (file.value && name.value.trim()) {
    mutate({ file: file.value, name: name.value.trim() })
  }
}
</script>

<template>
  <NeModal
    :visible="visible"
    :title="t('visual_plan.upload_recording')"
    kind="info"
    :primary-label="t('visual_plan.upload')"
    :cancel-label="t('common.cancel')"
    :primary-button-disabled="isLoading"
    :primary-button-loading="isLoading"
    :close-aria-label="t('common.close')"
    @close="emit('close')"
    @primary-click="upload"
  >
    <div class="space-y-6">
      <NeFileInput
        v-model="file"
        :label="t('visual_plan.audio_file')"
        :helper-text="t('visual_plan.audio_file_helper')"
        :dropzone-label="t('visual_plan.audio_file_dropzone')"
        :invalid-message="errors.file ?? ''"
        accept=".wav,.mp3,audio/wav,audio/mpeg"
      />
      <NeTextInput
        v-model="name"
        :label="t('visual_plan.recording_name')"
        :invalid-message="errors.name ?? ''"
      />
      <NeInlineNotification
        v-if="error"
        kind="error"
        :title="t('visual_plan.cannot_upload_recording')"
        :description="describeError(error)"
      />
    </div>
  </NeModal>
</template>
