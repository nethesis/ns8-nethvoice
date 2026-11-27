//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type {
  AnnouncementData,
  CallFlowControlData,
  ConferenceData,
  DirectDidData,
  ExtensionData,
  InboundRouteData,
  QueueData,
  QueueExitData,
  QueueOptionsData,
  QueuePriorityData,
  RingGroupData,
  SavedObjectType,
  SetCallerIdData,
  TimeConditionData,
  VisualPlanData,
} from '@/lib/visualplan/api'

export const NODE_TYPES = [
  'inboundRoute',
  'extension',
  'voicemail',
  'conference',
  'hangup',
  'ringGroup',
  'queue',
  'ivr',
  'cqr',
  'announcement',
  'timeCondition',
  'callFlowControl',
  'setCallerId',
  'directDid',
  'queueExit',
  'queueOptions',
  'queuePriority',
  'other',
] as const

export type NodeType = (typeof NODE_TYPES)[number]

export const VOICEMAIL_MODES = ['vmu', 'vmb', 'vms', 'vmi'] as const

export type VoicemailMode = (typeof VOICEMAIL_MODES)[number]

export type MenuEntry = { id: string; value: string }

export type IvrNodeData = {
  id: number | null
  name: string
  description: string
  announcement: number | null
  directDial: boolean
  entries: MenuEntry[]
}

export type CqrNodeData = {
  id: number | null
  name: string
  description: string
  announcement: number | null
  entries: MenuEntry[]
}

export type VoicemailNodeData = { extension: string; mode: VoicemailMode }

export type HangupNodeData = { variant: string }

export type OtherNodeData = { destination: string }

type WithoutDestinations<T> = Omit<
  T,
  {
    [K in keyof T]: K extends `${string}Destination` | 'destination' ? K : never
  }[keyof T]
>

export type NodeDataByType = {
  inboundRoute: WithoutDestinations<InboundRouteData>
  extension: ExtensionData
  voicemail: VoicemailNodeData
  conference: ConferenceData
  hangup: HangupNodeData
  ringGroup: WithoutDestinations<RingGroupData>
  queue: WithoutDestinations<QueueData>
  ivr: IvrNodeData
  cqr: CqrNodeData
  announcement: WithoutDestinations<AnnouncementData>
  timeCondition: WithoutDestinations<TimeConditionData> & { timeGroupRef: string | null }
  callFlowControl: WithoutDestinations<CallFlowControlData>
  setCallerId: WithoutDestinations<SetCallerIdData>
  directDid: WithoutDestinations<DirectDidData>
  queueExit: WithoutDestinations<QueueExitData>
  queueOptions: WithoutDestinations<QueueOptionsData>
  queuePriority: WithoutDestinations<QueuePriorityData>
  other: OtherNodeData
}

export type FlowNodeOf<T extends NodeType> = {
  id: string
  type: T
  key: string
  isNew: boolean
  data: NodeDataByType[T]
}

export type FlowNode = { [T in NodeType]: FlowNodeOf<T> }[NodeType]

export type FlowEdge = { source: string; output: string; target: string; destination?: string }

export type OutputDef = { id: string; labelKey: string; label?: string; required: boolean }

export type Position = { x: number; y: number }

export const NEW_REF_PREFIX = 'new:'

export const SAVED_TYPE_BY_NODE: Partial<Record<NodeType, SavedObjectType>> = {
  inboundRoute: 'inboundRoute',
  conference: 'conference',
  ringGroup: 'ringGroup',
  queue: 'queue',
  ivr: 'ivr',
  cqr: 'cqr',
  announcement: 'announcement',
  timeCondition: 'timeCondition',
  callFlowControl: 'callFlowControl',
  setCallerId: 'setCallerId',
  directDid: 'directDid',
  queueExit: 'queueExit',
  queueOptions: 'queueOptions',
  queuePriority: 'queuePriority',
}

export const NUMBER_KEYED_TYPES: NodeType[] = [
  'conference',
  'ringGroup',
  'queue',
  'callFlowControl',
]

export const CREATABLE_TYPES: NodeType[] = [
  'extension',
  'ringGroup',
  'queue',
  'ivr',
  'cqr',
  'announcement',
  'timeCondition',
  'callFlowControl',
  'voicemail',
  'conference',
  'hangup',
  'setCallerId',
  'directDid',
  'queueExit',
  'queueOptions',
  'queuePriority',
]

export const EXISTING_TYPES: NodeType[] = [
  'extension',
  'ringGroup',
  'queue',
  'ivr',
  'cqr',
  'announcement',
  'timeCondition',
  'callFlowControl',
  'conference',
  'voicemail',
  'setCallerId',
  'directDid',
  'queueExit',
  'queueOptions',
  'queuePriority',
]

const QUEUE_EXIT_OUTPUTS = [
  'timeoutDestination',
  'fullDestination',
  'joinEmptyDestination',
  'leaveEmptyDestination',
  'joinUnavailableDestination',
  'leaveUnavailableDestination',
  'continueDestination',
] as const

