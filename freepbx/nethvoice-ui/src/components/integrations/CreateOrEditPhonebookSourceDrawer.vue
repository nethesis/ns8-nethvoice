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
  NeCombobox,
  NeFileInput,
  NeFormItemLabel,
  NeHeading,
  NeInlineNotification,
  NeMultiselectCombobox,
  NeRadioSelection,
  NeSideDrawer,
  NeTextArea,
  NeTextInput,
  NeToggle,
  type NeMultiselectComboboxOption,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowRight, faCircleCheck, faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons'
import type { Focusable } from '@/lib/common'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import {
  buildPhonebookSourcePayload,
  buildPhonebookTestPayload,
  emptyPhonebookSourceForm,
  getAvailableFields,
  getDefaultPort,
  getMappingColumns,
  INFINITY_FIELD_MAPPING,
  isDatabaseKind,
  isPhonebookSourceKind,
  isUploadedCsv,
  PHONEBOOK_SOURCE_KINDS,
  PHONEBOOK_SOURCES_KEY,
  PHONEBOOK_SYNC_INTERVALS,
  type PhonebookSource,
  type PhonebookSourceForm,
  type PhonebookTestResult,
  savePhonebookSource,
  testPhonebookSource,
  toPhonebookSourceForm,
  uploadPhonebookCsv,
  validatePhonebookSourceForm,
} from '@/lib/integrations/phonebookSources'
import type { FieldIssues } from '@/lib/integrations/validation'
import { useGroupNames } from '@/queries/integrations/lookups'
import { usePhonebookFields } from '@/queries/integrations/phonebookSources'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { isShown = false, currentSource = undefined } = defineProps<{
  isShown: boolean
  currentSource: PhonebookSource | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: fieldsState } = usePhonebookFields()
const { state: groupsState } = useGroupNames()

const form = ref<PhonebookSourceForm>(emptyPhonebookSourceForm())
const validationIssues = ref<FieldIssues>({})
const testResult = ref<PhonebookTestResult | undefined>()
const csvFile = ref<File | null>(null)

const nameRef = useTemplateRef<Focusable>('nameRef')
const hostRef = useTemplateRef<Focusable>('hostRef')
const portRef = useTemplateRef<Focusable>('portRef')
const databaseRef = useTemplateRef<Focusable>('databaseRef')
const userRef = useTemplateRef<Focusable>('userRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')
const queryRef = useTemplateRef<Focusable>('queryRef')
const urlRef = useTemplateRef<Focusable>('urlRef')
const usernameRef = useTemplateRef<Focusable>('usernameRef')
const groupsRef = useTemplateRef<Focusable>('groupsRef')
const testButtonRef = useTemplateRef<HTMLElement>('testButtonRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  host: hostRef,
  port: portRef,
  database: databaseRef,
  user: userRef,
  password: passwordRef,
  query: queryRef,
  url: urlRef,
  username: usernameRef,
  groups: groupsRef,
}

const kindOptions = computed(() =>
  PHONEBOOK_SOURCE_KINDS.map((kind) => ({
    id: kind,
    label: t(`integrations.phonebook.kind_${kind}`),
  })),
)

const intervalOptions = computed(() =>
  PHONEBOOK_SYNC_INTERVALS.map((minutes) => ({
    id: String(minutes),
    label:
      minutes % 60 === 0
        ? t('integrations.phonebook.every_hours', { count: minutes / 60 }, minutes / 60)
        : t('integrations.phonebook.every_minutes', { count: minutes }, minutes),
  })),
)

const sharingOptions = computed(() => [
  {
    id: 'public',
    label: t('integrations.phonebook.sharing_public'),
    description: t('integrations.phonebook.sharing_public_description'),
  },
  {
    id: 'groups',
    label: t('integrations.phonebook.sharing_groups'),
    description: t('integrations.phonebook.sharing_groups_description'),
  },
])

const groupOptions = computed<NeMultiselectComboboxOption[]>(() =>
  (groupsState.value.data ?? []).map((name) => ({ id: name, label: name })),
)

const selectedGroups = computed<NeMultiselectComboboxOption[]>({
  get: () => form.value.groups.map((name) => ({ id: name, label: name })),
  set: (options) => {
    form.value.groups = options.map((option) => option.id)
  },
})

const kind = computed({
  get: () => form.value.kind,
  set: (value: string) => {
    if (isPhonebookSourceKind(value) && value !== form.value.kind) {
      form.value.kind = value
      form.value.port = getDefaultPort(value)
      form.value.mapping = {}
      testResult.value = undefined
    }
  },
})

const interval = computed({
  get: () => String(form.value.interval),
  set: (value: string) => {
    form.value.interval = Number(value)
  },
})

