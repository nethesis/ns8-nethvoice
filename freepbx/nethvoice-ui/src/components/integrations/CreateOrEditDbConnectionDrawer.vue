<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeSideDrawer,
  NeTextInput,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faArrowRightArrowLeft, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import {
  buildDbConnectionPayload,
  buildDbConnectionTestPayload,
  DB_CONNECTION_MAX_LENGTHS,
  DB_CONNECTION_STATUSES_KEY,
  DB_CONNECTIONS_KEY,
  type DbConnection,
  type DbConnectionForm,
  emptyDbConnectionForm,
  getDbConnectionDefaultPort,
  getDbConnectionTypeLabel,
  isDbConnectionPasswordKept,
  saveDbConnection,
  testDbConnection,
  toDbConnectionForm,
  validateDbConnectionForm,
} from '@/lib/integrations/dbConnections'
import {
  describeIntegrationError,
  getServerErrorField,
  getServerMessageKey,
} from '@/lib/integrations/errors'
import { PORT_RANGE, type FieldIssues } from '@/lib/integrations/validation'
import { useDbConnections, useDbConnectionTypes } from '@/queries/integrations/customerCards'
import { isApiError } from '@/lib/api/errors'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  currentConnection = undefined,
  usedBy = [],
} = defineProps<{
  isShown: boolean
  currentConnection: DbConnection | undefined
  usedBy?: string[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: typesState } = useDbConnectionTypes()
const { state: connectionsState } = useDbConnections()

const form = ref<DbConnectionForm>(emptyDbConnectionForm())
const validationIssues = ref<FieldIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)
let openCount = 0

type DbConnectionSave = { connectionForm: DbConnectionForm; connectionId?: string }

const SERVER_FIELDS: Record<string, keyof DbConnectionForm> = {
  host: 'host',
  port: 'port',
  type: 'type',
  user: 'user',
  pass: 'password',
  name: 'name',
}

useFocusReturn(() => isShown)

const nameRef = useTemplateRef<Focusable>('nameRef')
const typeRef = useTemplateRef<Focusable>('typeRef')
const hostRef = useTemplateRef<Focusable>('hostRef')
const portRef = useTemplateRef<Focusable>('portRef')
const userRef = useTemplateRef<Focusable>('userRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  name: nameRef,
  type: typeRef,
  host: hostRef,
  port: portRef,
  user: userRef,
  password: passwordRef,
}

const passwordHelper = computed(() => {
  if (!currentConnection?.hasPassword) {
    return ''
  }
  return isDbConnectionPasswordKept(form.value, currentConnection)
    ? t('integrations.password_keep_helper')
    : t('integrations.password_server_changed_helper')
})

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const typeOptions = computed(() =>
  (typesState.value.data ?? []).map((type) => ({ id: type.id, label: type.label })),
)

const defaultPort = computed(() => getDbConnectionDefaultPort(form.value.type))

const portHelper = computed(() =>
  defaultPort.value
    ? t('integrations.cards.database_port_helper', {
        type: getDbConnectionTypeLabel(form.value.type, typesState.value.data ?? []),
        port: defaultPort.value,
      })
    : '',
)

const usedByText = computed(() =>
  t('integrations.cards.database_used_by', {
    cards: new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(usedBy),
  }),
)

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: ({ connectionForm, connectionId }: DbConnectionSave) =>
    saveDbConnection(buildDbConnectionPayload(connectionForm), connectionId),
  onError(error) {
    showServerFieldError(error)
  },
  onSuccess(_data, { connectionForm, connectionId }) {
    const edited = !!connectionId

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.cards.connection_updated')
          : t('integrations.cards.connection_created'),
        description: t(
          edited
            ? 'integrations.cards.connection_updated_description'
            : 'integrations.cards.connection_created_description',
          { name: connectionForm.name.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [DB_CONNECTIONS_KEY] })
    queryCache.invalidateQueries({ key: [DB_CONNECTION_STATUSES_KEY] })
  },
})