const toSnake = (value: string): string => value.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

const output = (id: string, required = false): OutputDef => ({
  id,
  labelKey: `visual_plan.outputs.${toSnake(id)}`,
  required,
})

export const entryOutputId = (entry: MenuEntry): string => `entry:${entry.id}`

export const getOutputs = (node: FlowNode): OutputDef[] => {
  switch (node.type) {
    case 'inboundRoute':
    case 'announcement':
    case 'setCallerId':
    case 'queuePriority':
      return [output('destination', true)]
    case 'ringGroup':
    case 'queue':
      return [{ ...output('destination'), labelKey: 'visual_plan.outputs.no_answer' }]
    case 'queueOptions':
      return [output('destination', true), output('failoverDestination')]
    case 'timeCondition':
      return [output('trueDestination', true), output('falseDestination', true)]
    case 'callFlowControl':
      return [output('normalDestination', true), output('overrideDestination', true)]
    case 'directDid':
      return [
        output('timeoutDestination'),
        output('busyDestination'),
        output('unavailableDestination'),
      ]
    case 'queueExit':
      return QUEUE_EXIT_OUTPUTS.map((id) => output(id))
    case 'ivr':
      return [
        ...node.data.entries.map((entry) => ({
          id: entryOutputId(entry),
          labelKey: 'visual_plan.outputs.ivr_entry',
          label: entry.value,
          required: true,
        })),
        output('invalidDestination'),
        output('timeoutDestination'),
      ]
    case 'cqr':
      return [
        ...node.data.entries.map((entry) => ({
          id: entryOutputId(entry),
          labelKey: 'visual_plan.outputs.cqr_entry',
          label: entry.value,
          required: true,
        })),
        output('defaultDestination'),
      ]
    default:
      return []
  }
}

const PATTERNS: [RegExp, NodeType][] = [
  [/^ext-group,([^,]+),/, 'ringGroup'],
  [/^ext-queues,([^,]+),/, 'queue'],
  [/^from-did-direct,([^,]+),/, 'extension'],
  [/^ext-local,(vm[bsui]\d+),/, 'voicemail'],
  [/^ext-meetme,([^,]+),/, 'conference'],
  [/^app-blackhole,([^,]+),/, 'hangup'],
  [/^ivr-(\d+),/, 'ivr'],
  [/^nethcqr,(\d+),/, 'cqr'],
  [/^app-announcement-(\d+),/, 'announcement'],
  [/^timeconditions,(\d+),/, 'timeCondition'],
  [/^app-daynight,([^,]+),/, 'callFlowControl'],
  [/^app-setcid,(\d+),/, 'setCallerId'],
  [/^directdid-(\d+),/, 'directDid'],
  [/^queueexit-(\d+),/, 'queueExit'],
  [/^queueoptions-(\d+),/, 'queueOptions'],
  [/^app-queueprio,(\d+),/, 'queuePriority'],
]

export type ParsedDestination = { type: NodeType; key: string }

export const parseDestination = (destination: string): ParsedDestination | null => {
  const value = destination.trim()

  if (!value) {
    return null
  }
  for (const [pattern, type] of PATTERNS) {
    const match = pattern.exec(value)
    if (match?.[1]) {
      return { type, key: match[1] }
    }
  }
  return { type: 'other', key: value }
}

export const buildDestination = (type: NodeType, key: string): string => {
  switch (type) {
    case 'ringGroup':
      return `ext-group,${key},1`
    case 'queue':
      return `ext-queues,${key},1`
    case 'extension':
      return `from-did-direct,${key},1`
    case 'voicemail':
      return `ext-local,${key},1`
    case 'conference':
      return `ext-meetme,${key},1`
    case 'hangup':
      return `app-blackhole,${key},1`
    case 'ivr':
      return `ivr-${key},s,1`
    case 'cqr':
      return `nethcqr,${key},1`
    case 'announcement':
      return `app-announcement-${key},s,1`
    case 'timeCondition':
      return `timeconditions,${key},1`
    case 'callFlowControl':
      return `app-daynight,${key},1`
    case 'setCallerId':
      return `app-setcid,${key},1`
    case 'directDid':
      return `directdid-${key},\${EXTEN},1`
    case 'queueExit':
      return `queueexit-${key},\${EXTEN},1`
    case 'queueOptions':
      return `queueoptions-${key},s,1`
    case 'queuePriority':
      return `app-queueprio,${key},1`
    default:
      return key
  }
}

export const voicemailKey = (data: VoicemailNodeData): string => `${data.mode}${data.extension}`

export const parseVoicemailKey = (key: string): VoicemailNodeData => {
  const mode = VOICEMAIL_MODES.find((candidate) => key.startsWith(candidate)) ?? 'vmu'
  return { mode, extension: key.slice(mode.length) }
}

export const nodeIdOf = (type: NodeType, key: string): string => `${type}:${key}`