const sharing = computed({
  get: () => form.value.sharing,
  set: (value: string) => {
    form.value.sharing = value === 'groups' ? 'groups' : 'public'
  },
})

const testedColumns = computed(() =>
  testResult.value?.ok ? testResult.value.columns : ([] as string[]),
)

const mappingColumns = computed(() => getMappingColumns(testedColumns.value, form.value.mapping))

const fields = computed(() => fieldsState.value.data ?? [])

const hasStoredPassword = computed(() => !!currentSource?.password)

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (sourceForm: PhonebookSourceForm) =>
    savePhonebookSource(buildPhonebookSourcePayload(sourceForm, currentSource), currentSource?.id),
  onSuccess(_data, sourceForm) {
    const edited = !!currentSource

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.phonebook.source_saved')
          : t('integrations.phonebook.source_created'),
        description: t(
          edited ? 'common.object_saved_successfully' : 'common.object_created_successfully',
          { name: sourceForm.name.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [PHONEBOOK_SOURCES_KEY] })
  },
})

const {
  mutate: testMutate,
  isLoading: testing,
  reset: testReset,
  error: testError,
} = useMutation({
  mutation: (sourceForm: PhonebookSourceForm) =>
    testPhonebookSource(buildPhonebookTestPayload(sourceForm, currentSource)),
  onSuccess(result) {
    testResult.value = result
  },
})

const {
  mutate: uploadMutate,
  isLoading: uploading,
  reset: uploadReset,
  error: uploadError,
} = useMutation({
  mutation: (file: File) => uploadPhonebookCsv(file),
  onSuccess(uri) {
    form.value.url = uri
    testResult.value = undefined
  },
})

const busy = computed(() => saving.value || testing.value || uploading.value)

watch(
  () => isShown,
  () => {
    if (isShown) {
      saveReset()
      testReset()
      uploadReset()
      testResult.value = undefined
      csvFile.value = null
      validationIssues.value = {}
      form.value = currentSource ? toPhonebookSourceForm(currentSource) : emptyPhonebookSourceForm()
      focusElement(nameRef)
    }
  },
)

watch(csvFile, (file) => {
  if (file) {
    uploadMutate(file)
  }
})

function getFieldOptions(column: string) {
  return [
    { id: '', label: t('integrations.phonebook.not_imported') },
    ...getAvailableFields(fields.value, form.value.mapping, column, form.value.kind).map(
      (field) => ({ id: field, label: field }),
    ),
  ]
}

function setMapping(column: string, field: string) {
  form.value.mapping = { ...form.value.mapping, [column]: field }
}

function testSource() {
  testReset()
  testResult.value = undefined
  const issues = validatePhonebookSourceForm(
    { ...form.value, name: form.value.name || '-', mapping: { '-': '-' } },
    currentSource,
  )
  delete issues.groups
  validationIssues.value = issues
  const [firstInvalidField] = Object.keys(issues)

  if (firstInvalidField) {
    fieldRefs[firstInvalidField]?.value?.focus()
    return
  }
  testMutate({ ...form.value })
}

