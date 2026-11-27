<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, toRef, useTemplateRef, watch, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  focusElement,
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeRadioSelection,
  NeSideDrawer,
  NeTextInput,
} from '@nethesis/vue-components'
import DiscardChangesModal from '@/components/users/DiscardChangesModal.vue'
import {
  describeGatewayError,
  findGatewayModel,
  formatMacAddress,
  GATEWAYS_KEY,
  getEmptyGatewayForm,
  getGatewayForm,
  getManufacturers,
  getModelLabel,
  getPortNumber,
  getRemovedFxsExtensions,
  hasGatewayValidationIssues,
  postGateway,
  putGateway,
  toGatewaySaveRequest,
  validateGatewayForm,
  withModelPorts,
  type Gateway,
  type GatewayField,
  type GatewayForm,
  type GatewayModel,
  type GatewayValidationIssues,
  type IsdnPortMode,
} from '@/lib/trunks/gateways'
import { getFxsUserOptions, FXS_USERS_KEY } from '@/lib/trunks/fxsUsers'
import { TRUNKS_KEY } from '@/lib/trunks/trunks'
import { TRUNKS_LIVE_STATE_KEY } from '@/lib/trunks/liveState'
import { focusUnlessFocusedWithin, type Focusable } from '@/lib/common'
import { useFxsUsers, useGatewayModels, useHostNetworks } from '@/queries/trunks/gateways'
import { useFocusReturn } from '@/composables/useFocusReturn'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useSetupGuard } from '@/composables/useSetupGuard'

const {
  isShown = false,
  gateway = undefined,
  existingMacAddresses = [],
} = defineProps<{
  isShown: boolean
  gateway?: Gateway
  existingMacAddresses?: string[]
}>()

const emit = defineEmits<{ close: [] }>()

const FOCUS_DELAY = 300

const FIELD_ORDER: GatewayField[] = [
  'manufacturer',
  'modelId',
  'macAddress',
  'ipAddress',
  'netmask',
  'networkGateway',
  'pbxAddress',
]

const { t } = useI18n()
const queryCache = useQueryCache()
const { ensureSetupInProgress } = useSetupGuard()
const notificationsStore = useNotificationsStore()
const { state: modelsState, refetch: refetchModels } = useGatewayModels()
const { state: networksState } = useHostNetworks()
const { state: fxsUsersState } = useFxsUsers()

const form = ref<GatewayForm>(getEmptyGatewayForm())
const validationIssues = ref<GatewayValidationIssues>({})
const initialSnapshot = ref('')
const isShownDiscardModal = ref(false)

useFocusReturn(() => isShown)

const fieldRefs: Record<GatewayField, Readonly<ShallowRef<Focusable | null>>> = {
  manufacturer: useTemplateRef<Focusable>('manufacturerRef'),
  modelId: useTemplateRef<Focusable>('modelRef'),
  macAddress: useTemplateRef<Focusable>('macAddressRef'),
  ipAddress: useTemplateRef<Focusable>('ipAddressRef'),
  netmask: useTemplateRef<Focusable>('netmaskRef'),
  networkGateway: useTemplateRef<Focusable>('networkGatewayRef'),
  pbxAddress: useTemplateRef<Focusable>('pbxAddressRef'),
}
const fxoRefs = useTemplateRef<Focusable[]>('fxoRefs')
const fxsRefs = useTemplateRef<Focusable[]>('fxsRefs')
const formRef = useTemplateRef<HTMLFormElement>('formRef')

const isEditing = computed(() => gateway !== undefined)

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const otherMacAddresses = computed(() =>
  gateway
    ? existingMacAddresses.filter(
        (macAddress) => formatMacAddress(macAddress) !== formatMacAddress(gateway.macAddress),
      )
    : existingMacAddresses,
)

const models = computed<GatewayModel[]>(() => modelsState.value.data ?? [])

const manufacturerOptions = computed(() =>
  getManufacturers(models.value).map((manufacturer) => ({ id: manufacturer, label: manufacturer })),
)

