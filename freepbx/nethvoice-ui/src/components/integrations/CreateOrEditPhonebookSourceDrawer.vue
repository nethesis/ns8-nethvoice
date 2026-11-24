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
  NeHeading,
  NeInlineNotification,
  NeRadioSelection,
  NeSideDrawer,
  NeSpinner,
  NeStepper,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTextArea,
  NeTextInput,
  NeToggle,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import PhonebookFieldMapping from './PhonebookFieldMapping.vue'
import PhonebookPreview from './PhonebookPreview.vue'
import PhonebookReadError from './PhonebookReadError.vue'
import PhonebookVisibilityFields from './PhonebookVisibilityFields.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { usePhonebookFieldLabel } from '@/composables/usePhonebookFieldLabel'
import type { Focusable } from '@/lib/common'
import { isApiError } from '@/lib/api/errors'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import { countCsvRows } from '@/lib/integrations/phonebookImports'
import {
  buildPhonebookSourcePayload,
  buildPhonebookTestPayload,
  CSV_MAX_SIZE,
  deletePhonebookUploads,
  emptyPhonebookSourceForm,
  getConnectionSignature,
  getDefaultPort,
  getFileKey,
  getFormSnapshot,
  getInfinityPreviewColumns,
  getMappingColumns,
  getReadErrorTexts,
  hasNameColumn,
  INFINITY_FIELD_MAPPING,
  isCsvUploadRejected,
  isDatabaseKind,
  isLocalHostRefusal,
  isPhonebookPasswordKept,
  isPhonebookSourceKind,
  NOT_IMPORTED,
  PHONEBOOK_SOURCE_KINDS,
  PHONEBOOK_SOURCES_KEY,
  type PhonebookPreview as Preview,
  type PhonebookSource,
  type PhonebookSourceForm,
  type PhonebookTestResult,
  savePhonebookSource,
  suggestMapping,
  testPhonebookSource,
  toPhonebookSourceForm,
  uploadPhonebookCsv,
  validateCsvFile,
  validatePhonebookMapping,
  validatePhonebookSourceFields,
  validatePhonebookVisibility,
} from '@/lib/integrations/phonebookSources'
import type { FieldIssues } from '@/lib/integrations/validation'
import { usePhonebookFields } from '@/queries/integrations/phonebookSources'
import { usePermissions } from '@/queries/permissions/me'
import { describeError, useNotificationsStore } from '@/stores/notifications'

type ReadError = { title: string; description: string; details: string }

type LastRead = { signature: string; preview: Preview }

const TOTAL_STEPS = 3

const CSV_MAX_SIZE_MB = CSV_MAX_SIZE / 1024 / 1024

const {
  isShown = false,
  currentSource = undefined,
  sources = [],
} = defineProps<{
  isShown: boolean
  currentSource: PhonebookSource | undefined
  sources?: PhonebookSource[]
}>()

const emit = defineEmits<{ close: []; created: [id: string, name: string] }>()

const { t } = useI18n()
const { isSuperadmin } = usePermissions()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const fieldLabel = usePhonebookFieldLabel()
const { state: fieldsState } = usePhonebookFields(() => isShown)
const formId = useId()

const form = ref<PhonebookSourceForm>(emptyPhonebookSourceForm())
const step = ref(1)
const issues = ref<FieldIssues>({})
const mappingIssues = ref<FieldIssues>({})
const csvFile = ref<File | null>(null)
const csvFileIssue = ref('')
const uploadedFileKey = ref('')
const lastRead = ref<LastRead | undefined>()
const isHostRefused = ref(false)
const hasNoColumns = ref(false)
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)
let pendingUploads: string[] = []

useFocusReturn(() => isShown)

const topRef = useTemplateRef<HTMLElement>('topRef')
const nameRef = useTemplateRef<Focusable>('nameRef')
const databaseRef = useTemplateRef<Focusable>('databaseRef')
const hostRef = useTemplateRef<Focusable>('hostRef')
const portRef = useTemplateRef<Focusable>('portRef')
const userRef = useTemplateRef<Focusable>('userRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')
const queryRef = useTemplateRef<Focusable>('queryRef')
const urlRef = useTemplateRef<Focusable>('urlRef')
const fileRef = useTemplateRef<Focusable>('fileRef')
const usernameRef = useTemplateRef<Focusable>('usernameRef')
const mappingRef = useTemplateRef<InstanceType<typeof PhonebookFieldMapping>>('mappingRef')
const mappingSectionRef = useTemplateRef<HTMLElement>('mappingSectionRef')
const visibilityRef =
  useTemplateRef<InstanceType<typeof PhonebookVisibilityFields>>('visibilityRef')
