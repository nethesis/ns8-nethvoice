<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeFileInput,
  NeInlineNotification,
  NeSideDrawer,
  NeSpinner,
  NeStepper,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import PhonebookFieldMapping from './PhonebookFieldMapping.vue'
import PhonebookPreview from './PhonebookPreview.vue'
import PhonebookReadError from './PhonebookReadError.vue'
import PhonebookVisibilityFields from './PhonebookVisibilityFields.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import {
  buildImportPayload,
  type CsvContent,
  estimateSkippedRows,
  getImportErrorMessage,
  importContacts,
  PHONEBOOK_IMPORTS_KEY,
  readCsv,
} from '@/lib/integrations/phonebookImports'
import {
  CSV_MAX_SIZE,
  deletePhonebookUploads,
  getReadErrorTexts,
  hasAnyNameColumn,
  isCsvUploadRejected,
  type PhonebookPreview as Preview,
  type PhonebookTestResult,
  suggestMapping,
  testPhonebookSource,
  uploadPhonebookCsv,
  validateCsvFile,
  validatePhonebookMapping,
  validatePhonebookVisibility,
} from '@/lib/integrations/phonebookSources'
import type { FieldIssues } from '@/lib/integrations/validation'
import { useImportOwners, usePhonebookFields } from '@/queries/integrations/phonebookSources'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type ReadError = { title: string; description: string; details: string }

type FileRead = { url: string; csv: CsvContent; preview: Preview }

const TOTAL_STEPS = 3

const CSV_MAX_SIZE_MB = CSV_MAX_SIZE / 1024 / 1024

const { isShown = false } = defineProps<{ isShown: boolean }>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: fieldsState } = usePhonebookFields(() => isShown)
const { state: ownersState } = useImportOwners()
const formId = useId()

const step = ref(1)
const csvFile = ref<File | null>(null)
const fileIssue = ref('')
const fileRead = ref<FileRead | undefined>()
const readFile = ref<File | null>(null)
const mapping = ref<Record<string, string>>({})
const mappingIssues = ref<FieldIssues>({})
const isNameErrorShown = ref(false)
const sharing = ref<'public' | 'groups'>('public')
const groups = ref<string[]>([])
const owner = ref('')
const issues = ref<FieldIssues>({})
const isShownDiscardModal = ref(false)
let pendingUploads: string[] = []

useFocusReturn(() => isShown)

const topRef = useTemplateRef<HTMLElement>('topRef')
const fileRef = useTemplateRef<Focusable>('fileRef')
const mappingRef = useTemplateRef<InstanceType<typeof PhonebookFieldMapping>>('mappingRef')
const visibilityRef =
  useTemplateRef<InstanceType<typeof PhonebookVisibilityFields>>('visibilityRef')
const ownerRef = useTemplateRef<Focusable>('ownerRef')
const nameErrorRef = useTemplateRef<HTMLElement>('nameErrorRef')

const fields = computed(() => fieldsState.value.data ?? [])

const columns = computed(() => fileRead.value?.preview.columns ?? [])

const ownerOptions = computed(() =>
  (ownersState.value.data ?? []).map((user) => ({
    id: user.username,
    label: `${user.name} (${user.extension})`,
    description: user.username,
  })),
)

const skippedRows = computed(() =>
  fileRead.value ? estimateSkippedRows(fileRead.value.csv, mapping.value) : 0,
)

const totalRows = computed(() => fileRead.value?.csv.records.length ?? 0)

const {
  mutateAsync: uploadMutateAsync,
  isLoading: uploading,
  reset: uploadReset,
  error: uploadError,
} = useMutation({
  mutation: (file: File) => uploadPhonebookCsv(file),
})

const {
  mutateAsync: testMutateAsync,
  isLoading: testing,
  reset: testReset,
  error: testError,
  data: testResult,
} = useMutation({
  mutation: (url: string) => testPhonebookSource({ dbtype: 'csv', url, cti_import: true }),
})