const modelOptions = computed(() =>
  models.value
    .filter((model) => model.manufacturer === form.value.manufacturer)
    .map((model) => ({ id: String(model.id), label: getModelLabel(model) })),
)

const selectedModel = computed(() =>
  form.value.modelId ? findGatewayModel(models.value, form.value.modelId) : undefined,
)

const isdnModeOptions = computed(() => [
  { id: 'pp', label: t('trunks.physical.point_to_point') },
  { id: 'pmp', label: t('trunks.physical.point_to_multipoint') },
])

const fxsUserOptions = computed(() =>
  getFxsUserOptions(fxsUsersState.value.data ?? [], gateway?.fxsExtensions ?? []).map((user) => ({
    id: user.extension,
    label: user.label,
    description: user.description,
  })),
)

const removedFxsUsers = computed(() =>
  gateway
    ? getRemovedFxsExtensions(gateway.fxsExtensions, form.value.fxsExtensions).map(
        (extension) =>
          fxsUserOptions.value.find((option) => option.id === extension)?.label ?? extension,
      )
    : [],
)

const saveErrorTitle = computed(() =>
  isEditing.value ? t('trunks.cannot_save_trunk') : t('trunks.cannot_create_trunk'),
)

const {
  mutate: saveGateway,
  isLoading: saving,
  reset: resetSave,
  error: saveError,
} = useMutation({
  mutation: async ({
    values,
    model,
    gatewayId,
  }: {
    values: GatewayForm
    model: GatewayModel
    gatewayId?: number
  }) => {
    await ensureSetupInProgress()
    const request = toGatewaySaveRequest(values, model)

    if (gatewayId === undefined) {
      await postGateway(request)
    } else {
      await putGateway(gatewayId, request)
    }
  },
  onSuccess(_data, { model, gatewayId }) {
    const name = `${model.manufacturer} ${model.description}`

    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title:
          gatewayId === undefined
            ? t('trunks.physical.trunk_created')
            : t('trunks.physical.trunk_updated'),
        description:
          gatewayId === undefined
            ? t('trunks.physical.trunk_created_description', { name })
            : t('trunks.physical.trunk_updated_description', { name }),
      })
    }, 500)
    emit('close')
  },
  onError(error) {
    if (!isShown) {
      notificationsStore.createNotification({
        kind: 'error',
        title: saveErrorTitle.value,
        description: describeGatewayError(error) || describeError(error),
      })
    }
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [GATEWAYS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_LIVE_STATE_KEY] }).catch(() => undefined)
    queryCache.invalidateQueries({ key: [FXS_USERS_KEY] })
  },
})

function getDefaultForm(): GatewayForm {
  const [firstModel] = models.value
  const [network] = networksState.value.data ?? []

  return getEmptyGatewayForm(firstModel?.defaultPbxAddress ?? '', network)
}

function getEditForm(item: Gateway): GatewayForm {
  const values = { ...getGatewayForm(item), macAddress: formatMacAddress(item.macAddress) }
  const model = findGatewayModel(models.value, item.modelId)

  return model ? { ...values, fxsExtensions: withModelPorts(values, model).fxsExtensions } : values
}

function initForm() {
  form.value = gateway ? getEditForm(gateway) : getDefaultForm()
  initialSnapshot.value = JSON.stringify(form.value)
}

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      isShownDiscardModal.value = false
      return
    }
    resetSave()
    validationIssues.value = {}
    initForm()
    setTimeout(
      () =>
        focusUnlessFocusedWithin(
          formRef.value,
          gateway ? fieldRefs.macAddress.value : fieldRefs.manufacturer.value,
        ),
      FOCUS_DELAY,
    )
  },
)

watch(
  () => [models.value, networksState.value.data] as const,
  () => {
    if (isShown && !isDirty.value) {
      initForm()
    }
  },
)

function applyModelPorts(model: GatewayModel | undefined) {
  const { isdnModes, fxoNumbers, fxsExtensions } = withModelPorts(form.value, model)
  form.value.isdnModes = isdnModes
  form.value.fxoNumbers = fxoNumbers
  form.value.fxsExtensions = fxsExtensions
}

