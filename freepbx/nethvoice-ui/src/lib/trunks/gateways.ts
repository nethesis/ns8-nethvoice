//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { getApiErrorMessage, isApiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'
import { compareNatural, matchesText } from '@/lib/common'
import type { Trunk } from './trunks'
import type { TrunksLiveState } from './liveState'

export const GATEWAYS_KEY = 'gateways'
export const GATEWAY_MODELS_KEY = 'gatewayModels'
export const HOST_NETWORKS_KEY = 'hostNetworks'

const GATEWAYS_LIST_SCOPE = 'all'

const ZERO_BASED_PORT_MANUFACTURERS = ['patton']

const XML_CONFIG_MANUFACTURERS = ['grandstream']

const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

const HOST_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/

const LINE_NUMBER_PATTERN = /^\+?[0-9]+$/

const NumericSchema = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.regex(/^\d+$/))]),
  v.transform(Number),
  v.integer(),
)

const GatewayModelsResponseSchema = v.record(
  v.string(),
  v.array(
    v.object({
      id: NumericSchema,
      model: v.string(),
      manufacturer: v.string(),
      description: v.nullish(v.string(), ''),
      n_pri_trunks: v.nullish(NumericSchema, 0),
      n_isdn_trunks: v.nullish(NumericSchema, 0),
      n_fxo_trunks: v.nullish(NumericSchema, 0),
      n_fxs_ext: v.nullish(NumericSchema, 0),
      proxy: v.nullish(v.string(), ''),
      ipv4_green: v.nullish(v.string(), ''),
    }),
  ),
)

const GatewaysResponseSchema = v.array(
  v.object({
    id: NumericSchema,
    model: NumericSchema,
    manufacturer: v.nullish(v.string(), ''),
    name: v.nullish(v.string(), ''),
    mac: v.nullish(v.string(), ''),
    ipv4: v.nullish(v.string(), ''),
    ipv4_new: v.nullish(v.string(), ''),
    netmask_green: v.nullish(v.string(), ''),
    gateway: v.nullish(v.string(), ''),
    ipv4_green: v.nullish(v.string(), ''),
    trunks_isdn: v.nullish(
      v.array(v.object({ name: NumericSchema, type: v.nullish(v.string(), 'pp') })),
      [],
    ),
    trunks_pri: v.nullish(v.array(v.object({ linked_trunk: NumericSchema })), []),
    trunks_fxo: v.nullish(
      v.array(v.object({ linked_trunk: NumericSchema, number: v.nullish(v.string(), '') })),
      [],
    ),
    trunks_fxs: v.nullish(
      v.array(
        v.object({
          linked_extension: v.nullish(
            v.pipe(v.union([v.string(), v.number()]), v.transform(String)),
            '',
          ),
        }),
      ),
      [],
    ),
  }),
)

const GatewaySaveResultSchema = v.object({
  status: v.literal(true),
  id: v.nullish(NumericSchema),
})

const HostNetworksResponseSchema = v.nullish(
  v.array(
    v.object({
      ip: v.nullish(v.string(), ''),
      netmask: v.nullish(v.string(), ''),
      gateway: v.nullish(v.string(), ''),
    }),
  ),
  [],
)

export type IsdnPortMode = 'pp' | 'pmp'

export type GatewayModel = {
  id: number
  manufacturer: string
  model: string
  description: string
  isdnPorts: number
  priPorts: number
  fxoPorts: number
  fxsPorts: number
  proxy: string
  defaultPbxAddress: string
}

export type Gateway = {
  id: number
  name: string
  modelId: number
  manufacturer: string
  macAddress: string
  ipAddress: string
  netmask: string
  networkGateway: string
  pbxAddress: string
  isdnModes: IsdnPortMode[]
  fxoNumbers: string[]
  fxsExtensions: string[]
  trunkIds: number[]
}

export type GatewayForm = {
  manufacturer: string
  modelId: string
  macAddress: string
  ipAddress: string
  netmask: string
  networkGateway: string
  pbxAddress: string
  isdnModes: IsdnPortMode[]
  fxoNumbers: string[]
  fxsExtensions: string[]
}

export type GatewayField =
  | 'manufacturer'
  | 'modelId'
  | 'macAddress'
  | 'ipAddress'
  | 'netmask'
  | 'networkGateway'
  | 'pbxAddress'

export type GatewayValidationIssues = Partial<Record<GatewayField, string>> & {
  fxoNumbers?: Record<number, string>
  fxsExtensions?: Record<number, string>
}