const {
  mutateAsync: testMutateAsync,
  isLoading: testing,
  reset: testReset,
  error: testError,
  data: testSucceeded,
} = useMutation({
  mutation: (connectionForm: DbConnectionForm) =>
    testDbConnection(buildDbConnectionTestPayload(connectionForm, currentConnection)),
  onError(error) {
    showServerFieldError(error)
  },
})

const busy = computed(() => saving.value || testing.value)

const fieldToFocus = ref('')

watch(busy, async (isBusy) => {
  if (!isBusy && fieldToFocus.value) {
    await nextTick()
    fieldRefs[fieldToFocus.value]?.value?.focus()
    fieldToFocus.value = ''
  }
})

watch(
  () => isShown,
  () => {
    openCount++

    if (!isShown) {
      isShownDiscardModal.value = false
      return
    }
    saveReset()
    testReset()
    validationIssues.value = {}
    form.value = currentConnection ? toDbConnectionForm(currentConnection) : emptyDbConnectionForm()
    initialSnapshot.value = JSON.stringify(form.value)
    focusElement(nameRef)
  },
)

watch(
  form,
  () => {
    if (testSucceeded.value !== undefined || testError.value) {
      testReset()
    }
  },
  { deep: true },
)

const serverFieldError = (error: unknown): keyof DbConnectionForm | undefined =>
  SERVER_FIELDS[getServerErrorField(error)]

function showServerFieldError(error: unknown) {
  const field = serverFieldError(error)

  if (!field) {
    return
  }
  validationIssues.value = {
    [field]:
      field === 'host' && isApiError(error) && error.status === 403
        ? 'integrations.cards.database_address_pbx_not_allowed'
        : getServerMessageKey(error) || 'integrations.invalid_fields',
  }
  fieldToFocus.value = field
}

function validate(): boolean {
  validationIssues.value = validateDbConnectionForm(
    form.value,
    currentConnection,
    (connectionsState.value.data ?? []).filter(
      (connection) => connection.id !== currentConnection?.id,
    ),
  )
  const [firstInvalidField] = Object.keys(validationIssues.value)

  if (firstInvalidField) {
    fieldRefs[firstInvalidField]?.value?.focus()
    return false
  }
  return true
}

async function runTest(): Promise<boolean> {
  testReset()

  try {
    return await testMutateAsync({ ...form.value })
  } catch {
    return false
  }
}

function testConnection() {
  if (validate()) {
    void runTest()
  }
}