const readErrorRef = useTemplateRef<HTMLElement>('readErrorRef')

const fieldRefs: Record<string, typeof nameRef> = {
  name: nameRef,
  database: databaseRef,
  host: hostRef,
  port: portRef,
  user: userRef,
  password: passwordRef,
  query: queryRef,
  url: urlRef,
  file: fileRef,
  username: usernameRef,
}

const isEdit = computed(() => !!currentSource)

const kindOptions = computed(() =>
  PHONEBOOK_SOURCE_KINDS.map((kind) => ({
    id: kind,
    label: t(`integrations.phonebook.kind_${kind}`),
  })),
)

const csvFromOptions = computed(() => [
  { id: 'url', label: t('integrations.phonebook.csv_from_url') },
  { id: 'upload', label: t('integrations.phonebook.csv_from_upload') },
])

const kind = computed({
  get: () => form.value.kind,
  set: (value: string) => {
    if (isPhonebookSourceKind(value) && value !== form.value.kind) {
      form.value.kind = value
      form.value.mapping = {}
      lastRead.value = undefined
      resetRead()
      issues.value = {}
      mappingIssues.value = {}
    }
  },
})

const csvFrom = computed({
  get: () => form.value.csvFrom,
  set: (value: string) => {
    form.value.csvFrom = value === 'upload' ? 'upload' : 'url'
  },
})

const otherNames = computed(() =>
  sources.filter((source) => source.id !== currentSource?.id).map((source) => source.name),
)

const fileKey = computed(() => getFileKey(csvFile.value))

const signature = computed(() => getConnectionSignature(form.value, fileKey.value))

const loadedSignature = ref('')

const currentPreview = computed(() =>
  lastRead.value && lastRead.value.signature === signature.value
    ? lastRead.value.preview
    : undefined,
)

const columns = computed(() =>
  lastRead.value
    ? lastRead.value.preview.columns
    : currentSource
      ? Object.keys(currentSource.mapping)
      : [],
)

const mappingColumns = computed(() => getMappingColumns(columns.value))

const fields = computed(() => fieldsState.value.data ?? [])

const withOwner = computed(() => form.value.kind !== 'csv')

const sameQueryForPassword = computed(() => !isSuperadmin.value)

const isNameWarningShown = computed(
  () =>
    form.value.kind !== 'infinity' &&
    mappingColumns.value.length > 0 &&
    !hasNameColumn(form.value.mapping),
)

const defaultPort = computed(() => getDefaultPort(form.value.kind))

const passwordHelper = computed(() => {
  if (!currentSource?.hasPassword) {
    return ''
  }
  if (isPhonebookPasswordKept(form.value, currentSource, sameQueryForPassword.value)) {
    return t('integrations.password_keep_helper')
  }
  return isPhonebookPasswordKept(form.value, currentSource)
    ? t('integrations.phonebook.password_query_changed_helper')
    : t('integrations.password_server_changed_helper')
})

const fileHelper = computed(() =>
  form.value.uploadedUrl && !csvFile.value
    ? t('integrations.phonebook.csv_file_replace_helper')
    : t('integrations.phonebook.csv_file_helper'),
)