export const inboundRouteKey = (route: Pick<InboundRouteData, 'extension' | 'cidnum'>): string =>
  `${route.extension}/${route.cidnum}`

export const destinationOfNode = (node: FlowNode): string => {
  switch (node.type) {
    case 'voicemail':
      return buildDestination('voicemail', voicemailKey(node.data))
    case 'hangup':
      return buildDestination('hangup', node.data.variant)
    case 'other':
      return node.data.destination
    case 'extension':
      return buildDestination('extension', node.data.extension)
    case 'conference':
    case 'ringGroup':
    case 'queue':
    case 'callFlowControl':
      return buildDestination(node.type, node.data.id)
    default:
      return node.isNew ? `${NEW_REF_PREFIX}${node.key}` : buildDestination(node.type, node.key)
  }
}

let entryCounter = 0

export const newEntryId = (): string => {
  entryCounter += 1
  return `e${entryCounter}`
}

export type CatalogObject = { node: FlowNode; destinations: Record<string, string> }

const strip = <T extends Record<string, unknown>>(data: T, keys: string[]) =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)))

const destinationKeys = (data: Record<string, unknown>): string[] =>
  Object.keys(data).filter((key) => key === 'destination' || key.endsWith('Destination'))

const splitDestinations = <T extends Record<string, unknown>>(data: T) => {
  const keys = destinationKeys(data)
  return {
    rest: strip(data, keys),
    destinations: Object.fromEntries(keys.map((key) => [key, String(data[key] ?? '')])),
  }
}

const catalogEntry = <T extends NodeType>(
  type: T,
  key: string,
  data: NodeDataByType[T],
  destinations: Record<string, string> = {},
): CatalogObject => ({
  node: { id: nodeIdOf(type, key), type, key, isNew: false, data } as FlowNode,
  destinations,
})

const simple = <T extends NodeType>(
  type: T,
  key: string,
  data: Record<string, unknown>,
): CatalogObject => {
  const { rest, destinations } = splitDestinations(data)
  return catalogEntry(type, key, rest as NodeDataByType[T], destinations)
}

export const buildCatalog = (data: VisualPlanData): Map<string, CatalogObject> => {
  const catalog = new Map<string, CatalogObject>()
  const add = (entry: CatalogObject) => catalog.set(entry.node.id, entry)

  data.inboundRoutes.forEach((route) => add(simple('inboundRoute', inboundRouteKey(route), route)))
  data.extensions.forEach((ext) => add(catalogEntry('extension', ext.extension, ext)))
  data.conferences.forEach((item) => add(catalogEntry('conference', item.id, item)))
  data.ringGroups.forEach((item) => add(simple('ringGroup', item.id, item)))
  data.queues.forEach((item) => add(simple('queue', item.id, item)))
  data.announcements.forEach((item) => add(simple('announcement', String(item.id), item)))
  data.timeConditions.forEach((item) =>
    add(simple('timeCondition', String(item.id), { ...item, timeGroupRef: null })),
  )
  data.callFlowControls.forEach((item) => add(simple('callFlowControl', item.id, item)))
  data.setCallerIds.forEach((item) => add(simple('setCallerId', String(item.id), item)))
  data.directDids.forEach((item) => add(simple('directDid', String(item.id), item)))
  data.queueExits.forEach((item) => add(simple('queueExit', String(item.id), item)))
  data.queueOptions.forEach((item) => add(simple('queueOptions', String(item.id), item)))
  data.queuePriorities.forEach((item) => add(simple('queuePriority', String(item.id), item)))

  data.ivrs.forEach((ivr) => {
    const entries = ivr.entries.map((entry, index) => ({ id: `l${index}`, value: entry.selection }))
    const destinations: Record<string, string> = {
      invalidDestination: ivr.invalidDestination,
      timeoutDestination: ivr.timeoutDestination,
    }
    entries.forEach((entry, index) => {
      destinations[entryOutputId(entry)] = ivr.entries[index]?.destination ?? ''
    })
    add(
      catalogEntry(
        'ivr',
        String(ivr.id),
        {
          id: ivr.id,
          name: ivr.name,
          description: ivr.description,
          announcement: ivr.announcement,
          directDial: ivr.directDial,
          entries,
        },
        destinations,
      ),
    )
  })

  data.cqrs.forEach((cqr) => {
    const entries = cqr.entries.map((entry, index) => ({ id: `l${index}`, value: entry.condition }))
    const destinations: Record<string, string> = { defaultDestination: cqr.defaultDestination }
    entries.forEach((entry, index) => {
      destinations[entryOutputId(entry)] = cqr.entries[index]?.destination ?? ''
    })
    add(
      catalogEntry(
        'cqr',
        String(cqr.id),
        {
          id: cqr.id,
          name: cqr.name,
          description: cqr.description,
          announcement: cqr.announcement,
          entries,
        },
        destinations,
      ),
    )
  })
  return catalog
}

export const isSavedType = (type: NodeType): boolean => SAVED_TYPE_BY_NODE[type] !== undefined