const {
  mutate: importMutate,
  isLoading: importing,
  reset: importReset,
  error: importError,
} = useMutation({
  mutation: (payload: Parameters<typeof importContacts>[0]) => importContacts(payload),
  onSuccess(result, payload) {
    pendingUploads = pendingUploads.filter((url) => url !== payload.url)
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('integrations.phonebook.contacts_imported'),
        description: t(
          'integrations.phonebook.contacts_imported_description',
          { count: result.imported },
          result.imported,
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PHONEBOOK_IMPORTS_KEY] })
  },
})

const reading = computed(() => uploading.value || testing.value)

const readError = computed<ReadError | undefined>(() => {
  if (!csvFile.value || readFile.value !== csvFile.value) {
    return undefined
  }
  const error = uploadError.value ?? testError.value

  if (error) {
    return {
      title:
        uploadError.value && !isCsvUploadRejected(uploadError.value)
          ? t('integrations.phonebook.cannot_upload_file')
          : t('integrations.phonebook.cannot_read_file'),
      description: getLegacyStatusMessage(error) || describeError(error),
      details: '',
    }
  }

  if (testResult.value && !testResult.value.ok) {
    const texts = getReadErrorTexts(testResult.value.kind, 'csv')
    return {
      title: t(texts.title),
      description: t(texts.description),
      details: testResult.value.details,
    }
  }
  return undefined
})

const busy = computed(() => reading.value || importing.value)

const isDirty = computed(() => !!csvFile.value)

const fileInvalidMessage = computed(() =>
  fileIssue.value ? t(fileIssue.value, { size: CSV_MAX_SIZE_MB }) : '',
)

watch(
  () => isShown,
  () => {
    if (!isShown) {
      isShownDiscardModal.value = false
      void deletePhonebookUploads(pendingUploads)
      pendingUploads = []
      return
    }
    step.value = 1
    csvFile.value = null
    fileIssue.value = ''
    fileRead.value = undefined
    readFile.value = null
    uploadReset()
    testReset()
    mapping.value = {}
    mappingIssues.value = {}
    isNameErrorShown.value = false
    sharing.value = 'public'
    groups.value = []
    owner.value = ''
    issues.value = {}
    importReset()
  },
)

watch(csvFile, (file) => {
  fileRead.value = undefined
  uploadReset()
  testReset()
  mapping.value = {}
  fileIssue.value = file ? validateCsvFile(file) : ''

  if (file && !fileIssue.value) {
    void readCsvFile(file)
  }
})

watch(fields, (available) => {
  if (available.length > 0 && columns.value.length > 0) {
    mapping.value = suggestMapping(columns.value, available, mapping.value, false)
  }
})

watch(owner, () => {
  if (issues.value.owner) {
    issues.value = { ...issues.value, owner: '' }
  }
})

async function readCsvFile(file: File) {
  readFile.value = file
  let url: string
  let result: PhonebookTestResult

  try {
    url = await uploadMutateAsync(file)
    pendingUploads = [...pendingUploads, url]
    result = await testMutateAsync(url)
  } catch {
    return
  }

  if (!result.ok) {
    pendingUploads = pendingUploads.filter((pending) => pending !== url)
  }

  if (csvFile.value !== file || !result.ok) {
    return
  }
  const csv = readCsv(await file.text())

  if (csvFile.value !== file) {
    return
  }
  fileRead.value = {
    url,
    csv,
    preview: { columns: result.columns, rows: result.rows, total: csv.records.length },
  }
  mapping.value = suggestMapping(result.columns, fields.value, {}, false)
}