const fileInvalidMessage = computed(() => {
  if (csvFileIssue.value) {
    return t(csvFileIssue.value, { size: CSV_MAX_SIZE_MB })
  }
  return issues.value.file ? t(issues.value.file) : ''
})

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
  mutation: (sourceForm: PhonebookSourceForm) =>
    testPhonebookSource(buildPhonebookTestPayload(sourceForm, currentSource)),
  onError: (error, sourceForm) => showLocalHostRefusal(error, sourceForm),
})

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: async (sourceForm: PhonebookSourceForm) => ({
    id: await savePhonebookSource(buildPhonebookSourcePayload(sourceForm), currentSource?.id),
    name: sourceForm.name.trim(),
  }),
  onSuccess({ id, name }, sourceForm) {
    const edited = isEdit.value
    pendingUploads = pendingUploads.filter((url) => url !== sourceForm.uploadedUrl)

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.phonebook.source_updated')
          : t('integrations.phonebook.source_created'),
        description: t(
          edited
            ? 'integrations.phonebook.source_updated_description'
            : 'integrations.phonebook.source_created_description',
          { name },
        ),
      })
    }, 500)

    if (!edited && id) {
      emit('created', id, name)
    }
    emit('close')
  },
  onError(error, sourceForm) {
    if (showLocalHostRefusal(error, sourceForm)) {
      step.value = 1
    }
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PHONEBOOK_SOURCES_KEY] })
  },
})

const reading = computed(() => uploading.value || testing.value)

const busy = computed(() => reading.value || saving.value)

const readError = computed<ReadError | undefined>(() => {
  if (uploadError.value) {
    return {
      title: t('integrations.phonebook.cannot_upload_file'),
      description: isCsvUploadRejected(uploadError.value)
        ? t('integrations.phonebook.csv_upload_rejected')
        : getLegacyStatusMessage(uploadError.value) || describeError(uploadError.value),
      details: '',
    }
  }

  if (testError.value) {
    return isLocalHostRefusal(testError.value, form.value)
      ? undefined
      : {
          title: t('integrations.phonebook.cannot_read_source'),
          description: describeReadException(testError.value),
          details: '',
        }
  }

  if (hasNoColumns.value) {
    return {
      title: t('integrations.phonebook.cannot_read_columns'),
      description: t(
        form.value.kind === 'csv'
          ? 'integrations.phonebook.read_error_no_rows_file'
          : 'integrations.phonebook.read_error_no_rows_query',
      ),
      details: '',
    }
  }

  if (testResult.value && !testResult.value.ok) {
    const texts = getReadErrorTexts(testResult.value.kind, form.value.kind)
    return {
      title: t(texts.title),
      description: t(texts.description),
      details: testResult.value.details,
    }
  }
  return undefined
})

const snapshot = () => getFormSnapshot(form.value, fileKey.value)

const isDirty = computed(() => snapshot() !== initialSnapshot.value)

const title = computed(() =>
  isEdit.value
    ? t('integrations.phonebook.edit_source')
    : t('integrations.phonebook.create_source'),
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
    form.value = currentSource ? toPhonebookSourceForm(currentSource) : emptyPhonebookSourceForm()
    step.value = 1
    issues.value = {}
    mappingIssues.value = {}
    csvFile.value = null
    csvFileIssue.value = ''
    uploadedFileKey.value = ''
    lastRead.value = undefined
    resetRead()
    saveReset()
    initialSnapshot.value = snapshot()
    loadedSignature.value = currentSource ? signature.value : ''
    focusElement(nameRef)
  },
)

watch(signature, () => {
  if (!reading.value) {
    resetRead()
  }
})

watch(
  busy,
  (isBusy) => {
    if (!isBusy && isHostRefused.value) {
      isHostRefused.value = false
      focusElement(hostRef)
    }
  },
  { flush: 'post' },
)

watch(readError, (error) => {
  if (error) {
    void nextTick(() => readErrorRef.value?.scrollIntoView?.({ block: 'nearest' }))
  }
})

watch(csvFile, (file) => {
  csvFileIssue.value = file ? validateCsvFile(file) : ''
  form.value.uploadedUrl = currentSource ? toPhonebookSourceForm(currentSource).uploadedUrl : ''
  uploadedFileKey.value = ''

  if (issues.value.file) {
    issues.value = { ...issues.value, file: '' }
  }
})

watch(fields, (available) => {
  if (!isEdit.value && available.length > 0 && mappingColumns.value.length > 0) {
    form.value.mapping = suggestMapping(
      columns.value,
      available,
      form.value.mapping,
      withOwner.value,
    )
  }
})

function resetRead() {
  uploadReset()
  testReset()
  hasNoColumns.value = false
}

function showLocalHostRefusal(error: unknown, sourceForm: PhonebookSourceForm): boolean {
  if (!isLocalHostRefusal(error, sourceForm)) {
    return false
  }
  issues.value = { ...issues.value, host: 'integrations.phonebook.host_local' }
  isHostRefused.value = true
  return true
}

