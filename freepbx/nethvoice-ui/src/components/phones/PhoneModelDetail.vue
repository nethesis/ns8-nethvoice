<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRouter,
  type RouteLocationRaw,
} from 'vue-router'
import { useMutation, useQueryCache } from '@pinia/colada'
import { useMediaQuery } from '@vueuse/core'
import {
  NeButton,
  NeCombobox,
  NeEmptyState,
  NeHeading,
  NeInlineNotification,
  NeModal,
  NeSkeleton,
  NeTextInput,
  type NeComboboxOption,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faArrowLeft,
  faMagnifyingGlass,
  faChevronDown,
  faChevronUp,
  faFloppyDisk,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons'
import LoadError from '@/components/common/LoadError.vue'
import { isApiError } from '@/lib/api/errors'
import ModelFileField from './ModelFileField.vue'
import ResetModelModal from './ResetModelModal.vue'
import { getLanguageLabel } from '@/lib/settings/system'
import { getToneZoneLabel } from '@/lib/phones/defaults'
import {
  PHONE_MODEL_KEY,
  PHONE_MODELS_KEY,
  patchPhoneModelVariables,
  type ModelVariables,
} from '@/lib/phones/models'
import {
  buildModelForm,
  buildVariablesPatch,
  countSectionChanges,
  getEffectiveVariables,
  getKeyVariables,
  getModelSections,
  type ModelField,
  type ModelOption,
  type ModelSectionId,
} from '@/lib/phones/modelSettings'
import { usePhoneDefaults } from '@/queries/phones/defaults'
import { usePhoneModel } from '@/queries/phones/modelDetail'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const { modelName } = defineProps<{ modelName: string }>()

const emit = defineEmits<{ back: [] }>()

const { t, locale } = useI18n()
const router = useRouter()
const queryCache = useQueryCache()
const notificationsStore = useNotificationsStore()
const { state: modelState, refetch: refetchModel } = usePhoneModel(() => modelName)
const { state: defaultsState, refetch: refetchDefaults } = usePhoneDefaults()

const initialForm = ref<ModelVariables>({})
const form = ref<ModelVariables>({})
const openSections = ref<ModelSectionId[]>([])
const isShownResetModal = ref(false)
const isShownUnsavedModal = ref(false)
const pendingLocation = ref<RouteLocationRaw | null>(null)
let leaveConfirmed = false

const model = computed(() => modelState.value.data)

const isMediumScreen = useMediaQuery('(min-width: 768px)')

const isKeyLabelShown = (index: number) => index === 1 || !isMediumScreen.value

const loading = computed(
  () => modelState.value.status === 'pending' || defaultsState.value.status === 'pending',
)

const loadError = computed(() => modelState.value.error ?? defaultsState.value.error)

const isModelNotFound = computed(
  () => isApiError(modelState.value.error) && modelState.value.error.status === 404,
)

const sections = computed(() =>
  model.value
    ? getModelSections(
        getEffectiveVariables(model.value.variables, defaultsState.value.data?.variables ?? {}),
      )
    : [],
)

const isDirty = computed(() =>
  Object.keys(form.value).some((key) => form.value[key] !== (initialForm.value[key] ?? '')),
)

const comboboxLabels = computed(() => ({
  noResultsLabel: t('ne_combobox.no_results'),
  limitedOptionsLabel: t('ne_combobox.limited_options_label'),
  noOptionsLabel: t('ne_combobox.no_options_label'),
  selectedLabel: t('ne_combobox.selected'),
  userInputLabel: t('ne_combobox.user_input_label'),
  optionalLabel: t('common.optional'),
}))

const {
  mutate: saveMutate,
  isLoading: saving,
  reset: saveReset,
  error: saveError,
} = useMutation({
  mutation: (variables: ModelVariables) =>
    patchPhoneModelVariables(modelName, buildVariablesPatch(initialForm.value, variables)),
  onSuccess(_data, variables) {
    initialForm.value = { ...variables }
    notificationsStore.createNotification({
      kind: 'success',
      title: t('phones.models.model_saved'),
      description: t('phones.models.model_saved_description', {
        name: model.value?.displayName ?? modelName,
      }),
    })
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [PHONE_MODEL_KEY, modelName] })
    queryCache.invalidateQueries({ key: [PHONE_MODELS_KEY] })
  },
})

watch(
  () => [model.value, defaultsState.value.data] as const,
  ([current, defaults]) => {
    if (!current || !defaults || isDirty.value) {
      return
    }
    const effective = getEffectiveVariables(current.variables, defaults.variables)
    initialForm.value = buildModelForm(getModelSections(effective), effective)
    form.value = { ...initialForm.value }
  },
  { immediate: true },
)