function requestClose() {
  if (saving.value || isShownDiscardModal.value) {
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

async function save() {
  saveReset()

  if (!validate()) {
    return
  }
  const session = openCount
  const connectionForm = { ...form.value }
  const connectionId = currentConnection?.id

  if ((testSucceeded.value === true || (await runTest())) && isShown && session === openCount) {
    saveMutate({ connectionForm, connectionId })
  }
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="
      currentConnection
        ? t('integrations.cards.edit_connection')
        : t('integrations.cards.create_connection')
    "
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <p v-if="currentConnection && usedBy.length" class="text-tertiary-neutral text-sm">
          {{ usedByText }}
        </p>
        <NeTextInput
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.name')"
          :placeholder="t('integrations.cards.database_name_placeholder')"
          :helper-text="t('integrations.cards.database_name_helper')"
          :invalid-message="
            validationIssues.name
              ? t(validationIssues.name, { max: DB_CONNECTION_MAX_LENGTHS.name })
              : ''
          "
          :disabled="busy"
          @blur="form.name = form.name.trim()"
        />
        <NeCombobox
          ref="typeRef"
          v-model="form.type"
          :label="t('integrations.cards.database_type')"
          :options="typeOptions"
          :placeholder="t('ne_combobox.choose')"
          :invalid-message="validationIssues.type ? t(validationIssues.type) : ''"
          :disabled="busy || typesState.status === 'pending'"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
        />
        <NeInlineNotification
          v-if="typesState.status === 'error'"
          kind="error"
          :title="t('integrations.cards.cannot_load_connection_types')"
          :description="describeError(typesState.error)"
        />
        <NeTextInput
          ref="hostRef"
          v-model="form.host"
          :label="t('integrations.cards.database_address')"
          :placeholder="t('integrations.cards.database_address_placeholder')"
          :helper-text="t('integrations.cards.database_address_helper')"
          :invalid-message="
            validationIssues.host
              ? t(validationIssues.host, { max: DB_CONNECTION_MAX_LENGTHS.host })
              : ''
          "
          :disabled="busy"
          @blur="form.host = form.host.trim()"
        />
        <NeTextInput
          ref="portRef"
          v-model="form.port"
          :label="t('integrations.port')"
          :placeholder="
            defaultPort
              ? t('integrations.cards.database_port_placeholder', { port: defaultPort })
              : ''
          "
          :helper-text="portHelper"
          inputmode="numeric"
          optional
          :optional-label="t('common.optional')"
          :invalid-message="validationIssues.port ? t(validationIssues.port, PORT_RANGE) : ''"
          :disabled="busy"
          @blur="form.port = form.port.trim()"
        />
        <NeTextInput
          ref="userRef"
          v-model="form.user"
          :label="t('integrations.cards.database_username')"
          autocomplete="off"
          :invalid-message="
            validationIssues.user
              ? t(validationIssues.user, { max: DB_CONNECTION_MAX_LENGTHS.user })
              : ''
          "
          :disabled="busy"
          @blur="form.user = form.user.trim()"
        />
        <NeTextInput
          ref="passwordRef"
          v-model="form.password"
          :label="t('integrations.password')"
          is-password
          autocomplete="new-password"
          :show-password-label="t('ne_text_input.show_password')"
          :hide-password-label="t('ne_text_input.hide_password')"
          :helper-text="passwordHelper"
          :invalid-message="
            validationIssues.password
              ? t(validationIssues.password, { max: DB_CONNECTION_MAX_LENGTHS.password })
              : ''
          "
          :disabled="busy"
        />
        <div class="flex flex-col gap-4">
          <div class="flex flex-col items-start gap-2">
            <NeButton
              type="button"
              kind="secondary"
              :disabled="busy"
              :loading="testing"
              @click="testConnection"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faArrowRightArrowLeft" class="size-4" aria-hidden="true" />
              </template>
              {{ t('integrations.cards.test_connection') }}
            </NeButton>
            <p class="text-tertiary-neutral text-sm">
              {{ t('integrations.cards.test_before_save') }}
            </p>
          </div>
          <NeInlineNotification
            v-if="testError && !serverFieldError(testError)"
            kind="error"
            :title="t('integrations.cards.test_failed')"
            :description="describeIntegrationError(testError)"
          />
          <NeInlineNotification
            v-else-if="testSucceeded === false"
            kind="error"
            :title="t('integrations.cards.test_failed')"
            :description="t('integrations.cards.test_failed_description')"
          />
          <p v-else-if="testSucceeded" role="status" class="flex items-center gap-2 text-sm">
            <FontAwesomeIcon
              :icon="faCircleCheck"
              class="text-icon-enabled size-4"
              aria-hidden="true"
            />
            {{ t('integrations.cards.test_succeeded') }}
          </p>
        </div>
        <NeInlineNotification
          v-if="saveError && !serverFieldError(saveError)"
          kind="error"
          :title="
            currentConnection
              ? t('integrations.cards.cannot_save_connection')
              : t('integrations.cards.cannot_create_connection')
          "
          :description="describeIntegrationError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton type="button" kind="tertiary" size="lg" :disabled="saving" @click="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="busy" :loading="saving">
          {{ currentConnection ? t('common.save') : t('common.add') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
  <DiscardChangesModal
    :visible="isShownDiscardModal"
    @close="isShownDiscardModal = false"
    @discard="discardChanges"
  />
</template>