export type GatewayStatus = 'connected' | 'not_connected' | 'unknown'

export type HostNetwork = {
  ip: string
  netmask: string
  gateway: string
}

export type GatewaySaveRequest = components['schemas']['GatewaySaveRequest']

const toIsdnPortMode = (value: string): IsdnPortMode => (value === 'pmp' ? 'pmp' : 'pp')

export const parseGatewayModels = (raw: unknown): GatewayModel[] =>
  Object.values(v.parse(GatewayModelsResponseSchema, raw)).flatMap((models) =>
    models
      .map((model) => ({
        id: model.id,
        manufacturer: model.manufacturer,
        model: model.model,
        description: model.description.trim() || model.model,
        isdnPorts: model.n_isdn_trunks,
        priPorts: model.n_pri_trunks,
        fxoPorts: model.n_fxo_trunks,
        fxsPorts: model.n_fxs_ext,
        proxy: model.proxy,
        defaultPbxAddress: model.ipv4_green,
      }))
      .sort((a, b) => compareNatural(a.description, b.description)),
  )

export const parseGateways = (raw: unknown): Gateway[] =>
  v
    .parse(GatewaysResponseSchema, raw)
    .map((gateway) => ({
      id: gateway.id,
      name: gateway.name,
      modelId: gateway.model,
      manufacturer: gateway.manufacturer,
      macAddress: gateway.mac.toUpperCase(),
      ipAddress: gateway.ipv4_new || gateway.ipv4,
      netmask: gateway.netmask_green,
      networkGateway: gateway.gateway,
      pbxAddress: gateway.ipv4_green,
      isdnModes: gateway.trunks_isdn.map((port) => toIsdnPortMode(port.type)),
      fxoNumbers: gateway.trunks_fxo.map((port) => port.number),
      fxsExtensions: gateway.trunks_fxs.map((port) => port.linked_extension),
      trunkIds: [
        ...gateway.trunks_isdn.map((port) => port.name),
        ...gateway.trunks_pri.map((port) => port.linked_trunk),
        ...gateway.trunks_fxo.map((port) => port.linked_trunk),
      ],
    }))
    .sort(
      (a, b) =>
        compareNatural(a.manufacturer, b.manufacturer) || compareNatural(a.ipAddress, b.ipAddress),
    )

export const parseHostNetworks = (raw: unknown): HostNetwork[] =>
  v.parse(HostNetworksResponseSchema, raw)

export const getGatewayModels = async (): Promise<GatewayModel[]> => {
  const { data } = await api.GET('/devices/gateways/manufacturers')
  return parseGatewayModels(data)
}

export const getGateways = async (): Promise<Gateway[]> => {
  const { data } = await api.GET('/devices/gateways/list/{id}', {
    params: { path: { id: GATEWAYS_LIST_SCOPE } },
  })
  return parseGateways(data)
}

export const getHostNetworks = async (): Promise<HostNetwork[]> => {
  const { data } = await api.GET('/configuration/networks')
  return parseHostNetworks(data)
}

export const getManufacturers = (models: GatewayModel[]): string[] => [
  ...new Set(models.map((model) => model.manufacturer)),
]

export const findGatewayModel = (
  models: GatewayModel[],
  modelId: number | string,
): GatewayModel | undefined => models.find((model) => model.id === Number(modelId))

export const getModelLabel = (model: GatewayModel): string =>
  model.description === model.model ? model.model : `${model.description} (${model.model})`

export const getGatewayModelDescription = (gateway: Gateway, models: GatewayModel[]): string =>
  findGatewayModel(models, gateway.modelId)?.description ?? ''

export const getGatewayLabel = (gateway: Gateway, models: GatewayModel[]): string =>
  [gateway.manufacturer, getGatewayModelDescription(gateway, models)].filter(Boolean).join(' ') ||
  gateway.name

export const getGatewayName = (model: GatewayModel): string =>
  `${model.manufacturer}-${model.description}`

export const getPortNumber = (manufacturer: string, index: number): number =>
  ZERO_BASED_PORT_MANUFACTURERS.includes(manufacturer.toLowerCase()) ? index : index + 1

export const getGatewayTrunkIds = (gateways: Gateway[]): number[] =>
  gateways.flatMap((gateway) => gateway.trunkIds)

