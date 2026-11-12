<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import { NeCombobox, NeFileInput, NeInlineNotification } from '@nethesis/vue-components'
import {
  isValidPhoneFileName,
  PHONE_FILES_KEY,
  uploadPhoneFile,
  type PhoneFileType,
} from '@/lib/phones/files'
import { usePhoneFiles } from '@/queries/phones/modelDetail'
import { describeError } from '@/stores/notifications'

const {
  label,
  fileType,
  disabled = false,
} = defineProps<{
  label: string
  fileType: PhoneFileType
  disabled?: boolean
}>()

const model = defineModel<string>({ required: true })

const { t } = useI18n()
const queryCache = useQueryCache()
const { state } = usePhoneFiles(fileType)
const file = ref<File | null>(null)
const fileIssue = ref('')

const options = computed(() => {
  const names = (state.value.data ?? []).map((item) => item.name)

  if (model.value && !names.includes(model.value)) {
    names.push(model.value)
  }
  return [
    { id: '', label: t('phones.models.no_file') },
    ...names.map((name) => ({ id: name, label: name })),
  ]
})

const {
  mutate: uploadMutate,
  isLoading: uploading,
  reset: uploadReset,
  error: uploadError,
} = useMutation({
  mutation: (selected: File) => uploadPhoneFile(fileType, selected),
  onSuccess(_data, selected) {
    model.value = selected.name
    file.value = null
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_FILES_KEY, fileType] })
  },
})

function onSelect(selected: File | File[] | null) {
  uploadReset()
  fileIssue.value = ''
  const chosen = Array.isArray(selected) ? selected[0] : selected

  if (!chosen) {
    return
  }

  if (!isValidPhoneFileName(chosen.name)) {
    fileIssue.value = t('phones.models.invalid_file_name')
    return
  }
  uploadMutate(chosen)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <NeCombobox
      v-model="model"
      :label="label"
      :options="options"
      :placeholder="$t('ne_combobox.choose')"
      :disabled="disabled || uploading || state.status === 'pending'"
      optional
      :optional-label="$t('common.optional')"
      :no-results-label="$t('ne_combobox.no_results')"
      :limited-options-label="$t('ne_combobox.limited_options_label')"
      :no-options-label="$t('ne_combobox.no_options_label')"
      :selected-label="$t('ne_combobox.selected')"
      :user-input-label="$t('ne_combobox.user_input_label')"
    />
    <NeFileInput
      v-model="file"
      :dropzone-label="$t('ne_file_input.drag_and_drop_or_click_to_upload')"
      :helper-text="$t('phones.models.upload_helper')"
      :invalid-message="fileIssue"
      @select="onSelect"
    />
    <NeInlineNotification
      v-if="uploadError"
      kind="error"
      :title="$t('phones.models.cannot_upload_file')"
      :description="describeError(uploadError)"
    />
  </div>
</template>