function clearIssue(field: string) {
  if (issues.value[field]) {
    issues.value = { ...issues.value, [field]: '' }
  }
}

function setMapping(column: string, field: string) {
  form.value.mapping = { ...form.value.mapping, [column]: field }

  if (mappingIssues.value[column]) {
    mappingIssues.value = { ...mappingIssues.value, [column]: '' }
  }
}

function applyColumns(newColumns: string[]) {
  if (form.value.kind === 'infinity') {
    return
  }

  if (isEdit.value) {
    form.value.mapping = Object.fromEntries(
      getMappingColumns(newColumns).map((column) => [
        column,
        form.value.mapping[column] || NOT_IMPORTED,
      ]),
    )
    return
  }
  const kept = Object.fromEntries(
    Object.entries(form.value.mapping).filter(([column]) => newColumns.includes(column)),
  )
  form.value.mapping = suggestMapping(newColumns, fields.value, kept, withOwner.value)
}

function scrollToTop() {
  let node = topRef.value?.parentElement

  while (node && !['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) {
    node = node.parentElement
  }
  node?.scrollTo({ top: 0 })
}

function focusFirstIssue(fieldIssues: FieldIssues): boolean {
  const [first] = Object.keys(fieldIssues).filter((field) => fieldIssues[field])

  const ref = first ? fieldRefs[first] : undefined

  if (ref) {
    focusElement(ref)
    return true
  }
  return false
}

function validateSourceFields(): boolean {
  const sourceIssues = validatePhonebookSourceFields(form.value, {
    existing: currentSource,
    sameQuery: sameQueryForPassword.value,
    otherNames: otherNames.value,
    hasFile: !!csvFile.value && !csvFileIssue.value,
  })
  issues.value = sourceIssues

  if (csvFileIssue.value && form.value.kind === 'csv' && form.value.csvFrom === 'upload') {
    focusElement(fileRef)
    return false
  }
  return !focusFirstIssue(sourceIssues)
}

function validateMapping(): boolean {
  if (form.value.kind === 'infinity') {
    mappingIssues.value = {}
    return true
  }
  mappingIssues.value = validatePhonebookMapping(columns.value, form.value.mapping)

  if (Object.keys(mappingIssues.value).length > 0) {
    void nextTick(() => mappingRef.value?.focusFirstInvalid())
    return false
  }
  return true
}

function validateVisibility(): boolean {
  issues.value = { ...issues.value, ...validatePhonebookVisibility(form.value) }

  if (issues.value.groups) {
    visibilityRef.value?.focusGroups()
    return false
  }
  return true
}

function describeReadException(error: unknown): string {
  return (
    getLegacyStatusMessage(error) ||
    (isApiError(error) && error.status < 500
      ? describeError(error)
      : t('integrations.phonebook.read_error_unknown'))
  )
}

async function uploadFileIfNeeded(): Promise<boolean> {
  const file = csvFile.value

  if (form.value.kind !== 'csv' || form.value.csvFrom !== 'upload' || !file) {
    return true
  }

  if (uploadedFileKey.value === fileKey.value) {
    return true
  }

  try {
    form.value.uploadedUrl = await uploadMutateAsync(file)
    pendingUploads = [...pendingUploads, form.value.uploadedUrl]
    uploadedFileKey.value = fileKey.value
    return true
  } catch {
    return false
  }
}

async function countUploadedRows(): Promise<number | undefined> {
  if (form.value.kind !== 'csv' || form.value.csvFrom !== 'upload' || !csvFile.value) {
    return undefined
  }

  try {
    return countCsvRows(await csvFile.value.text())
  } catch {
    return undefined
  }
}

async function readSource(): Promise<boolean> {
  resetRead()
  const readSignature = signature.value

  if (!(await uploadFileIfNeeded())) {
    return false
  }
  let result: PhonebookTestResult

  try {
    result = await testMutateAsync({ ...form.value })
  } catch {
    return false
  }

  if (!result.ok) {
    if (csvFile.value) {
      uploadedFileKey.value = ''
      pendingUploads = pendingUploads.filter((url) => url !== form.value.uploadedUrl)
    }
    return false
  }

  if (form.value.kind !== 'infinity' && getMappingColumns(result.columns).length === 0) {
    hasNoColumns.value = true
    return false
  }
  const localTotal = await countUploadedRows()
  const preview: Preview = {
    columns:
      form.value.kind === 'infinity' ? getInfinityPreviewColumns(result.rows) : result.columns,
    rows: result.rows,
    ...(localTotal === undefined
      ? result.total === undefined
        ? {}
        : { total: result.total }
      : { total: localTotal }),
  }
  applyColumns(result.columns)
  lastRead.value = { signature: readSignature, preview }
  return true
}

function isRead(): boolean {
  return lastRead.value?.signature === signature.value
}

function goToStep(next: number) {
  step.value = next
  void nextTick(() => {
    scrollToTop()

    if (next === 1) {
      focusElement(nameRef)
    } else if (next === 2) {
      mappingRef.value?.focusFirst()
    } else {
      visibilityRef.value?.focus()
    }
  })
}

async function nextStep() {
  if (busy.value) {
    return
  }

  if (step.value === 1) {
    if (!validateSourceFields()) {
      return
    }

    if (isRead() || (await readSource())) {
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
  create()
}

function create() {
  if (!validateSourceFields()) {
    goToStep(1)
    return
  }

  if (!validateMapping()) {
    step.value = 2
    return
  }

  if (validateVisibility()) {
    save()
  }
}

async function saveEdit() {
  if (busy.value) {
    return
  }
  const sourceValid = validateSourceFields()
  const visibilityValid = sourceValid && validateVisibility()

  if (!sourceValid || !visibilityValid) {
    return
  }
  const baseline = lastRead.value?.signature ?? loadedSignature.value
  const needsRead =
    signature.value !== baseline ||
    (form.value.kind !== 'infinity' && mappingColumns.value.length === 0)

  if (needsRead) {
    const previousColumns = mappingColumns.value

    if (!(await readSource())) {
      return
    }

    const newColumn = mappingColumns.value.find((column) => !previousColumns.includes(column))

    if (newColumn !== undefined) {
      void nextTick(() => {
        mappingSectionRef.value?.scrollIntoView?.({ block: 'start' })
        mappingRef.value?.focusColumn(newColumn)
      })
      return
    }
  }

  if (validateMapping()) {
    save()
  }
}

async function showPreview() {
  if (busy.value || !validateSourceFields()) {
    return
  }
  await readSource()
}

function save() {
  saveReset()
  saveMutate({ ...form.value, mapping: { ...form.value.mapping } })
}

function submit() {
  if (isEdit.value) {
    void saveEdit()
  } else {
    void nextStep()
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
    :title="title"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <div ref="topRef" class="flex flex-col gap-6">
      <NeStepper
        v-if="!isEdit"
        :current-step="step"
        :total-steps="TOTAL_STEPS"
        :step-label="t('integrations.phonebook.step')"
      />
      <form
        v-show="isEdit || step === 1"
        :id="formId"
        novalidate
        class="flex flex-col gap-6"
        @submit.prevent="submit"
      >
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :placeholder="t('integrations.phonebook.name_placeholder')"
          :helper-text="t('integrations.phonebook.name_helper')"
          :invalid-message="issues.name ? t(issues.name) : ''"
          :disabled="busy"
          @update:model-value="clearIssue('name')"
          @blur="form.name = form.name.trim()"
        />
        <NeCombobox
          v-model="kind"
          :label="t('integrations.phonebook.type')"
          :options="kindOptions"
          :disabled="busy || isEdit"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <template v-if="isDatabaseKind(form.kind)">
          <NeTextInput
            ref="databaseRef"
            v-model="form.database"
            :label="t('integrations.phonebook.database_name')"
            :placeholder="t('integrations.cards.database_name_placeholder')"
            :invalid-message="issues.database ? t(issues.database) : ''"
            :disabled="busy"
            @blur="form.database = form.database.trim()"
          />
          <NeTextInput
            ref="hostRef"
            v-model="form.host"
            :label="t('integrations.cards.database_address')"
            :placeholder="t('integrations.cards.database_address_placeholder')"
            :helper-text="t('integrations.cards.database_address_helper')"
            :invalid-message="issues.host ? t(issues.host) : ''"
            :disabled="busy"
            @blur="form.host = form.host.trim()"
          />
          <NeTextInput
            ref="portRef"
            v-model="form.port"
            :label="t('integrations.port')"
            :placeholder="t('integrations.cards.database_port_placeholder', { port: defaultPort })"
            :helper-text="
              t('integrations.cards.database_port_helper', {
                type: t(`integrations.phonebook.kind_${form.kind}`),
                port: defaultPort,
              })
            "
            inputmode="numeric"
            optional
            :optional-label="t('common.optional')"
            :invalid-message="issues.port ? t(issues.port) : ''"
            :disabled="busy"
            @blur="form.port = form.port.trim()"
          />
          <NeTextInput
            ref="userRef"
            v-model="form.user"
            :label="t('integrations.cards.database_username')"
            autocomplete="off"
            :invalid-message="issues.user ? t(issues.user) : ''"
            :disabled="busy"
            @blur="form.user = form.user.trim()"
          />
        </template>
        <template v-else-if="form.kind === 'csv'">
          <NeRadioSelection
            v-model="csvFrom"
            :label="t('integrations.phonebook.file')"
            :options="csvFromOptions"
            :disabled="busy"
          />
          <NeTextInput
            v-if="form.csvFrom === 'url'"
            ref="urlRef"
            v-model="form.url"
            :label="t('integrations.url')"
            :placeholder="t('integrations.phonebook.csv_url_placeholder')"
            :helper-text="t('integrations.phonebook.csv_url_helper')"
            :invalid-message="issues.url ? t(issues.url) : ''"
            :disabled="busy"
            @blur="form.url = form.url.trim()"
          />
          <NeFileInput
            v-else
            ref="fileRef"
            v-model="csvFile"
            :label="t('integrations.phonebook.csv_file')"
            :helper-text="fileHelper"
            :invalid-message="fileInvalidMessage"
            :dropzone-label="t('ne_file_input.drag_and_drop_or_click_to_upload')"
            accept=".csv,.txt,text/csv,text/plain"
          />
        </template>
        <template v-else>
          <NeTextInput
            ref="urlRef"
            v-model="form.url"
            :label="t('integrations.url')"
            :placeholder="t('integrations.phonebook.infinity_url_placeholder')"
            :helper-text="t('integrations.phonebook.infinity_url_helper')"
            :invalid-message="issues.url ? t(issues.url) : ''"
            :disabled="busy"
            @blur="form.url = form.url.trim()"
          />
          <NeTextInput
            ref="usernameRef"
            v-model="form.username"
            :label="t('integrations.phonebook.username')"
            autocomplete="off"
            :invalid-message="issues.username ? t(issues.username) : ''"
            :disabled="busy"
            @blur="form.username = form.username.trim()"
          />
        </template>
        <NeTextInput
          v-if="form.kind !== 'csv'"
          ref="passwordRef"
          v-model="form.password"
          :label="t('integrations.password')"
          is-password
          autocomplete="new-password"
          :show-password-label="t('ne_text_input.show_password')"
          :hide-password-label="t('ne_text_input.hide_password')"
          :helper-text="passwordHelper"
          :invalid-message="issues.password ? t(issues.password) : ''"
          :disabled="busy"
        />
        <NeTextArea
          v-if="isDatabaseKind(form.kind)"
          ref="queryRef"
          v-model="form.query"
          :label="t('integrations.query')"
          :rows="4"
          class="[&_textarea]:font-mono"
          :helper-text="t('integrations.phonebook.query_helper')"
          :invalid-message="issues.query ? t(issues.query) : ''"
          :disabled="busy"
        />
        <template v-if="isEdit">
          <div>
            <NeButton
              type="button"
              kind="secondary"
              :disabled="busy"
              :loading="reading"
              @click="showPreview"
            >
              {{ t('integrations.phonebook.show_preview') }}
            </NeButton>
          </div>
          <p v-if="reading" role="status" class="flex items-center gap-2 text-sm">
            <NeSpinner size="4" />
            {{ t('integrations.phonebook.loading_preview') }}
          </p>
        </template>
      </form>
      <div v-if="readError && (isEdit || step === 1)" ref="readErrorRef">
        <PhonebookReadError v-bind="readError" />
      </div>
      <PhonebookPreview
        v-if="isEdit && currentPreview && !readError"
        :preview="currentPreview"
        :column-label="form.kind === 'infinity' ? fieldLabel : undefined"
      />
      <div v-show="isEdit || step === 2" ref="mappingSectionRef" class="flex flex-col gap-6">
        <NeHeading v-if="isEdit" tag="h6">
          {{ t('integrations.phonebook.field_mapping') }}
        </NeHeading>
        <template v-if="form.kind === 'infinity'">
          <p class="text-secondary-neutral text-sm">
            {{ t('integrations.phonebook.infinity_mapping') }}
          </p>
          <NeTable :aria-label="t('integrations.phonebook.field_mapping')" card-breakpoint="sm">
            <NeTableHead>
              <NeTableHeadCell>{{ t('integrations.phonebook.column') }}</NeTableHeadCell>
              <NeTableHeadCell>{{ t('integrations.phonebook.phonebook_field') }}</NeTableHeadCell>
            </NeTableHead>
            <NeTableBody>
              <NeTableRow v-for="row in INFINITY_FIELD_MAPPING" :key="row.source">
                <NeTableCell :data-label="t('integrations.phonebook.column')">
                  {{ t(`integrations.phonebook.infinity_${row.source}`) }}
                </NeTableCell>
                <NeTableCell :data-label="t('integrations.phonebook.phonebook_field')">
                  {{ fieldLabel(row.field) }}
                </NeTableCell>
              </NeTableRow>
            </NeTableBody>
          </NeTable>
        </template>
        <template v-else-if="mappingColumns.length > 0">
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
            :mapping="form.mapping"
            :fields="fields"
            :with-owner="withOwner"
            :issues="mappingIssues"
            :disabled="busy || fieldsState.status !== 'success'"
            @change="setMapping"
          />
        </template>
        <PhonebookPreview
          v-if="currentPreview && !isEdit"
          :preview="currentPreview"
          :column-label="form.kind === 'infinity' ? fieldLabel : undefined"
        />
        <NeInlineNotification
          v-if="isNameWarningShown"
          kind="warning"
          :title="t('integrations.phonebook.no_name_column')"
          :description="t('integrations.phonebook.no_name_column_source')"
        />
      </div>
      <div v-show="isEdit || step === 3" class="flex flex-col gap-6">
        <NeHeading v-if="isEdit" tag="h6">
          {{ t('integrations.phonebook.visibility') }}
        </NeHeading>
        <PhonebookVisibilityFields
          ref="visibilityRef"
          v-model:sharing="form.sharing"
          v-model:groups="form.groups"
          :invalid-message="issues.groups ? t(issues.groups) : ''"
          :disabled="busy"
        />
        <NeHeading v-if="isEdit" tag="h6">{{ t('integrations.phonebook.sync') }}</NeHeading>
        <NeToggle
          v-model="form.enabled"
          :top-label="t('integrations.phonebook.automatic_sync')"
          :label="form.enabled ? t('common.enabled') : t('common.disabled')"
          :disabled="busy"
        />
      </div>
      <NeInlineNotification
        v-if="saveError"
        kind="error"
        :title="
          isEdit
            ? t('integrations.phonebook.cannot_save_source')
            : t('integrations.phonebook.cannot_create_source')
        "
        :description="getLegacyStatusMessage(saveError) || describeError(saveError)"
      />
    </div>
    <hr class="my-8" />
    <div class="flex flex-wrap justify-end gap-3">
      <NeButton type="button" kind="tertiary" size="lg" :disabled="busy" @click="requestClose">
        {{ t('common.cancel') }}
      </NeButton>
      <NeButton
        v-if="!isEdit && step > 1"
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
        :loading="isEdit ? saving : reading || saving"
      >
        <template v-if="!isEdit && step < TOTAL_STEPS" #suffix>
          <FontAwesomeIcon :icon="faArrowRight" class="size-4" aria-hidden="true" />
        </template>
        {{ isEdit ? t('common.save') : step < TOTAL_STEPS ? t('common.next') : t('common.create') }}
      </NeButton>
    </div>
  </NeSideDrawer>
  <DiscardChangesModal
    :visible="isShownDiscardModal"
    @close="isShownDiscardModal = false"
    @discard="discardChanges"
  />
</template>