function optionLabel(field: ModelField, option: ModelOption): string {
  if (field.optionsKind === 'language') {
    return getLanguageLabel(option.id)
  }

  if (field.optionsKind === 'tone_zone') {
    return getToneZoneLabel(option.id, locale.value)
  }

  if (option.labelKey) {
    return option.count === undefined ? t(option.labelKey) : t(option.labelKey, option.count)
  }
  return option.label ?? option.id
}

function fieldOptions(field: ModelField): NeComboboxOption[] {
  const defaultValue = defaultsState.value.data?.variables[field.variable] ?? ''

  return (field.options ?? []).map((option) => {
    const label = optionLabel(field, option)
    return {
      id: option.id,
      label: option.id === defaultValue ? t('phones.models.default_option', { label }) : label,
    }
  })
}

const optionsByVariable = computed(() => {
  const options = new Map<string, NeComboboxOption[]>()

  for (const section of sections.value) {
    for (const field of section.fields) {
      options.set(field.variable, fieldOptions(field))
    }

    if (section.keys) {
      options.set(section.keys.prefix, keyTypeOptions(section.keys.typeOptions))
    }
  }
  return options
})

function keyTypeOptions(options: ModelOption[]): NeComboboxOption[] {
  return options.map((option) => ({
    id: option.id,
    label: option.labelKey ? t(option.labelKey) : (option.label ?? option.id),
  }))
}

function toggleSection(id: ModelSectionId) {
  openSections.value = openSections.value.includes(id)
    ? openSections.value.filter((section) => section !== id)
    : [...openSections.value, id]
}

function save() {
  saveReset()

  if (isDirty.value) {
    saveMutate({ ...form.value })
  }
}

function discardChanges() {
  saveReset()
  form.value = { ...initialForm.value }
}

function requestBack() {
  if (isDirty.value) {
    pendingLocation.value = null
    isShownUnsavedModal.value = true
    return
  }
  emit('back')
}

function confirmLeave() {
  isShownUnsavedModal.value = false
  discardChanges()
  leaveConfirmed = true

  if (pendingLocation.value) {
    router.push(pendingLocation.value)
  } else {
    emit('back')
  }
}

const guardNavigation = (to: RouteLocationRaw) => {
  if (!isDirty.value || leaveConfirmed) {
    return true
  }
  pendingLocation.value = to
  isShownUnsavedModal.value = true
  return false
}

onBeforeRouteLeave((to) => guardNavigation(to.fullPath))
onBeforeRouteUpdate((to) => guardNavigation(to.fullPath))

function retry() {
  refetchModel()
  refetchDefaults()
}

function onReset() {
  initialForm.value = {}
  form.value = {}
}
</script>