function save() {
  saveReset()
  validationIssues.value = validatePhonebookSourceForm(form.value, currentSource)
  const [firstInvalidField] = Object.keys(validationIssues.value)

  if (firstInvalidField === 'mapping') {
    testButtonRef.value?.focus()
    return
  }

  if (firstInvalidField) {
    fieldRefs[firstInvalidField]?.value?.focus()
    return
  }
  saveMutate({ ...form.value, mapping: { ...form.value.mapping } })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="
      currentSource
        ? t('integrations.phonebook.edit_source')
        : t('integrations.phonebook.create_source')
    "
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeHeading tag="h6">{{ t('integrations.phonebook.connection') }}</NeHeading>
        <NeTextInput
          v-if="currentSource"
          :model-value="t(`integrations.phonebook.kind_${form.kind}`)"
          :label="t('integrations.phonebook.source_type')"
          :helper-text="t('integrations.phonebook.source_type_locked')"
          readonly
        />
        <NeCombobox
          v-else
          v-model="kind"
          :label="t('integrations.phonebook.source_type')"
          :options="kindOptions"
          :disabled="busy"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.phonebook.phonebook_name')"
          :helper-text="t('integrations.phonebook.phonebook_name_helper')"
          :invalid-message="validationIssues.name ? t(validationIssues.name) : ''"
          :disabled="busy"
          @blur="form.name = form.name.trim()"
        />
        <template v-if="isDatabaseKind(form.kind)">
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <NeTextInput
              ref="hostRef"
              v-model="form.host"
              :label="t('integrations.host')"
              :invalid-message="validationIssues.host ? t(validationIssues.host) : ''"
              :disabled="busy"
              class="sm:col-span-2"
              @blur="form.host = form.host.trim()"
            />
            <NeTextInput
              ref="portRef"
              v-model="form.port"
              :label="t('integrations.port')"
              inputmode="numeric"
              :invalid-message="validationIssues.port ? t(validationIssues.port) : ''"
              :disabled="busy"
              @blur="form.port = form.port.trim()"
            />
          </div>
          <NeTextInput
            ref="databaseRef"
            v-model="form.database"
            :label="t('integrations.database')"
            :invalid-message="validationIssues.database ? t(validationIssues.database) : ''"
            :disabled="busy"
            @blur="form.database = form.database.trim()"
          />
          <NeTextInput
            ref="userRef"
            v-model="form.user"
            :label="t('integrations.user')"
            autocomplete="off"
            :invalid-message="validationIssues.user ? t(validationIssues.user) : ''"
            :disabled="busy"
            @blur="form.user = form.user.trim()"
          />
        </template>
        <template v-else>
          <div class="flex flex-col gap-3">
            <NeTextInput
              ref="urlRef"
              v-model="form.url"
              :label="t('integrations.url')"
              :placeholder="
                form.kind === 'csv'
                  ? 'https://files.example.com/contacts.csv'
                  : 'https://infinity.example.com/api'
              "
              :helper-text="form.kind === 'csv' ? t('integrations.phonebook.csv_url_helper') : ''"
              :invalid-message="validationIssues.url ? t(validationIssues.url) : ''"
              :disabled="busy"
              @blur="form.url = form.url.trim()"
            />
            <template v-if="form.kind === 'csv'">
              <NeFileInput
                v-model="csvFile"
                :label="t('integrations.phonebook.upload_csv')"
                :helper-text="
                  isUploadedCsv(form.url)
                    ? t('integrations.phonebook.csv_uploaded')
                    : t('integrations.phonebook.upload_csv_helper')
                "
                :dropzone-label="t('ne_file_input.drag_and_drop_or_click_to_upload')"
                accept=".csv,text/csv"
                :show-progress="uploading"
                :progress="uploading ? 50 : 0"
              />
              <NeInlineNotification
                v-if="uploadError"
                kind="error"
                :title="t('integrations.phonebook.cannot_upload_csv')"
                :description="getLegacyStatusMessage(uploadError) || describeError(uploadError)"
              />
            </template>
          </div>
          <NeTextInput
            v-if="form.kind === 'infinity'"
            ref="usernameRef"
            v-model="form.username"
            :label="t('integrations.user')"
            autocomplete="off"
            :invalid-message="validationIssues.username ? t(validationIssues.username) : ''"
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
          :helper-text="hasStoredPassword ? t('integrations.password_keep_helper') : ''"
          :invalid-message="validationIssues.password ? t(validationIssues.password) : ''"
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
          :invalid-message="validationIssues.query ? t(validationIssues.query) : ''"
          :disabled="busy"
        />
        <div class="flex flex-col gap-3">
          <div ref="testButtonRef" tabindex="-1" class="outline-none">
            <NeButton
              type="button"
              kind="secondary"
              :disabled="busy"
              :loading="testing"
              @click="testSource"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faPlugCircleBolt" class="h-4 w-4" aria-hidden="true" />
              </template>
              {{ t('integrations.phonebook.test_source') }}
            </NeButton>
          </div>
          <NeInlineNotification
            v-if="testError"
            kind="error"
            :title="t('integrations.phonebook.test_failed')"
            :description="getLegacyStatusMessage(testError) || describeError(testError)"
          />
          <NeInlineNotification
            v-else-if="testResult && !testResult.ok"
            kind="error"
            :title="t('integrations.phonebook.test_failed')"
            :description="t('integrations.phonebook.test_failed_description')"
          />
          <template v-else-if="testResult?.ok">
            <p class="flex items-center gap-2 text-sm text-green-700 dark:text-green-500">
              <FontAwesomeIcon :icon="faCircleCheck" class="h-4 w-4" aria-hidden="true" />
              {{
                testResult.rows.length
                  ? t('integrations.phonebook.test_succeeded', { count: testResult.rows.length })
                  : t('integrations.phonebook.test_succeeded_empty')
              }}
            </p>
            <div
              v-if="testResult.rows.length"
              class="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-600"
            >
              <table class="min-w-full text-left text-sm">
                <caption class="sr-only">
                  {{
                    t('integrations.phonebook.preview')
                  }}
                </caption>
                <thead class="elevation-1">
                  <tr>
                    <th
                      v-for="column in testResult.columns"
                      :key="column"
                      scope="col"
                      class="px-3 py-2 font-medium whitespace-nowrap"
                    >
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in testResult.rows"
                    :key="index"
                    class="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td
                      v-for="column in testResult.columns"
                      :key="column"
                      class="text-secondary-neutral max-w-48 truncate px-3 py-2"
                    >
                      {{ row[column] || '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
        <NeHeading tag="h6" class="mt-2">{{ t('integrations.phonebook.field_mapping') }}</NeHeading>
        <template v-if="form.kind === 'infinity'">
          <p class="text-secondary-neutral text-sm">
            {{ t('integrations.phonebook.infinity_mapping') }}
          </p>
          <ul class="flex flex-col gap-2 text-sm">
            <li
              v-for="row in INFINITY_FIELD_MAPPING"
              :key="row.source"
              class="flex items-center gap-3"
            >
              <span class="w-48">{{ t(`integrations.phonebook.infinity_${row.source}`) }}</span>
              <FontAwesomeIcon
                :icon="faArrowRight"
                class="text-tertiary-neutral h-3 w-3"
                aria-hidden="true"
              />
              <span class="font-mono">{{ row.field }}</span>
            </li>
          </ul>
        </template>
        <template v-else>
          <p class="text-secondary-neutral text-sm">
            {{ t('integrations.phonebook.mapping_description') }}
          </p>
          <NeInlineNotification
            v-if="mappingColumns.length === 0"
            :kind="validationIssues.mapping ? 'error' : 'info'"
            :description="t('integrations.phonebook.mapping_needs_test')"
          />
          <template v-else>
            <NeInlineNotification
              v-if="fieldsState.status === 'error'"
              kind="error"
              :title="t('integrations.phonebook.cannot_load_fields')"
              :description="describeError(fieldsState.error)"
            />
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NeCombobox
                v-for="column in mappingColumns"
                :key="column"
                :model-value="form.mapping[column] ?? ''"
                :label="column"
                :options="getFieldOptions(column)"
                :disabled="busy || fieldsState.status !== 'success'"
                :no-results-label="t('ne_combobox.no_results')"
                :limited-options-label="t('ne_combobox.limited_options_label')"
                :no-options-label="t('ne_combobox.no_options_label')"
                :selected-label="t('ne_combobox.selected')"
                :user-input-label="t('ne_combobox.user_input_label')"
                :optional-label="t('common.optional')"
                @update:model-value="(value: unknown) => setMapping(column, String(value ?? ''))"
              />
            </div>
            <p v-if="validationIssues.mapping" class="text-sm text-rose-700 dark:text-rose-400">
              {{ t(validationIssues.mapping) }}
            </p>
          </template>
        </template>
        <NeHeading tag="h6" class="mt-2">{{ t('integrations.phonebook.settings') }}</NeHeading>
        <NeCombobox
          v-model="interval"
          :label="t('integrations.phonebook.sync_interval')"
          :options="intervalOptions"
          :disabled="busy"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeRadioSelection
          v-model="sharing"
          :label="t('integrations.phonebook.sharing')"
          :options="sharingOptions"
          :disabled="busy"
        />
        <template v-if="form.sharing === 'groups'">
          <NeMultiselectCombobox
            ref="groupsRef"
            v-model="selectedGroups"
            :label="t('integrations.phonebook.groups')"
            :options="groupOptions"
            :placeholder="t('ne_combobox.choose_multiple')"
            :invalid-message="validationIssues.groups ? t(validationIssues.groups) : ''"
            :disabled="busy"
            :loading-options="groupsState.status === 'pending'"
            :no-results-label="t('ne_combobox.no_results')"
            :limited-options-label="t('ne_combobox.limited_options_label')"
            :no-options-label="t('integrations.phonebook.no_groups')"
            :user-input-label="t('ne_combobox.user_input_label')"
            :optional-label="t('common.optional')"
            :remove-label="t('common.remove')"
          />
          <NeInlineNotification
            v-if="groupsState.status === 'error'"
            kind="error"
            :title="t('integrations.phonebook.cannot_load_groups')"
            :description="describeError(groupsState.error)"
          />
        </template>
        <div>
          <NeFormItemLabel>{{ t('common.status') }}</NeFormItemLabel>
          <NeToggle
            v-model="form.enabled"
            :label="form.enabled ? t('common.enabled') : t('common.disabled')"
            :disabled="busy"
          />
        </div>
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            currentSource
              ? t('integrations.phonebook.cannot_save_source')
              : t('integrations.phonebook.cannot_create_source')
          "
          :description="getLegacyStatusMessage(saveError) || describeError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end">
        <NeButton
          type="button"
          kind="tertiary"
          size="lg"
          :disabled="saving"
          class="mr-3"
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="busy" :loading="saving">
          {{ currentSource ? t('common.save') : t('integrations.phonebook.create_source') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