function selectManufacturer(manufacturer: string) {
  if (manufacturer === form.value.manufacturer) {
    return
  }
  form.value.manufacturer = manufacturer
  form.value.modelId = ''
  applyModelPorts(undefined)
}

function selectModel(modelId: string) {
  if (modelId === form.value.modelId) {
    return
  }
  form.value.modelId = modelId
  applyModelPorts(modelId ? findGatewayModel(models.value, modelId) : undefined)
}

function setIsdnMode(index: number, mode: string) {
  const portMode: IsdnPortMode = mode === 'pmp' ? 'pmp' : 'pp'
  form.value.isdnModes[index] = portMode
}

function portNumber(index: number): number {
  return getPortNumber(form.value.manufacturer, index)
}

function issue(field: GatewayField): string {
  const key = validationIssues.value[field]
  return key ? t(key) : ''
}

function portIssue(kind: 'fxoNumbers' | 'fxsExtensions', index: number): string {
  const key = validationIssues.value[kind]?.[index]
  return key ? t(key) : ''
}

function focusFirstInvalidField() {
  const field = FIELD_ORDER.find((name) => validationIssues.value[name])

  if (field) {
    focusElement(fieldRefs[field])
    return
  }
  const fxoIndex = Object.keys(validationIssues.value.fxoNumbers ?? {}).map(Number)[0]

  if (fxoIndex !== undefined) {
    focusElement(toRef(() => fxoRefs.value?.[fxoIndex]))
    return
  }
  const fxsIndex = Object.keys(validationIssues.value.fxsExtensions ?? {}).map(Number)[0]

  if (fxsIndex !== undefined) {
    focusElement(toRef(() => fxsRefs.value?.[fxsIndex]))
  }
}