<template>
  <div>
    <NeButton kind="tertiary" class="mb-6 -ml-3" @click="requestBack">
      <template #prefix>
        <FontAwesomeIcon :icon="faArrowLeft" class="size-4" aria-hidden="true" />
      </template>
      {{ $t('phones.tab_models') }}
    </NeButton>
    <NeEmptyState
      v-if="isModelNotFound"
      :title="$t('phones.models.model_not_found')"
      :description="$t('phones.models.model_not_found_description')"
      :icon="faMagnifyingGlass"
      class="elevation-0"
    />
    <LoadError
      v-else-if="loadError"
      :error="loadError"
      :title="$t('phones.models.cannot_load_model')"
      @retry="retry"
    />
    <div v-else-if="loading" class="flex flex-col gap-6">
      <NeSkeleton size="lg" class="w-64" />
      <NeSkeleton :lines="8" />
    </div>
    <template v-else-if="model">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <NeHeading tag="h4">{{ model.displayName }}</NeHeading>
        <NeButton v-if="!model.custom" kind="tertiary" @click="isShownResetModal = true">
          <template #prefix>
            <FontAwesomeIcon :icon="faRotateLeft" class="size-4" aria-hidden="true" />
          </template>
          {{ $t('phones.models.reset_to_original_settings') }}
        </NeButton>
      </div>
      <form class="flex flex-col gap-5" novalidate @submit.prevent="save">
        <section
          v-for="section in sections"
          :key="section.id"
          class="bg-elevation-0 rounded-lg shadow-sm"
        >
          <h5>
            <button
              type="button"
              class="text-primary-neutral flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-base font-medium"
              :aria-expanded="openSections.includes(section.id)"
              :aria-controls="`model-section-${section.id}`"
              @click="toggleSection(section.id)"
            >
              <span class="flex items-center gap-3">
                {{ $t(`phones.models.sections.${section.id}`) }}
                <span
                  v-if="countSectionChanges(section, initialForm, form) > 0"
                  class="text-primary-700 dark:text-primary-500 text-xs"
                >
                  {{
                    $t(
                      'phones.models.n_unsaved_changes',
                      countSectionChanges(section, initialForm, form),
                    )
                  }}
                </span>
              </span>
              <FontAwesomeIcon
                :icon="openSections.includes(section.id) ? faChevronUp : faChevronDown"
                class="size-4"
                aria-hidden="true"
              />
            </button>
          </h5>
          <div
            v-if="openSections.includes(section.id)"
            :id="`model-section-${section.id}`"
            class="px-5 pt-2 pb-6"
          >
            <div v-if="section.keys" class="flex flex-col gap-4">
              <div
                v-for="index in section.keys.count"
                :key="index"
                class="grid grid-cols-1 items-end gap-4 md:grid-cols-[6rem_1fr_1fr_1fr]"
              >
                <span class="text-secondary-neutral pb-2 text-sm font-medium">
                  {{ $t(`phones.models.${section.keys.prefix}_n`, { n: index }) }}
                </span>
                <NeCombobox
                  v-model="form[getKeyVariables(section.keys.prefix, index).type]"
                  :label="isKeyLabelShown(index) ? $t('phones.models.key_type') : ''"
                  :aria-label="$t('phones.models.key_type')"
                  :options="optionsByVariable.get(section.keys.prefix) ?? []"
                  :placeholder="$t('ne_combobox.choose')"
                  :disabled="saving"
                  v-bind="comboboxLabels"
                />
                <NeTextInput
                  v-model="form[getKeyVariables(section.keys.prefix, index).value]"
                  :label="isKeyLabelShown(index) ? $t('phones.models.key_value') : ''"
                  :aria-label="
                    $t('phones.models.key_value_of', {
                      key: $t(`phones.models.${section.keys.prefix}_n`, { n: index }),
                    })
                  "
                  :disabled="saving"
                />
                <NeTextInput
                  v-model="form[getKeyVariables(section.keys.prefix, index).label]"
                  :label="isKeyLabelShown(index) ? $t('phones.models.key_label') : ''"
                  :aria-label="
                    $t('phones.models.key_label_of', {
                      key: $t(`phones.models.${section.keys.prefix}_n`, { n: index }),
                    })
                  "
                  :disabled="saving"
                />
              </div>
            </div>
            <div v-else class="grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-2">
              <template v-for="field in section.fields" :key="field.variable">
                <ModelFileField
                  v-if="field.type === 'file' && field.fileType"
                  v-model="form[field.variable]"
                  :label="$t(field.labelKey)"
                  :file-type="field.fileType"
                  :disabled="saving"
                />
                <NeCombobox
                  v-else-if="field.type === 'select'"
                  v-model="form[field.variable]"
                  :label="$t(field.labelKey)"
                  :options="optionsByVariable.get(field.variable) ?? []"
                  :placeholder="$t('ne_combobox.choose')"
                  :disabled="saving"
                  v-bind="comboboxLabels"
                />
                <NeTextInput
                  v-else
                  v-model="form[field.variable]"
                  :label="$t(field.labelKey)"
                  :is-password="field.type === 'password'"
                  :show-password-label="$t('ne_text_input.show_password')"
                  :hide-password-label="$t('ne_text_input.hide_password')"
                  :placeholder="defaultsState.data?.variables[field.variable] ?? ''"
                  :disabled="saving"
                />
              </template>
            </div>
          </div>
        </section>
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="$t('phones.models.cannot_save_model')"
          :description="describeError(saveError)"
        />
        <div class="flex flex-wrap gap-4">
          <NeButton type="submit" kind="primary" :loading="saving" :disabled="saving || !isDirty">
            <template #prefix>
              <FontAwesomeIcon :icon="faFloppyDisk" class="size-4" aria-hidden="true" />
            </template>
            {{ $t('common.save') }}
          </NeButton>
          <NeButton kind="secondary" :disabled="saving || !isDirty" @click.prevent="discardChanges">
            <template #prefix>
              <FontAwesomeIcon :icon="faRotateLeft" class="size-4" aria-hidden="true" />
            </template>
            {{ $t('phones.models.discard_changes') }}
          </NeButton>
        </div>
      </form>
    </template>
    <ResetModelModal
      :visible="isShownResetModal"
      :model="model"
      @close="isShownResetModal = false"
      @reset="onReset"
    />
    <NeModal
      :visible="isShownUnsavedModal"
      :title="$t('phones.models.unsaved_changes')"
      kind="warning"
      :primary-label="$t('phones.models.discard_changes')"
      primary-button-kind="danger"
      :cancel-label="$t('phones.models.keep_editing')"
      :close-aria-label="$t('common.close')"
      @close="isShownUnsavedModal = false"
      @primary-click="confirmLeave"
    >
      <p>{{ $t('phones.models.unsaved_changes_description') }}</p>
    </NeModal>
  </div>
</template>
