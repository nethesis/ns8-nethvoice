<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useMutation } from '@pinia/colada'
import {
  NeButton,
  NeFileInput,
  NeInlineNotification,
  NeModal,
  NeProgressBar,
  NeRadioSelection,
  NeSideDrawer,
  NeTable,
  NeTableBody,
  NeTableCell,
  NeTableHead,
  NeTableHeadCell,
  NeTableRow,
  NeTooltip,
  focusElement,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import {
  analyzeImport,
  buildCsvTemplate,
  DEFAULT_EXISTING_USERS_MODE,
  DISPLAY_NAME_MAX_LENGTH,
  downloadTextFile,
  exceedsImportSizeLimit,
  IMPORT_ISSUES_SHOWN,
  IMPORT_PREVIEW_ROWS,
  importUsers,
  isCsvImportError,
  isImportFileError,
  parseImportFile,
  toLegacyCsv,
  USERNAME_MAX_LENGTH,
  type ExistingUsersMode,
  type ImportRow,
  type ImportFlagColumn,
  type ImportRowError,
  type ImportRowIssue,
} from '@/lib/users/csv'
import { GROUP_NAME_MAX_LENGTH } from '@/lib/groups/groups'
import {
  DIRECTORY_PART_LABELS,
  DIRECTORY_PARTS,
  type DirectoryPart,
  type UsersDirectory,
} from '@/lib/users/directory'
import { describeImportProblems } from '@/lib/users/importErrors'
import { UserSettingsStepError } from '@/lib/users/userSettings'
import { findUserByUsername, MAX_DEVICES_PER_USER, type User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { useUsersDirectory } from '@/queries/users/usersDirectory'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useFocusReturn } from '@/composables/useFocusReturn'

const {
  isShown = false,
  users,
  directory,
} = defineProps<{
  isShown: boolean
  users: User[]
  directory: UsersDirectory
}>()

const emit = defineEmits<{ close: []; imported: [usernames: string[]] }>()

useFocusReturn(() => isShown)

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()
const directoryQuery = useUsersDirectory()

type ImportStep = 'file' | 'preview'

const PANEL_SWITCH_TIMEOUT_MS = 1500

const step = ref<ImportStep>('file')
const visiblePanel = ref<ImportStep | null>(null)
let panelFrame: number | undefined
const file = ref<File | null>(null)
const fileError = ref('')
const fileRef = useTemplateRef<{ focus(): void }>('fileRef')
const rows = ref<ImportRow[]>([])
const existingUsersMode = ref<ExistingUsersMode>(DEFAULT_EXISTING_USERS_MODE)
const progress = ref(0)
const showAllErrors = ref(false)

const analysis = computed(() =>
  analyzeImport(rows.value, users, directory, existingUsersMode.value),
)

const previewRows = computed(() => rows.value.slice(0, IMPORT_PREVIEW_ROWS))

const noValidRows = computed(() => {
  const skipping = analyzeImport(rows.value, users, directory, 'skip')

  return rows.value.length > 0 && skipping.valid.length === 0 && skipping.existing.length === 0
})

const fileTooLarge = computed(() =>
  exceedsImportSizeLimit(toLegacyCsv(analysis.value.valid, users, directory)),
)

const showsVoicemailColumn = computed(() => rows.value.some((row) => row.voicemail !== null))

const showsDevicesColumn = computed(() =>
  rows.value.some((row) => row.webrtc !== null || row.nethlink !== null || row.mobileApp !== null),
)

const shownErrors = computed(() =>
  showAllErrors.value ? analysis.value.errors : analysis.value.errors.slice(0, IMPORT_ISSUES_SHOWN),
)

const hiddenErrorsCount = computed(() => analysis.value.errors.length - shownErrors.value.length)

const existingModeOptions = computed(() => [
  { id: 'skip', label: t('users.import_skip_existing') },
  { id: 'overwrite', label: t('users.import_overwrite_existing') },
])

const hasExistingUsers = computed(() =>
  rows.value.some((row) => findUserByUsername(users, row.username) !== undefined),
)

const unavailableDirectoryParts = computed<readonly DirectoryPart[]>(() =>
  directoryQuery.state.value.status === 'error' ? DIRECTORY_PARTS : (directory.unavailable ?? []),
)

const directoryIncomplete = computed(
  () =>
    directoryQuery.state.value.status === 'pending' || unavailableDirectoryParts.value.length > 0,
)

const unavailableDirectoryLabels = computed(() =>
  unavailableDirectoryParts.value.map((part) => t(DIRECTORY_PART_LABELS[part])).join(', '),
)

watch(
  () => isShown,
  (shown) => {
    cancelPanelSwitch()

    if (shown) {
      step.value = 'file'
      visiblePanel.value = 'file'
      file.value = null
      fileError.value = ''
      rows.value = []
      existingUsersMode.value = DEFAULT_EXISTING_USERS_MODE
      showAllErrors.value = false
      resetImport()
    } else {
      visiblePanel.value = null
    }
  },
)

onBeforeUnmount(cancelPanelSwitch)

function cancelPanelSwitch() {
  if (panelFrame !== undefined) {
    cancelAnimationFrame(panelFrame)
    panelFrame = undefined
  }
}

function showStep(next: ImportStep) {
  step.value = next
  visiblePanel.value = null
  cancelPanelSwitch()
  const startedAt = performance.now()
  const showWhenPreviousPanelIsGone = () => {
    panelFrame = undefined
    if (!isShown) {
      return
    }
    const previousPanelOpen = document.querySelector('[role="dialog"]') !== null
    if (!previousPanelOpen || performance.now() - startedAt > PANEL_SWITCH_TIMEOUT_MS) {
      visiblePanel.value = next
      return
    }
    panelFrame = requestAnimationFrame(showWhenPreviousPanelIsGone)
  }
  panelFrame = requestAnimationFrame(showWhenPreviousPanelIsGone)
}

watch(file, () => {
  fileError.value = ''
})

const {
  mutate: startImport,
  isLoading: importing,
  error: importError,
  reset: resetImport,
} = useMutation({
  mutation: async () => {
    progress.value = 0
    const { valid, existing, errors } = analysis.value
    const updated = valid.filter((row) => findUserByUsername(users, row.username) !== undefined)
    await importUsers(valid, users, directory, (value) => {
      progress.value = value
    })
    return {
      usernames: valid.map((row) => row.username),
      created: valid.length - updated.length,
      updated: updated.length,
      skipped: existing.length + errors.length,
    }
  },
  onSuccess({ usernames, created, updated, skipped }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.users_imported'),
        description: t('users.users_imported_description', { created, updated, skipped }),
      })
    }, 500)
    emit('imported', usernames)
    emit('close')
  },
  onSettled() {
    invalidateUsers()
  },
})