export const filterGateways = (
  gateways: Gateway[],
  textFilter: string,
  models: GatewayModel[],
): Gateway[] =>
  gateways.filter((gateway) =>
    matchesText(
      textFilter,
      gateway.manufacturer,
      getGatewayModelDescription(gateway, models),
      gateway.ipAddress,
      gateway.macAddress,
    ),
  )

export const getGatewayStatus = (
  gateway: Gateway,
  trunks: Trunk[] | undefined,
  liveState: TrunksLiveState | undefined,
): GatewayStatus => {
  if (!trunks || !liveState || gateway.trunkIds.length === 0) {
    return 'unknown'
  }
  const states = trunks
    .filter((trunk) => gateway.trunkIds.includes(trunk.id))
    .map((trunk) => liveState[trunk.name]?.status)
    .filter((status) => status !== undefined && status !== 'unmonitored')

  if (states.length === 0) {
    return 'unknown'
  }
  return states.some((status) => status === 'online' || status === 'busy')
    ? 'connected'
    : 'not_connected'
}

export const normalizeMacAddress = (macAddress: string): string => {
  const digits = macAddress.replace(/[:.\-\s]/g, '').toUpperCase()

  if (!/^[0-9A-F]{12}$/.test(digits)) {
    return ''
  }
  return digits.replace(/(.{2})(?=.)/g, '$1:')
}

export const isIpv4Address = (value: string): boolean => IPV4_PATTERN.test(value)

export const isNetmask = (value: string): boolean => {
  if (!isIpv4Address(value)) {
    return false
  }
  const bits = value
    .split('.')
    .map((octet) => Number(octet).toString(2).padStart(8, '0'))
    .join('')

  return /^1+0*$/.test(bits)
}

const resizePorts = <T>(ports: T[], length: number, fallback: T): T[] =>
  Array.from({ length }, (_, index) => ports[index] ?? fallback)

export const getEmptyGatewayForm = (
  defaultPbxAddress = '',
  network?: HostNetwork,
): GatewayForm => ({
  manufacturer: '',
  modelId: '',
  macAddress: '',
  ipAddress: '',
  netmask: network?.netmask ?? '',
  networkGateway: network?.gateway ?? '',
  pbxAddress: defaultPbxAddress,
  isdnModes: [],
  fxoNumbers: [],
  fxsExtensions: [],
})

export const getGatewayForm = (gateway: Gateway): GatewayForm => ({
  manufacturer: gateway.manufacturer,
  modelId: String(gateway.modelId),
  macAddress: gateway.macAddress,
  ipAddress: gateway.ipAddress,
  netmask: gateway.netmask,
  networkGateway: gateway.networkGateway,
  pbxAddress: gateway.pbxAddress,
  isdnModes: [...gateway.isdnModes],
  fxoNumbers: [...gateway.fxoNumbers],
  fxsExtensions: [...gateway.fxsExtensions],
})

export const withModelPorts = (
  form: GatewayForm,
  model: GatewayModel | undefined,
): GatewayForm => ({
  ...form,
  isdnModes: resizePorts<IsdnPortMode>(form.isdnModes, model?.isdnPorts ?? 0, 'pp'),
  fxoNumbers: resizePorts(form.fxoNumbers, model?.fxoPorts ?? 0, ''),
  fxsExtensions: resizePorts(form.fxsExtensions, model?.fxsPorts ?? 0, ''),
})

