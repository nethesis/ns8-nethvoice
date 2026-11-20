<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as v from 'valibot'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeSideDrawer,
  NeTextInput,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { isApiError } from '@/lib/api/errors'
import {
  createPhoneModelFrom,
  getDuplicateDisplayName,
  getPhoneModel,
  isDisplayNameTaken,
  NewPhoneModelSchema,
  PHONE_MODELS_KEY,
  type NewPhoneModel,
  type PhoneModel,
} from '@/lib/phones/models'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useFocusReturn } from '@/composables/useFocusReturn'

type Field = 'name' | 'baseModel'

const {
  isShown = false,
  baseModels = [],
  allModels = [],
  duplicateOf = undefined,
} = defineProps<{
  isShown?: boolean
  baseModels?: PhoneModel[]
  allModels?: PhoneModel[]
  duplicateOf?: PhoneModel
}>()

const emit = defineEmits<{ close: []; created: [model: PhoneModel] }>()

useFocusReturn(() => isShown)

const { t } = useI18n()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()

const name = ref('')
const baseModel = ref('')
const validationIssues = ref<Partial<Record<Field, string>>>({})
const nameRef = useTemplateRef<InstanceType<typeof NeTextInput>>('nameRef')

const baseModelOptions = computed<NeComboboxOption[]>(() =>
  allModels.map((model) => ({ id: model.name, label: model.displayName, description: model.name })),
)

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('ne_combobox.no_options_label'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const isConflict = (error: unknown) => isApiError(error) && error.status === 409

class ModelNotSavedError extends Error {}

const createAndVerify = async (newModel: NewPhoneModel): Promise<PhoneModel> => {
  const created = await createPhoneModelFrom(newModel)

  try {
    await getPhoneModel(created.name)
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      throw new ModelNotSavedError()
    }
    throw error
  }
  return created
}

const failedTitle = () =>
  duplicateOf ? t('phones.models.cannot_duplicate_model') : t('phones.models.cannot_create_model')

const {
  mutate: createMutate,
  isLoading: saving,
  reset: createReset,
  error: createError,
} = useMutation({
  mutation: createAndVerify,
  onSuccess(created, newModel) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: duplicateOf ? t('phones.models.model_duplicated') : t('phones.models.model_created'),
        description: t('phones.models.model_created_description', { name: newModel.name }),
      })
    }, 500)
    emit('created', created)
    emit('close')
  },
  onError(error) {
    if (error instanceof ModelNotSavedError) {
      notificationsStore.createNotification({
        kind: 'error',
        title: failedTitle(),
        description: t('phones.models.model_not_saved'),
      })
      emit('close')
    } else if (isConflict(error)) {
      validationIssues.value = { name: 'phones.models.name_already_used' }
      focusElement(nameRef)
    }
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_MODELS_KEY] })
  },
})

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      return
    }
    createReset()
    validationIssues.value = {}

    if (duplicateOf) {
      name.value = getDuplicateDisplayName(
        allModels,
        duplicateOf.displayName,
        t('phones.models.copy_suffix'),
      )
      baseModel.value = duplicateOf.name
    } else {
      name.value = ''
      baseModel.value = baseModels[0]?.name ?? ''
    }
    focusElement(nameRef)
  },
)

function save() {
  createReset()
  validationIssues.value = {}
  const result = v.safeParse(NewPhoneModelSchema, { name: name.value, baseModel: baseModel.value })

  if (!result.success) {
    for (const issue of result.issues) {
      const field = issue.path?.[0].key

      if ((field === 'name' || field === 'baseModel') && !validationIssues.value[field]) {
        validationIssues.value[field] = issue.message
      }
    }
  } else if (isDisplayNameTaken(allModels, result.output.name)) {
    validationIssues.value = { name: 'phones.models.name_already_used' }
  }

  if (validationIssues.value.name) {
    focusElement(nameRef)
    return
  }

  if (result.success && !validationIssues.value.baseModel) {
    createMutate(result.output)
  }
}

const issueMessage = (field: Field) => {
  const issue = validationIssues.value[field]
  return issue ? t(issue) : ''
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="duplicateOf ? $t('phones.models.duplicate_model') : $t('phones.models.add_model')"
    :close-aria-label="$t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-8">
        <NeTextInput
          ref="nameRef"
          v-model="name"
          :label="$t('phones.models.name')"
          :invalid-message="issueMessage('name')"
          :disabled="saving"
          @blur="name = name.trim()"
        />
        <NeCombobox
          v-model="baseModel"
          :label="$t('phones.models.base_model')"
          :options="baseModelOptions"
          :placeholder="$t('phones.inventory.choose_model')"
          :invalid-message="issueMessage('baseModel')"
          :disabled="saving"
          v-bind="comboboxLabels"
        />
        <NeInlineNotification
          v-if="
            createError && !isConflict(createError) && !(createError instanceof ModelNotSavedError)
          "
          kind="error"
          :title="failedTitle()"
          :description="describeError(createError)"
        />
      </div>
      <hr class="my-8 border-gray-200 dark:border-gray-700" />
      <div class="flex justify-end gap-6">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="emit('close')">
          {{ $t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ duplicateOf ? $t('phones.models.duplicate') : $t('common.create') }}
        </NeButton>
      </div>
    </form>
  </NeSideDrawer>
</template>
