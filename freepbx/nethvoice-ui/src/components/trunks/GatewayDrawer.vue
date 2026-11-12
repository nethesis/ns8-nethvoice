<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryCache } from '@pinia/colada'
import {
  NeButton,
  NeCombobox,
  NeInlineNotification,
  NeRadioSelection,
  NeSideDrawer,
  NeTextInput,
} from '@nethesis/vue-components'
import {
  describeGatewayError,
  findGatewayModel,
  GATEWAYS_KEY,
  getEmptyGatewayForm,
  getGatewayForm,
  getManufacturers,
  getModelLabel,
  getPortNumber,
  hasGatewayValidationIssues,
  postGateway,
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
import type { Focusable } from '@/lib/common'
import { useFxsUsers, useGatewayModels, useHostNetworks } from '@/queries/trunks/gateways'
import { describeError, useNotificationsStore } from '@/stores/notifications'

const {
  isShown = false,
  gateway = undefined,
  label = '',
  existingMacAddresses = [],
} = defineProps<{
  isShown: boolean
  gateway?: Gateway
  label?: string
  existingMacAddresses?: string[]
}>()

const emit = defineEmits<{ close: []; download: [gateway: Gateway] }>()

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
const notificationsStore = useNotificationsStore()
const { state: modelsState, refetch: refetchModels } = useGatewayModels()
const { state: networksState } = useHostNetworks()
const { state: fxsUsersState } = useFxsUsers()

const form = ref<GatewayForm>(getEmptyGatewayForm())
const validationIssues = ref<GatewayValidationIssues>({})

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

const isReadOnly = computed(() => gateway !== undefined)

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

const {
  mutate: createGateway,
  isLoading: saving,
  reset: resetCreate,
  error: saveError,
} = useMutation({
  mutation: ({ values, model }: { values: GatewayForm; model: GatewayModel }) =>
    postGateway(toGatewaySaveRequest(values, model)),
  onSuccess(_data, { model }) {
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('trunks.trunk_created'),
        description: t('common.object_created_successfully', {
          name: `${model.manufacturer} ${model.description}`,
        }),
      })
    }, 500)
    emit('close')
  },
  onSettled() {
    queryCache.invalidateQueries({ key: [GATEWAYS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_KEY] })
    queryCache.invalidateQueries({ key: [TRUNKS_LIVE_STATE_KEY] })
    queryCache.invalidateQueries({ key: [FXS_USERS_KEY] })
  },
})

function getDefaultForm(): GatewayForm {
  const [firstModel] = models.value
  const [network] = networksState.value.data ?? []

  return getEmptyGatewayForm(firstModel?.defaultPbxAddress ?? '', network)
}

watch(
  () => isShown,
  (shown) => {
    if (!shown) {
      return
    }
    resetCreate()
    validationIssues.value = {}
    form.value = gateway ? getGatewayForm(gateway) : getDefaultForm()
  },
)

watch(
  () => [models.value, networksState.value.data] as const,
  () => {
    if (isShown && !gateway && !form.value.pbxAddress && !form.value.manufacturer) {
      form.value = getDefaultForm()
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
    fieldRefs[field].value?.focus()
    return
  }
  const fxoIndex = Object.keys(validationIssues.value.fxoNumbers ?? {}).map(Number)[0]

  if (fxoIndex !== undefined) {
    fxoRefs.value?.[fxoIndex]?.focus()
    return
  }
  const fxsIndex = Object.keys(validationIssues.value.fxsExtensions ?? {}).map(Number)[0]

  if (fxsIndex !== undefined) {
    fxsRefs.value?.[fxsIndex]?.focus()
  }
}

function save() {
  if (isReadOnly.value) {
    return
  }
  resetCreate()
  const model = selectedModel.value
  validationIssues.value = validateGatewayForm(form.value, {
    model,
    existingMacAddresses,
  })

  if (hasGatewayValidationIssues(validationIssues.value) || !model) {
    focusFirstInvalidField()
    return
  }
  createGateway({ values: { ...form.value }, model })
}
</script>

<template>
  <NeSideDrawer
    :is-shown="isShown"
    :title="isReadOnly ? label : t('trunks.physical.add_physical_trunk')"
    :close-aria-label="t('shell.close_side_drawer')"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="save">
      <div class="flex flex-col gap-6">
        <NeInlineNotification
          v-if="isReadOnly"
          kind="info"
          :title="t('trunks.physical.read_only_title')"
          :description="t('trunks.physical.read_only_description')"
        />
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
          :disabled="saving || isReadOnly"
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
          :invalid-message="issue('modelId')"
          :disabled="saving || isReadOnly || !form.manufacturer"
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
          placeholder="00:A0:BA:0B:1C:DD"
          :invalid-message="issue('macAddress')"
          :disabled="saving || isReadOnly"
          @blur="form.macAddress = form.macAddress.trim()"
        />
        <NeTextInput
          ref="ipAddressRef"
          v-model="form.ipAddress"
          :label="t('trunks.physical.ip_address')"
          :helper-text="t('trunks.physical.ip_address_helper')"
          :invalid-message="issue('ipAddress')"
          :disabled="saving || isReadOnly"
          @blur="form.ipAddress = form.ipAddress.trim()"
        />
        <NeTextInput
          ref="netmaskRef"
          v-model="form.netmask"
          :label="t('trunks.physical.netmask')"
          :invalid-message="issue('netmask')"
          :disabled="saving || isReadOnly"
          @blur="form.netmask = form.netmask.trim()"
        />
        <NeTextInput
          ref="networkGatewayRef"
          v-model="form.networkGateway"
          :label="t('trunks.physical.network_gateway')"
          :invalid-message="issue('networkGateway')"
          :disabled="saving || isReadOnly"
          @blur="form.networkGateway = form.networkGateway.trim()"
        />
        <NeTextInput
          ref="pbxAddressRef"
          v-model="form.pbxAddress"
          :label="t('trunks.physical.pbx_address')"
          :helper-text="t('trunks.physical.pbx_address_helper')"
          :invalid-message="issue('pbxAddress')"
          :disabled="saving || isReadOnly"
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
          :disabled="saving || isReadOnly"
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
          :disabled="saving || isReadOnly"
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
          :disabled="saving || isReadOnly || fxsUsersState.status === 'pending'"
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
          v-if="saveError"
          kind="error"
          :title="t('trunks.cannot_create_trunk')"
          :description="describeGatewayError(saveError) || describeError(saveError)"
        />
      </div>
      <hr class="my-8" />
      <div class="flex justify-end gap-3">
        <template v-if="gateway">
          <NeButton kind="tertiary" size="lg" @click.prevent="emit('download', gateway)">
            {{ t('trunks.physical.download_configuration') }}
          </NeButton>
          <NeButton kind="primary" size="lg" @click.prevent="emit('close')">
            {{ t('common.close') }}
          </NeButton>
        </template>
        <template v-else>
          <NeButton kind="tertiary" size="lg" :disabled="saving" @click.prevent="emit('close')">
            {{ t('common.cancel') }}
          </NeButton>
          <NeButton type="submit" kind="primary" size="lg" :disabled="saving" :loading="saving">
            {{ t('trunks.add_trunk') }}
          </NeButton>
        </template>
      </div>
    </form>
  </NeSideDrawer>
</template>
