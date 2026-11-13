<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import {
  analyzeImport,
  buildCsvTemplate,
  DEFAULT_EXISTING_USERS_MODE,
  downloadTextFile,
  exceedsImportSizeLimit,
  IMPORT_ISSUES_SHOWN,
  IMPORT_PREVIEW_ROWS,
  importUsers,
  isCsvImportError,
  isImportFileError,
  parseImportFile,
  toLegacyCsv,
  type ExistingUsersMode,
  type ImportRow,
  type ImportRowError,
} from '@/lib/users/csv'
import type { UsersDirectory } from '@/lib/users/directory'
import { UserSettingsStepError } from '@/lib/users/userSettings'
import { MAX_DEVICES_PER_USER, type User } from '@/lib/users/users'
import { useInvalidateUsers } from '@/queries/users/users'
import { describeError, useNotificationsStore } from '@/stores/notifications'

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

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const invalidateUsers = useInvalidateUsers()

type ImportStep = 'file' | 'preview'

const PANEL_SWITCH_TIMEOUT_MS = 1500

const step = ref<ImportStep>('file')
const visiblePanel = ref<ImportStep | null>(null)
let panelFrame: number | undefined
const file = ref<File | null>(null)
const fileError = ref('')
const rows = ref<ImportRow[]>([])
const existingUsersMode = ref<ExistingUsersMode>(DEFAULT_EXISTING_USERS_MODE)
const progress = ref(0)
const showAllErrors = ref(false)

const analysis = computed(() =>
  analyzeImport(rows.value, users, directory, existingUsersMode.value),
)

const previewRows = computed(() => rows.value.slice(0, IMPORT_PREVIEW_ROWS))

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
  { id: 'overwrite', label: t('users.import_overwrite_existing') },
  { id: 'skip', label: t('users.import_skip_existing') },
])

const hasExistingUsers = computed(() =>
  rows.value.some((row) => users.some((user) => user.username === row.username)),
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
    const valid = analysis.value.valid
    await importUsers(valid, users, directory, (value) => {
      progress.value = value
    })
    return valid.map((row) => row.username)
  },
  onSuccess(usernames) {
    const count = usernames.length

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('users.users_imported'),
        description: t('users.users_imported_description', { count }, count),
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
  return error.code === 'import_failed' && error.message
    ? error.message
    : t(`users.import_error_${error.code}`)
})

async function readFile() {
  if (!file.value) {
    fileError.value = t('users.import_choose_file')
    return
  }

  try {
    const parsed = parseImportFile(await file.value.text())

    if (parsed.length === 0) {
      fileError.value = t('users.import_no_users_in_file')
      return
    }
    rows.value = parsed
    showStep('preview')
  } catch (error) {
    fileError.value = isImportFileError(error)
      ? t(`users.import_error_${error.code}`)
      : t('users.import_cannot_read_file')
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

const issueLabel = (error: ImportRowError) =>
  t(`users.import_issue_${error.issue}`, {
    group: error.group ?? '',
    reason: error.reason ? t(error.reason) : '',
    max: MAX_DEVICES_PER_USER,
  })

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
        <NeButton kind="primary" type="submit">{{ t('users.import') }}</NeButton>
      </div>
    </form>
  </NeSideDrawer>
  <NeModal
    :visible="isShown && visiblePanel === 'preview'"
    :title="t('users.import_users')"
    size="xxl"
    :primary-label="
      t('users.import_n_users', { count: analysis.valid.length }, analysis.valid.length)
    "
    :primary-button-disabled="importing || analysis.valid.length === 0 || fileTooLarge"
    :primary-button-loading="importing"
    :secondary-label="t('common.previous')"
    secondary-button-kind="tertiary"
    :secondary-button-disabled="importing"
    :cancel-label="t('common.cancel')"
    :close-aria-label="t('common.close')"
    @close="close"
    @primary-click="startImport()"
    @secondary-click="showStep('file')"
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
            <li>{{ t('users.import_valid', { count: analysis.valid.length }) }}</li>
            <li v-if="analysis.errors.length" class="text-rose-700 dark:text-rose-400">
              {{ t('users.import_with_errors', { count: analysis.errors.length }) }}
            </li>
            <li v-if="analysis.existing.length" class="text-amber-700 dark:text-amber-400">
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
                  issue: issueLabel(item),
                })
              }}
            </li>
          </ul>
          <button
            v-if="hiddenErrorsCount > 0"
            type="button"
            class="mt-1 font-medium underline"
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
            class="bg-primary-700 dark:bg-primary-500 rounded-t-md px-4 py-1 text-sm font-medium text-white dark:text-gray-950"
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
        <div class="flex items-center gap-2">
          <span class="text-primary-neutral text-sm font-medium">{{
            t('users.existing_users')
          }}</span>
          <NeTooltip trigger-event="mouseenter focus" placement="top">
            <template #trigger>
              <span tabindex="0" class="flex text-indigo-500 dark:text-indigo-300">
                <FontAwesomeIcon :icon="faCircleInfo" class="size-4" aria-hidden="true" />
                <span class="sr-only">{{ t('users.existing_users_tooltip') }}</span>
              </span>
            </template>
            <template #content>{{ t('users.existing_users_tooltip') }}</template>
          </NeTooltip>
        </div>
        <NeRadioSelection
          v-model="existingUsersMode"
          name="existing-users"
          :options="existingModeOptions"
          :disabled="importing"
        />
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