function save() {
  resetSave()
  const model = selectedModel.value
  validationIssues.value = validateGatewayForm(form.value, {
    model,
    existingMacAddresses: otherMacAddresses.value,
  })

  if (hasGatewayValidationIssues(validationIssues.value) || !model) {
    focusFirstInvalidField()
    return
  }
  saveGateway({ values: { ...form.value }, model, gatewayId: gateway?.id })
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
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="
      isEditing ? t('trunks.physical.edit_physical_trunk') : t('trunks.physical.add_physical_trunk')
    "
    :close-aria-label="t('shell.close_side_drawer')"
    @close="requestClose"
  >
    <form ref="formRef" novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeInlineNotification
          v-if="modelsState.status === 'error'"
          kind="error"
          :title="t('trunks.physical.cannot_load_models')"
          :description="describeError(modelsState.error)"
          :primary-button-label="t('common.retry')"
          @primary-click="refetchModels()"
        />
        <NeRadioSelection
          ref="manufacturerRef"
          :model-value="form.manufacturer"
          :label="t('trunks.physical.manufacturer')"
          :options="manufacturerOptions"
          :invalid-message="issue('manufacturer')"
          :disabled="saving || isEditing"
          @update:model-value="selectManufacturer"
        />
        <NeCombobox
          ref="modelRef"
          :model-value="form.modelId"
          :label="t('trunks.physical.model')"
          :options="modelOptions"
          :placeholder="
            form.manufacturer
              ? t('trunks.physical.choose_model')
              : t('trunks.physical.choose_manufacturer_first')
          "
          :helper-text="isEditing ? t('trunks.physical.model_edit_helper') : ''"
          :invalid-message="issue('modelId')"
          :disabled="saving || isEditing || !form.manufacturer"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
          :optional-label="t('common.optional')"
          @update:model-value="selectModel"
        />
        <NeTextInput
          ref="macAddressRef"
          v-model="form.macAddress"
          :label="t('trunks.physical.mac_address')"
          :placeholder="t('trunks.physical.mac_address_placeholder')"
          :invalid-message="issue('macAddress')"
          :disabled="saving"
          @blur="form.macAddress = form.macAddress.trim()"
        />
        <NeTextInput
          ref="ipAddressRef"
          v-model="form.ipAddress"
          :label="t('trunks.physical.ip_address')"
          :helper-text="t('trunks.physical.ip_address_helper')"
          :placeholder="t('trunks.physical.ip_address_placeholder')"
          :invalid-message="issue('ipAddress')"
          :disabled="saving"
          @blur="form.ipAddress = form.ipAddress.trim()"
        />
        <NeTextInput
          ref="netmaskRef"
          v-model="form.netmask"
          :label="t('trunks.physical.netmask')"
          :placeholder="t('trunks.physical.netmask_placeholder')"
          :invalid-message="issue('netmask')"
          :disabled="saving"
          @blur="form.netmask = form.netmask.trim()"
        />
        <NeTextInput
          ref="networkGatewayRef"
          v-model="form.networkGateway"
          :label="t('trunks.physical.network_gateway')"
          :placeholder="t('trunks.physical.network_gateway_placeholder')"
          :invalid-message="issue('networkGateway')"
          :disabled="saving"
          @blur="form.networkGateway = form.networkGateway.trim()"
        />
        <NeTextInput
          ref="pbxAddressRef"
          v-model="form.pbxAddress"
          :label="t('trunks.physical.pbx_address')"
          :helper-text="t('trunks.physical.pbx_address_helper')"
          :placeholder="t('trunks.physical.pbx_address_placeholder')"
          :invalid-message="issue('pbxAddress')"
          :disabled="saving"
          @blur="form.pbxAddress = form.pbxAddress.trim()"
        />
        <NeRadioSelection
          v-for="(mode, index) in form.isdnModes"
          :key="`isdn-${index}`"
          :model-value="mode"
          :name="`isdn-port-${index}`"
          :label="
            form.isdnModes.length > 1
              ? t('trunks.physical.isdn_port_n_mode', { port: portNumber(index) })
              : t('trunks.physical.isdn_port_mode')
          "
          :options="isdnModeOptions"
          :disabled="saving"
          @update:model-value="(value: string) => setIsdnMode(index, value)"
        />
        <NeTextInput
          v-for="(_number, index) in form.fxoNumbers"
          :key="`fxo-${index}`"
          ref="fxoRefs"
          v-model="form.fxoNumbers[index]"
          :label="t('trunks.physical.fxo_port_number', { port: portNumber(index) })"
          :helper-text="t('trunks.physical.fxo_port_number_helper')"
          optional
          :optional-label="t('common.optional')"
          :invalid-message="portIssue('fxoNumbers', index)"
          :disabled="saving"
        />
        <NeCombobox
          v-for="(_extension, index) in form.fxsExtensions"
          :key="`fxs-${index}`"
          ref="fxsRefs"
          v-model="form.fxsExtensions[index]"
          :label="t('trunks.physical.fxs_port', { port: portNumber(index) })"
          :options="fxsUserOptions"
          :placeholder="t('trunks.physical.choose_user')"
          optional
          :optional-label="t('common.optional')"
          :invalid-message="portIssue('fxsExtensions', index)"
          :disabled="saving || fxsUsersState.status === 'pending'"
          :no-results-label="t('ne_combobox.no_results')"
          :limited-options-label="t('ne_combobox.limited_options_label')"
          :no-options-label="t('ne_combobox.no_options_label')"
          :selected-label="t('ne_combobox.selected')"
          :user-input-label="t('ne_combobox.user_input_label')"
        />
        <NeInlineNotification
          v-if="selectedModel && selectedModel.fxsPorts > 0 && fxsUsersState.status === 'error'"
          kind="error"
          :title="t('trunks.physical.cannot_load_users')"
          :description="describeError(fxsUsersState.error)"
        />
        <NeInlineNotification
          v-if="removedFxsUsers.length > 0"
          kind="warning"
          :title="t('trunks.physical.fxs_extensions_removed_title')"
          :description="
            t('trunks.physical.fxs_extensions_removed_description', {
              users: removedFxsUsers.join(', '),
            })
          "
        />
        <NeInlineNotification
          v-if="saveError"
          kind="error"
          :title="saveErrorTitle"
          :description="describeGatewayError(saveError) || describeError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="requestClose">
          {{ t('common.cancel') }}
        </NeButton>
        <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
          {{ isEditing ? t('common.save') : t('common.create') }}
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
