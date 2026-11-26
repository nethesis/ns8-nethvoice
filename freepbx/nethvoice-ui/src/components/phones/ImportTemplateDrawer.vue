<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeFileInput,
  NeInlineNotification,
  NeSideDrawer,
} from '@nethesis/vue-components'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import {
  getTemplateFileIssue,
  getTemplateImportIssue,
  importPhoneTemplate,
  PHONE_TEMPLATES_KEY,
  TEMPLATE_MAX_SIZE,
  TemplateFileNotTextError,
  type PhoneTemplate,
  type TemplateImportIssue,
} from '@/lib/phones/templates'
import { usePhoneTemplates } from '@/queries/phones/templates'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const TEMPLATE_MAX_SIZE_KB = TEMPLATE_MAX_SIZE / 1024

const { isShown = false } = defineProps<{ isShown?: boolean }>()

const emit = defineEmits<{ close: []; imported: [template: PhoneTemplate] }>()

useFocusReturn(() => isShown)

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: templatesState } = usePhoneTemplates(() => isShown)

const file = ref<File | null>(null)
const fileIssue = ref<TemplateImportIssue | null>(null)
const fileRef = useTemplateRef<Focusable>('fileRef')

const replacing = computed(
  () =>
    file.value !== null &&
    (templatesState.value.data ?? []).some((template) => template.name === file.value?.name),
)

const fileInvalidMessage = computed(() =>
  fileIssue.value
    ? t(fileIssue.value.key, { size: TEMPLATE_MAX_SIZE_KB, ...fileIssue.value.params })
    : '',
)

const {
  mutate: importMutate,
  isLoading: importing,
  reset: importReset,
  error: importError,
} = useMutation({
  mutation: ({ selected, replace }: { selected: File; replace: boolean }) =>
    importPhoneTemplate(selected, replace),
  onSuccess(template) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('phones.templates.template_imported'),
        description: t('phones.templates.template_imported_description', {
          name: template.name,
        }),
      })
    }, 500)
    emit('imported', template)
    emit('close')
  },
  onError(error) {
    const issue =
      error instanceof TemplateFileNotTextError
        ? { key: 'phones.templates.not_text' }
        : getTemplateImportIssue(error)

    if (issue) {
      fileIssue.value = issue
      focusElement(fileRef)
    }
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_TEMPLATES_KEY] })
  },
})

const isErrorNotificationShown = computed(
  () =>
    importError.value !== null &&
    !(importError.value instanceof TemplateFileNotTextError) &&
    getTemplateImportIssue(importError.value) === null,
)

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      return
    }
    file.value = null
    fileIssue.value = null
    importReset()
    focusElement(fileRef)
  },
)

function onSelect() {
  importReset()
  fileIssue.value = null
}

function save() {
  importReset()
  const selected = file.value
  const issue = selected ? getTemplateFileIssue(selected) : 'phones.templates.file_required'

  if (!selected || issue) {
    fileIssue.value = { key: issue }
    focusElement(fileRef)
    return
  }
  fileIssue.value = null
  importMutate({ selected, replace: replacing.value })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="$t('phones.templates.import_template')"
    :close-aria-label="$t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-8">
        <p class="text-secondary-neutral">{{ $t('phones.templates.import_description') }}</p>
        <NeFileInput
          ref="fileRef"
          v-model="file"
          :label="$t('phones.templates.template_file')"
          :dropzone-label="$t('ne_file_input.drag_and_drop_or_click_to_upload')"
          :helper-text="$t('phones.templates.template_file_helper', { size: TEMPLATE_MAX_SIZE_KB })"
          :invalid-message="fileInvalidMessage"
          accept=".tmpl"
          @select="onSelect"
        />
        <NeInlineNotification
          v-if="replacing"
          kind="warning"
          :title="$t('phones.templates.template_exists')"
          :description="$t('phones.templates.template_exists_description', { name: file?.name })"
        />
        <NeInlineNotification
          v-if="isErrorNotificationShown"
          kind="error"
          :title="$t('phones.templates.cannot_import_template')"
          :description="describeError(importError)"
        />
      </div>
      <hr class="my-8 border-gray-200 dark:border-gray-700" />
      <div class="flex justify-end gap-6">
        <NeButton kind="tertiary" size="lg" :disabled="importing" @click.prevent="emit('close')">
          {{ $t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="importing" :loading="importing">
          {{ $t('phones.templates.import') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