export const validateGatewayForm = (
  form: GatewayForm,
  options: { model: GatewayModel | undefined; existingMacAddresses: string[] },
): GatewayValidationIssues => {
  const issues: GatewayValidationIssues = {}
  const macAddress = normalizeMacAddress(form.macAddress)

  if (!form.manufacturer) {
    issues.manufacturer = 'trunks.physical.manufacturer_required'
  }

  if (!options.model) {
    issues.modelId = 'trunks.physical.model_required'
  }

  if (!form.macAddress.trim()) {
    issues.macAddress = 'trunks.physical.mac_address_required'
  } else if (!macAddress) {
    issues.macAddress = 'trunks.physical.mac_address_invalid'
  } else if (options.existingMacAddresses.includes(macAddress)) {
    issues.macAddress = 'trunks.physical.mac_address_already_used'
  }

  if (!form.ipAddress.trim()) {
    issues.ipAddress = 'trunks.physical.ip_address_required'
  } else if (!isIpv4Address(form.ipAddress.trim())) {
    issues.ipAddress = 'trunks.physical.ip_address_invalid'
  }

  if (!form.netmask.trim()) {
    issues.netmask = 'trunks.physical.netmask_required'
  } else if (!isNetmask(form.netmask.trim())) {
    issues.netmask = 'trunks.physical.netmask_invalid'
  }

  if (!form.networkGateway.trim()) {
    issues.networkGateway = 'trunks.physical.network_gateway_required'
  } else if (!isIpv4Address(form.networkGateway.trim())) {
    issues.networkGateway = 'trunks.physical.ip_address_invalid'
  }

  if (!form.pbxAddress.trim()) {
    issues.pbxAddress = 'trunks.physical.pbx_address_required'
  } else if (!HOST_PATTERN.test(form.pbxAddress.trim())) {
    issues.pbxAddress = 'trunks.physical.pbx_address_invalid'
  }

  const fxoIssues: Record<number, string> = {}

  form.fxoNumbers.forEach((number, index) => {
    if (number.trim() && !LINE_NUMBER_PATTERN.test(number.trim())) {
      fxoIssues[index] = 'trunks.physical.line_number_invalid'
    }
  })

  if (Object.keys(fxoIssues).length > 0) {
    issues.fxoNumbers = fxoIssues
  }

  const fxsIssues: Record<number, string> = {}

  form.fxsExtensions.forEach((extension, index) => {
    if (!extension) {
      return
    }

    if (form.fxsExtensions.slice(0, index).some((previous) => !previous)) {
      fxsIssues[index] = 'trunks.physical.fxs_previous_port_required'
    } else if (form.fxsExtensions.indexOf(extension) !== index) {
      fxsIssues[index] = 'trunks.physical.fxs_user_already_assigned'
    }
  })

  if (Object.keys(fxsIssues).length > 0) {
    issues.fxsExtensions = fxsIssues
  }
  return issues
}

export const hasGatewayValidationIssues = (issues: GatewayValidationIssues): boolean =>
  Object.keys(issues).length > 0

export const toGatewaySaveRequest = (
  form: GatewayForm,
  model: GatewayModel,
): GatewaySaveRequest => {
  const ipAddress = form.ipAddress.trim()
  const portNumber = (index: number) => getPortNumber(model.manufacturer, index)

  return {
    name: getGatewayName(model),
    model: model.id,
    manufacturer: model.manufacturer,
    mac: normalizeMacAddress(form.macAddress),
    ipv4: '',
    ipv4_new: ipAddress,
    netmask_green: form.netmask.trim(),
    gateway: form.networkGateway.trim(),
    ipv4_green: form.pbxAddress.trim(),
    proxy: model.proxy,
    trunks_isdn: form.isdnModes
      .slice(0, model.isdnPorts)
      .map((type, index) => ({ name: portNumber(index), type })),
    trunks_pri: Array.from({ length: model.priPorts }, (_, index) => ({
      name: portNumber(index),
    })),
    trunks_fxo: form.fxoNumbers
      .slice(0, model.fxoPorts)
      .map((number, index) => ({ name: portNumber(index), number: number.trim() })),
    trunks_fxs: form.fxsExtensions
      .slice(0, model.fxsPorts)
      .map((extension, index) => ({ name: portNumber(index), linked_extension: extension }))
      .filter((port) => port.linked_extension !== ''),
  }
}

export const postGateway = async (request: GatewaySaveRequest): Promise<void> => {
  const { data } = await api.POST('/devices/gateways', { body: request })
  v.parse(GatewaySaveResultSchema, data)
}

export const deleteGateway = async (gatewayId: number): Promise<void> => {
  await api.DELETE('/devices/gateways/{id}', { params: { path: { id: String(gatewayId) } } })
}

export const decodeBase64 = (encoded: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))

export const getGatewayConfigFileName = (gateway: Gateway): string => {
  const baseName = gateway.name.trim().split(/\s+/)[0] || 'gateway'
  const extension = XML_CONFIG_MANUFACTURERS.includes(gateway.manufacturer.toLowerCase())
    ? 'xml'
    : 'cfg'

  return `${baseName}.${extension}`
}

export const getGatewayConfigFile = async (gateway: Gateway): Promise<Blob> => {
  const { data } = await api.GET('/devices/gateways/download/{name}/{mac}', {
    params: { path: { name: gateway.name, mac: gateway.macAddress } },
  })

  return new Blob([decodeBase64(v.parse(v.string(), data))], {
    type: 'application/octet-stream',
  })
}

export const describeGatewayError = (error: unknown): string =>
  isApiError(error) ? getApiErrorMessage(error.body) : ''
