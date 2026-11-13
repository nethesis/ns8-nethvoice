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
  NeInlineNotification,
  NeSideDrawer,
  NeTextInput,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck, faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import { useFocusReturn } from '@/composables/useFocusReturn'
import type { Focusable } from '@/lib/common'
import {
  buildDbConnectionPayload,
  buildDbConnectionTestPayload,
  DB_CONNECTIONS_KEY,
  type DbConnection,
  type DbConnectionForm,
  emptyDbConnectionForm,
  getDbConnectionDefaultPort,
  saveDbConnection,
  testDbConnection,
  toDbConnectionForm,
  validateDbConnectionForm,
} from '@/lib/integrations/dbConnections'
import { getLegacyStatusMessage } from '@/lib/integrations/errors'
import type { FieldIssues } from '@/lib/integrations/validation'
import { useDbConnectionTypes } from '@/queries/integrations/customerCards'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { isShown = false, currentConnection = undefined } = defineProps<{
  isShown: boolean
  currentConnection: DbConnection | undefined
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: typesState } = useDbConnectionTypes()

const form = ref<DbConnectionForm>(emptyDbConnectionForm())
const validationIssues = ref<FieldIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)

useFocusReturn(() => isShown)

const typeRef = useTemplateRef<Focusable>('typeRef')
const nameRef = useTemplateRef<Focusable>('nameRef')
const hostRef = useTemplateRef<Focusable>('hostRef')
const portRef = useTemplateRef<Focusable>('portRef')
const userRef = useTemplateRef<Focusable>('userRef')
const passwordRef = useTemplateRef<Focusable>('passwordRef')

const fieldRefs: Record<string, Readonly<{ value: Focusable | null }>> = {
  type: typeRef,
  name: nameRef,
  host: hostRef,
  port: portRef,
  user: userRef,
  password: passwordRef,
}

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const typeOptions = computed(() =>
  (typesState.value.data ?? []).map((type) => ({ id: type.id, label: type.label })),
)

const type = computed({
  get: () => form.value.type,
  set: (value: string) => {
    if (value !== form.value.type) {
      form.value.type = value
      form.value.port = getDbConnectionDefaultPort(value) || form.value.port
    }
  },
})

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (connectionForm: DbConnectionForm) =>
    saveDbConnection(buildDbConnectionPayload(connectionForm), currentConnection?.id),
  onSuccess(_data, connectionForm) {
    const edited = !!currentConnection

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: edited
          ? t('integrations.cards.connection_saved')
          : t('integrations.cards.connection_created'),
        description: t(
          edited ? 'common.object_saved_successfully' : 'common.object_created_successfully',
          { name: connectionForm.name.trim() },
        ),
      })
    }, 500)
    emit('close')
  },
  onSettled: () => {
    queryCache.invalidateQueries({ key: [DB_CONNECTIONS_KEY] })
  },
})

const {
  mutate: testMutate,
  isLoading: testing,
  reset: testReset,
  error: testError,
  data: testSucceeded,
} = useMutation({
  mutation: (connectionForm: DbConnectionForm) =>
    testDbConnection(buildDbConnectionTestPayload(connectionForm, currentConnection)),
})

const busy = computed(() => saving.value || testing.value)

watch(
  () => isShown,
  () => {
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

function validate(): boolean {
  validationIssues.value = validateDbConnectionForm(form.value, currentConnection)
  const [firstInvalidField] = Object.keys(validationIssues.value)

  if (firstInvalidField) {
    fieldRefs[firstInvalidField]?.value?.focus()
    return false
  }
  return true
}

function testConnection() {
  testReset()

  if (validate()) {
    testMutate({ ...form.value })
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

function save() {
  saveReset()

  if (validate()) {
    saveMutate({ ...form.value })
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
        <NeCombobox
          ref="typeRef"
          v-model="type"
          :label="t('integrations.cards.connection_type')"
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
          ref="nameRef"
          v-model="form.name"
          :label="t('integrations.database')"
          :invalid-message="validationIssues.name ? t(validationIssues.name) : ''"
          :disabled="busy"
          @blur="form.name = form.name.trim()"
        />
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
          ref="userRef"
          v-model="form.user"
          :label="t('integrations.user')"
          autocomplete="off"
          :invalid-message="validationIssues.user ? t(validationIssues.user) : ''"
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
          :helper-text="currentConnection?.password ? t('integrations.password_keep_helper') : ''"
          :invalid-message="validationIssues.password ? t(validationIssues.password) : ''"
          :disabled="busy"
        />
        <div class="flex flex-col gap-3">
          <div>
            <NeButton
              type="button"
              kind="secondary"
              :disabled="busy"
              :loading="testing"
              @click="testConnection"
            >
              <template #prefix>
                <FontAwesomeIcon :icon="faPlugCircleBolt" class="h-4 w-4" aria-hidden="true" />
              </template>
              {{ t('integrations.cards.test_connection') }}
            </NeButton>
          </div>
          <NeInlineNotification
            v-if="testError"
            kind="error"
            :title="t('integrations.cards.test_failed')"
            :description="getLegacyStatusMessage(testError) || describeError(testError)"
          />
          <NeInlineNotification
            v-else-if="testSucceeded === false"
            kind="error"
            :title="t('integrations.cards.test_failed')"
            :description="t('integrations.cards.test_failed_description')"
          />
          <p
            v-else-if="testSucceeded"
            class="flex items-center gap-2 text-sm text-green-700 dark:text-green-500"
          >
            <FontAwesomeIcon :icon="faCircleCheck" class="h-4 w-4" aria-hidden="true" />
            {{ t('integrations.cards.test_succeeded') }}
          </p>
        </div>
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="
            currentConnection
              ? t('integrations.cards.cannot_save_connection')
              : t('integrations.cards.cannot_create_connection')
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
          @click="requestClose"
        >
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="busy" :loading="saving">
          {{ currentConnection ? t('common.save') : t('integrations.cards.create_connection') }}
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