function scrollToTop() {
  let node = topRef.value?.parentElement

  while (node && !['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) {
    node = node.parentElement
  }
  node?.scrollTo({ top: 0 })
}

function goToStep(next: number) {
  step.value = next
  void nextTick(() => {
    scrollToTop()

    if (next === 1) {
      focusElement(fileRef)
    } else if (next === 2) {
      mappingRef.value?.focusFirst()
    } else {
      visibilityRef.value?.focus()
    }
  })
}

function setMapping(column: string, field: string) {
  mapping.value = { ...mapping.value, [column]: field }

  if (mappingIssues.value[column]) {
    mappingIssues.value = { ...mappingIssues.value, [column]: '' }
  }

  if (isNameErrorShown.value && hasAnyNameColumn(mapping.value)) {
    isNameErrorShown.value = false
  }
}

function validateFile(): boolean {
  if (!csvFile.value) {
    fileIssue.value = 'integrations.phonebook.file_required'
  } else if (!fileIssue.value && !fileRead.value) {
    fileIssue.value = 'integrations.phonebook.choose_valid_csv'
  }

  if (fileIssue.value) {
    focusElement(fileRef)
    return false
  }
  return true
}

function validateMapping(): boolean {
  mappingIssues.value = validatePhonebookMapping(columns.value, mapping.value)

  if (Object.keys(mappingIssues.value).length > 0) {
    isNameErrorShown.value = false
    void nextTick(() => mappingRef.value?.focusFirstInvalid())
    return false
  }

  if (!hasAnyNameColumn(mapping.value)) {
    isNameErrorShown.value = true
    void nextTick(() => nameErrorRef.value?.scrollIntoView?.({ block: 'nearest' }))
    return false
  }
  return true
}

function validateOwnerStep(): boolean {
  issues.value = {
    ...validatePhonebookVisibility({ sharing: sharing.value, groups: groups.value }),
    ...(owner.value ? {} : { owner: 'integrations.phonebook.owner_required' }),
  }

  if (issues.value.groups) {
    visibilityRef.value?.focusGroups()
    return false
  }

  if (issues.value.owner) {
    focusElement(ownerRef)
    return false
  }
  return true
}

function runImport() {
  const read = fileRead.value
  const file = csvFile.value

  if (!read || !file) {
    return
  }
  importReset()
  importMutate(
    buildImportPayload({
      url: read.url,
      owner: owner.value,
      sharing: sharing.value,
      groups: groups.value,
      mapping: mapping.value,
      filename: file.name,
    }),
  )
}

function submit() {
  if (busy.value) {
    return
  }

  if (step.value === 1) {
    if (validateFile()) {
      goToStep(2)
    }
    return
  }

  if (step.value === 2) {
    if (validateMapping()) {
      goToStep(3)
    }
    return
  }

  if (validateOwnerStep()) {
    runImport()
  }
}

function previousStep() {
  if (!busy.value && step.value > 1) {
    goToStep(step.value - 1)
  }
}

function requestClose() {
  if (busy.value || isShownDiscardModal.value) {
    return
  }

  if (isDirty.value) {
    isShownDiscardModal.value = true
    return
  }
  emit('close')
}

function discardChanges() {
  isShownDiscardModal.value = false
  emit('close')
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="t('integrations.phonebook.import_contacts')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <div ref="topRef" class="flex flex-col gap-6">
      <NeStepper
        :current-step="step"
        :total-steps="TOTAL_STEPS"
        :step-label="t('integrations.phonebook.step')"
      />
      <form :id="formId" novalidate class="flex flex-col gap-6" @submit.prevent="submit">
        <div v-show="step === 1" class="flex flex-col gap-6">
          <NeFileInput
            ref="fileRef"
            v-model="csvFile"
            :label="t('integrations.phonebook.csv_file')"
            :helper-text="t('integrations.phonebook.csv_file_helper')"
            :invalid-message="fileInvalidMessage"
            :dropzone-label="t('ne_file_input.drag_and_drop_or_click_to_upload')"
            accept=".csv,.txt,text/csv,text/plain"
          />
          <p v-if="reading" role="status" class="flex items-center gap-2 text-sm">
            <NeSpinner size="4" />
            {{ t('integrations.phonebook.reading_file') }}
          </p>
        </div>
        <div v-show="step === 2" class="flex flex-col gap-6">
          <template v-if="fileRead">
            <p class="text-secondary-neutral text-sm">
              {{ t('integrations.phonebook.mapping_description') }}
            </p>
            <NeInlineNotification
              v-if="fieldsState.status === 'error'"
              kind="error"
              :title="t('integrations.phonebook.cannot_load_fields')"
              :description="describeError(fieldsState.error)"
            />
            <PhonebookFieldMapping
              ref="mappingRef"
              :columns="columns"
              :mapping="mapping"
              :fields="fields"
              :with-owner="false"
              :issues="mappingIssues"
              :disabled="busy || fieldsState.status !== 'success'"
              @change="setMapping"
            />
            <PhonebookPreview :preview="fileRead.preview" />
            <div v-if="isNameErrorShown" ref="nameErrorRef">
              <NeInlineNotification
                kind="error"
                :title="t('integrations.phonebook.no_name_column')"
                :description="t('integrations.phonebook.no_name_column_import')"
              />
            </div>
          </template>
        </div>
        <div
          v-show="step === 3"
          role="group"
          :aria-label="t('integrations.phonebook.visibility_and_owner')"
          class="flex flex-col gap-6"
        >
          <PhonebookVisibilityFields
            ref="visibilityRef"
            v-model:sharing="sharing"
            v-model:groups="groups"
            :invalid-message="issues.groups ? t(issues.groups) : ''"
            :disabled="busy"
          />
          <NeCombobox
            ref="ownerRef"
            v-model="owner"
            :label="t('integrations.phonebook.owner')"
            :options="ownerOptions"
            :placeholder="t('integrations.phonebook.owner_placeholder')"
            :helper-text="t('integrations.phonebook.owner_helper')"
            :invalid-message="issues.owner ? t(issues.owner) : ''"
            :disabled="busy"
            :loading-options="ownersState.status === 'pending'"
            :no-results-label="t('ne_combobox.no_results')"
            :limited-options-label="t('ne_combobox.limited_options_label')"
            :no-options-label="t('integrations.phonebook.no_owners')"
            :selected-label="t('ne_combobox.selected')"
            :user-input-label="t('ne_combobox.user_input_label')"
            :optional-label="t('common.optional')"
          />
          <NeInlineNotification
            v-if="ownersState.status === 'error'"
            kind="error"
            :title="t('integrations.phonebook.cannot_load_owners')"
            :description="describeError(ownersState.error)"
          />
          <NeInlineNotification
            v-if="skippedRows > 0"
            kind="info"
            :title="
              t('integrations.phonebook.rows_will_be_skipped', { count: skippedRows }, skippedRows)
            "
            :description="
              t(
                'integrations.phonebook.rows_will_be_skipped_description',
                { count: totalRows - skippedRows },
                totalRows - skippedRows,
              )
            "
          />
        </div>
      </form>
      <PhonebookReadError v-if="step === 1 && readError" v-bind="readError" />
      <NeInlineNotification
        v-if="importError"
        kind="error"
        :title="t('integrations.phonebook.cannot_import_contacts')"
        :description="getImportErrorMessage(importError) || describeError(importError)"
      />
    </div>
    <hr class="my-8" />
    <div class="flex flex-wrap justify-end gap-3">
      <NeButton type="button" kind="tertiary" size="lg" :disabled="busy" @click="requestClose">
        {{ t('common.cancel') }}
      </NeButton>
      <NeButton
        v-if="step > 1"
        type="button"
        kind="secondary"
        size="lg"
        :disabled="busy"
        @click="previousStep"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowLeft" class="size-4" aria-hidden="true" />
        </template>
        {{ t('common.previous') }}
      </NeButton>
      <NeButton
        type="submit"
        :form="formId"
        kind="primary"
        size="lg"
        :disabled="busy"
        :loading="importing"
      >
        <template v-if="step < TOTAL_STEPS" #suffix>
          <FontAwesomeIcon :icon="faArrowRight" class="size-4" aria-hidden="true" />
        </template>
        {{
          step < TOTAL_STEPS
            ? t('common.next')
            : importing
              ? t('integrations.phonebook.importing')
              : t('integrations.phonebook.import')
        }}
      </NeButton>
    </div>
  </NeSideDrawer>
  <DiscardChangesModal
    :visible="isShownDiscardModal"
    @close="isShownDiscardModal = false"
    @discard="discardChanges"
  />
</template>