const importErrorTitle = computed(() =>
  isCsvImportError(importError.value) && importError.value.code === 'settings_failed'
    ? t('users.import_settings_failed')
    : t('users.import_failed'),
)

const importErrorDescription = computed(() => {
  const error = importError.value

  if (!isCsvImportError(error)) {
    return describeError(error)
  }

  if (error.code === 'settings_failed') {
    const cause = error.cause

    return t('users.import_error_settings_failed', {
      username: error.message,
      step:
        cause instanceof UserSettingsStepError
          ? t(`users.step_failed_${cause.step.kind}`)
          : t('common.request_failed'),
      error: describeError(cause instanceof UserSettingsStepError ? cause.cause : cause),
    })
  }
  if (error.code === 'import_failed' && error.problems.length > 0) {
    const imported = analysis.value.valid
    return describeImportProblems(error.problems, t, (line) => imported[line - 1]?.line)
  }
  return t(`users.import_error_${error.code}`)
})

async function readFile() {
  if (!file.value) {
    fileError.value = t('users.import_choose_file')
    focusElement(fileRef)
    return
  }

  try {
    const parsed = parseImportFile(await file.value.text())

    if (parsed.length === 0) {
      fileError.value = t('users.import_no_users_in_file')
      focusElement(fileRef)
      return
    }
    rows.value = parsed
    showStep('preview')
  } catch (error) {
    fileError.value = isImportFileError(error)
      ? t(`users.import_error_${error.code}`)
      : t('users.import_cannot_read_file')
    focusElement(fileRef)
  }
}

function downloadTemplate() {
  downloadTextFile('users-template.csv', buildCsvTemplate())
}

function close() {
  if (!importing.value) {
    emit('close')
  }
}

const FLAG_COLUMN_LABELS: Record<ImportFlagColumn, string> = {
  voicemail: 'users.voicemail',
  webrtc: 'users.device_webrtc',
  nethlink: 'users.device_nethlink',
  mobileApp: 'users.device_mobile',
}

const issueLabel = (issue: ImportRowIssue) =>
  t(`users.import_issue_${issue.issue}`, {
    group: issue.group ?? '',
    reason: issue.reason ? t(issue.reason, { max: GROUP_NAME_MAX_LENGTH }) : '',
    max: MAX_DEVICES_PER_USER,
    usernameMax: USERNAME_MAX_LENGTH,
    nameMax: DISPLAY_NAME_MAX_LENGTH,
    column: issue.column ? t(FLAG_COLUMN_LABELS[issue.column]) : '',
    value: issue.value ?? '',
  })

const issuesLabel = (error: ImportRowError) => error.issues.map(issueLabel).join('; ')

const formatFlag = (flag: boolean | null) =>
  flag === null ? '-' : flag ? t('common.enabled') : t('common.disabled')

const formatDevices = (row: ImportRow) => {
  const devices = [
    row.webrtc === true ? t('users.device_webrtc') : '',
    row.nethlink === true ? t('users.device_nethlink') : '',
    row.mobileApp === true ? t('users.device_mobile') : '',
  ].filter(Boolean)

  return devices.length ? devices.join(', ') : '-'
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown && visiblePanel === 'file'"
    :title="t('users.import_users')"
    :close-aria-label="t('common.close')"
    @close="close"
  >
    <form class="flex flex-col gap-6" @submit.prevent="readFile">
      <div class="flex flex-col gap-2">
        <NeFileInput
          ref="fileRef"
          v-model="file"
          :label="t('users.csv_file')"
          :dropzone-label="t('ne_file_input.drag_and_drop_or_click_to_upload')"
          :invalid-message="fileError"
          accept=".csv,text/csv"
        />
        <p class="text-secondary-neutral text-xs">
          <button
            type="button"
            class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 font-medium"
            @click="downloadTemplate"
          >
            {{ t('users.download_template') }}
          </button>
          {{ t('users.download_template_suffix') }}
        </p>
      </div>
      <div class="flex justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        <NeButton kind="tertiary" @click="close">{{ t('common.cancel') }}</NeButton>
        <NeButton kind="primary" type="submit">{{ t('common.import') }}</NeButton>
      </div>
    </form>
  </NeSideDrawer>
  <NeModal
    :visible="isShown && visiblePanel === 'preview' && noValidRows"
    :title="t('users.import_users')"
    :primary-label="t('common.close')"
    :close-aria-label="t('common.close')"
    @close="close"
    @primary-click="close"
  >
    <div class="flex flex-col gap-6" data-testid="import-no-valid-rows">
      <div class="text-primary-neutral flex flex-col gap-1 text-sm" data-testid="import-summary">
        <span>{{
          t('users.import_users_detected', { count: analysis.total }, analysis.total)
        }}</span>
        <ul class="list-inside list-disc">
          <li>{{ t('users.import_valid', { count: 0 }, 0) }}</li>
          <li>
            {{
              t(
                'users.import_with_errors',
                { count: analysis.errors.length },
                analysis.errors.length,
              )
            }}
          </li>
        </ul>
      </div>
      <NeInlineNotification kind="error" :title="t('users.import_no_valid_rows')">
        <template #description>
          <p>{{ t('users.import_no_valid_rows_description') }}</p>
          <ul class="mt-2 list-inside list-disc">
            <li v-for="item in shownErrors" :key="item.row.line">
              {{
                t('users.import_row_issue', {
                  row: item.row.line,
                  username: item.row.username || '-',
                  issue: issuesLabel(item),
                })
              }}
            </li>
          </ul>
          <button
            v-if="hiddenErrorsCount > 0"
            type="button"
            class="mt-1 underline"
            @click="showAllErrors = true"
          >
            {{ t('common.plus_n_more', { count: hiddenErrorsCount }) }}
          </button>
        </template>
      </NeInlineNotification>
      <I18nT keypath="users.import_check_format" tag="p" class="text-primary-neutral text-sm">
        <template #link>
          <button
            type="button"
            class="text-primary-700 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 font-medium"
            @click="downloadTemplate"
          >
            {{ t('users.download_template_file') }}
          </button>
        </template>
      </I18nT>
    </div>
  </NeModal>
  <NeModal
    :visible="isShown && visiblePanel === 'preview' && !noValidRows"
    :title="t('users.import_users')"
    size="xxl"
    :primary-label="t('common.import')"
    :primary-button-disabled="
      importing || analysis.valid.length === 0 || fileTooLarge || directoryIncomplete
    "
    :primary-button-loading="importing"
    :cancel-label="t('common.cancel')"
    :close-aria-label="t('common.close')"
    @close="close"
    @primary-click="startImport()"
  >
    <div class="flex flex-col gap-6">
      <div class="text-primary-neutral flex flex-col gap-1 text-sm" data-testid="import-summary">
        <template v-if="analysis.errors.length === 0 && analysis.existing.length === 0">
          <span>{{
            t('users.import_summary_detected', {
              users: t('users.import_summary_users', { count: analysis.total }, analysis.total),
              groups: t(
                'users.import_summary_groups',
                { count: analysis.groups.length },
                analysis.groups.length,
              ),
            })
          }}</span>
        </template>
        <template v-else>
          <span>{{
            t('users.import_users_detected', { count: analysis.total }, analysis.total)
          }}</span>
          <ul class="list-inside list-disc">
            <li>
              {{ t('users.import_valid', { count: analysis.valid.length }, analysis.valid.length) }}
            </li>
            <li v-if="analysis.errors.length">
              {{
                t(
                  'users.import_with_errors',
                  { count: analysis.errors.length },
                  analysis.errors.length,
                )
              }}
            </li>
            <li v-if="analysis.existing.length">
              {{
                t(
                  'users.import_existing_skipped',
                  { count: analysis.existing.length },
                  analysis.existing.length,
                )
              }}
            </li>
          </ul>
        </template>
        <span v-if="analysis.newGroups.length" data-testid="import-new-groups">
          {{
            t(
              'users.import_new_groups',
              { count: analysis.newGroups.length, names: analysis.newGroups.join(', ') },
              analysis.newGroups.length,
            )
          }}
        </span>
      </div>
      <NeInlineNotification
        v-if="unavailableDirectoryLabels"
        kind="warning"
        :title="t('users.directory_partially_loaded')"
        :description="
          t('users.import_directory_partially_loaded_description', {
            parts: unavailableDirectoryLabels,
          })
        "
        :primary-button-label="t('common.retry')"
        data-testid="import-directory-warning"
        @primary-click="directoryQuery.refetch()"
      />
      <NeInlineNotification
        v-if="fileTooLarge"
        kind="error"
        :title="t('users.import_file_too_large')"
        :description="t('users.import_error_file_too_large')"
      />
      <NeInlineNotification
        v-if="analysis.errors.length"
        kind="error"
        :title="
          t('users.import_errors_title', { count: analysis.errors.length }, analysis.errors.length)
        "
      >
        <template #description>
          <ul class="list-inside list-disc">
            <li v-for="item in shownErrors" :key="item.row.line">
              {{
                t('users.import_row_issue', {
                  row: item.row.line,
                  username: item.row.username || '-',
                  issue: issuesLabel(item),
                })
              }}
            </li>
          </ul>
          <button
            v-if="hiddenErrorsCount > 0"
            type="button"
            class="mt-1 underline"
            @click="showAllErrors = true"
          >
            {{ t('common.plus_n_more', { count: hiddenErrorsCount }) }}
          </button>
        </template>
      </NeInlineNotification>
      <NeInlineNotification
        v-if="analysis.existing.length"
        kind="warning"
        :title="
          t(
            'users.import_existing_title',
            { count: analysis.existing.length },
            analysis.existing.length,
          )
        "
      >
        <template #description>
          <ul class="list-inside list-disc">
            <li v-for="row in analysis.existing.slice(0, IMPORT_ISSUES_SHOWN)" :key="row.line">
              {{ t('users.import_row', { row: row.line, username: row.username }) }}
            </li>
          </ul>
          <span v-if="analysis.existing.length > IMPORT_ISSUES_SHOWN">
            {{ t('common.plus_n_more', { count: analysis.existing.length - IMPORT_ISSUES_SHOWN }) }}
          </span>
        </template>
      </NeInlineNotification>
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-end justify-between gap-2">
          <span
            class="text-primary-neutral rounded-t-md bg-indigo-300 px-4 py-1 text-sm dark:bg-indigo-800"
          >
            {{ t('users.file_preview') }}
          </span>
          <span v-if="rows.length > IMPORT_PREVIEW_ROWS" class="text-secondary-neutral text-xs">
            {{ t('users.only_first_rows_shown', { count: IMPORT_PREVIEW_ROWS }) }}
          </span>
        </div>
        <NeTable :aria-label="t('users.file_preview')" card-breakpoint="md">
          <NeTableHead>
            <NeTableHeadCell>{{ t('users.username') }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t('users.name') }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t('users.surname') }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t('users.extension') }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t('users.group') }}</NeTableHeadCell>
            <NeTableHeadCell>{{ t('users.profile') }}</NeTableHeadCell>
            <NeTableHeadCell v-if="showsVoicemailColumn">{{
              t('users.voicemail')
            }}</NeTableHeadCell>
            <NeTableHeadCell v-if="showsDevicesColumn">{{ t('users.devices') }}</NeTableHeadCell>
          </NeTableHead>
          <NeTableBody>
            <NeTableRow v-for="row in previewRows" :key="row.line">
              <NeTableCell :data-label="t('users.username')">{{ row.username || '-' }}</NeTableCell>
              <NeTableCell :data-label="t('users.name')">{{ row.name || '-' }}</NeTableCell>
              <NeTableCell :data-label="t('users.surname')">{{ row.surname || '-' }}</NeTableCell>
              <NeTableCell :data-label="t('users.extension')">{{
                row.extension || '-'
              }}</NeTableCell>
              <NeTableCell :data-label="t('users.group')">
                {{ row.groups?.length ? row.groups.join(', ') : '-' }}
              </NeTableCell>
              <NeTableCell :data-label="t('users.profile')">{{ row.profile || '-' }}</NeTableCell>
              <NeTableCell v-if="showsVoicemailColumn" :data-label="t('users.voicemail')">
                {{ formatFlag(row.voicemail) }}
              </NeTableCell>
              <NeTableCell v-if="showsDevicesColumn" :data-label="t('users.devices')">
                {{ formatDevices(row) }}
              </NeTableCell>
            </NeTableRow>
          </NeTableBody>
        </NeTable>
      </div>
      <div v-if="hasExistingUsers" class="flex flex-col gap-2">
        <NeRadioSelection
          v-model="existingUsersMode"
          name="existing-users"
          :label="t('users.existing_users')"
          :options="existingModeOptions"
          :disabled="importing"
        >
          <template #tooltip>
            <NeTooltip trigger-event="mouseenter focus" placement="top">
              <template #trigger>
                <span tabindex="0" class="flex text-indigo-500 dark:text-indigo-300">
                  <FontAwesomeIcon :icon="faCircleInfo" class="size-4" aria-hidden="true" />
                  <span class="sr-only">{{ t('users.existing_users_tooltip') }}</span>
                </span>
              </template>
              <template #content>{{ t('users.existing_users_tooltip') }}</template>
            </NeTooltip>
          </template>
        </NeRadioSelection>
        <p v-if="existingUsersMode === 'overwrite'" class="text-secondary-neutral text-sm">
          {{ t('users.import_overwrite_helper') }}
        </p>
      </div>
      <NeProgressBar
        v-if="importing"
        :progress="progress"
        :label="t('users.importing_users')"
        show-progress
      />
      <NeInlineNotification
        v-if="importError"
        kind="error"
        :title="importErrorTitle"
        :description="importErrorDescription"
      />
    </div>
  </NeModal>
</template>
