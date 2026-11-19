//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'

export const VISUAL_PLAN_KEY = 'visualPlan'

const text = v.pipe(
  v.nullish(v.union([v.string(), v.number()]), ''),
  v.transform((value) => String(value)),
)

const int = v.pipe(
  v.nullish(v.union([v.number(), v.pipe(v.string(), v.regex(/^-?\d*$/))]), 0),
  v.transform((value) => (value === '' ? 0 : Number(value))),
  v.integer(),
)

const optionalId = v.pipe(
  v.nullish(v.union([v.number(), v.string()]), null),
  v.transform((value) => {
    if (value === null || value === '') {
      return null
    }
    const parsed = Number(value)
    return Number.isInteger(parsed) ? parsed : null
  }),
)

const destination = text

const InboundRouteSchema = v.object({
  extension: text,
  cidnum: text,
  description: text,
  alertinfo: text,
  grppre: text,
  destination,
})

const ExtensionSchema = v.object({ extension: text, name: text, voicemail: v.boolean() })

const ConferenceSchema = v.object({ id: text, name: text })

const RingGroupSchema = v.object({
  id: text,
  description: text,
  members: v.array(text),
  strategy: text,
  ringTime: int,
  destination,
})

const QueueSchema = v.object({
  id: text,
  name: text,
  staticMembers: v.array(v.object({ extension: text, penalty: int })),
  dynamicMembers: v.array(text),
  strategy: text,
  agentTimeout: int,
  maxWait: int,
  destination,
  ringing: v.picklist(['moh', 'ring']),
  cidPrefix: text,
  joinAnnouncement: optionalId,
  positionAnnouncement: v.boolean(),
  announceFrequency: int,
  breakoutIvr: optionalId,
  musicOnHold: text,
})

const IvrSchema = v.object({
  id: optionalId,
  name: text,
  description: text,
  announcement: optionalId,
  directDial: v.boolean(),
  invalidDestination: destination,
  timeoutDestination: destination,
  entries: v.array(v.object({ selection: text, destination })),
})

const CqrSchema = v.object({
  id: optionalId,
  name: text,
  description: text,
  announcement: optionalId,
  defaultDestination: destination,
  entries: v.array(v.object({ condition: text, destination })),
})

const AnnouncementSchema = v.object({
  id: optionalId,
  description: text,
  recording: optionalId,
  destination,
})

const TimeConditionSchema = v.object({
  id: optionalId,
  name: text,
  timeGroup: optionalId,
  trueDestination: destination,
  falseDestination: destination,
})

const TimeGroupSchema = v.object({ id: optionalId, description: text, times: v.array(text) })

const CallFlowControlSchema = v.object({
  id: text,
  name: text,
  state: v.picklist(['DAY', 'NIGHT']),
  normalDestination: destination,
  overrideDestination: destination,
})

const SetCallerIdSchema = v.object({
  id: optionalId,
  description: text,
  cidName: text,
  cidNum: text,
  destination,
})

const DirectDidSchema = v.object({
  id: optionalId,
  prefix: text,
  root: text,
  varlength: int,
  timeout: int,
  timeoutDestination: destination,
  busyDestination: destination,
  unavailableDestination: destination,
})

const QueueExitSchema = v.object({
  id: optionalId,
  name: text,
  timeoutDestination: destination,
  fullDestination: destination,
  joinEmptyDestination: destination,
  leaveEmptyDestination: destination,
  joinUnavailableDestination: destination,
  leaveUnavailableDestination: destination,
  continueDestination: destination,
})

const QueueOptionsSchema = v.object({
  id: optionalId,
  name: text,
  cidPrefix: text,
  alertInfo: text,
  joinAnnouncement: optionalId,
  musicOnHold: text,
  positionEnabled: v.boolean(),
  position: int,
  maxWaitEnabled: v.boolean(),
  maxWait: int,
  failoverEnabled: v.boolean(),
  failoverDestination: destination,
  destination,
})

const QueuePrioritySchema = v.object({
  id: optionalId,
  description: text,
  priority: int,
  destination,
})

const RecordingSchema = v.object({ id: int, name: text, description: text })

const OtherDestinationSchema = v.object({ destination: text, category: text, description: text })

export const VisualPlanDataSchema = v.object({
  inboundRoutes: v.array(InboundRouteSchema),
  extensions: v.array(ExtensionSchema),
  conferences: v.array(ConferenceSchema),
  ringGroups: v.array(RingGroupSchema),
  queues: v.array(QueueSchema),
  ivrs: v.array(IvrSchema),
  cqrs: v.array(CqrSchema),
  announcements: v.array(AnnouncementSchema),
  timeConditions: v.array(TimeConditionSchema),
  timeGroups: v.array(TimeGroupSchema),
  callFlowControls: v.array(CallFlowControlSchema),
  availableCallFlowCodes: v.array(text),
  setCallerIds: v.array(SetCallerIdSchema),
  directDids: v.array(DirectDidSchema),
  queueExits: v.array(QueueExitSchema),
  queueOptions: v.array(QueueOptionsSchema),
  queuePriorities: v.array(QueuePrioritySchema),
  recordings: v.array(RecordingSchema),
  musicOnHold: v.array(text),
  destinations: v.array(OtherDestinationSchema),
  unavailable: v.array(v.string()),
  layouts: v.optional(
    v.record(v.string(), v.record(v.string(), v.object({ x: v.number(), y: v.number() }))),
    {},
  ),
})

export type VisualPlanData = v.InferOutput<typeof VisualPlanDataSchema>
export type InboundRouteData = v.InferOutput<typeof InboundRouteSchema>
export type ExtensionData = v.InferOutput<typeof ExtensionSchema>
export type ConferenceData = v.InferOutput<typeof ConferenceSchema>
export type RingGroupData = v.InferOutput<typeof RingGroupSchema>
export type QueueData = v.InferOutput<typeof QueueSchema>
export type IvrData = v.InferOutput<typeof IvrSchema>
export type CqrData = v.InferOutput<typeof CqrSchema>
export type AnnouncementData = v.InferOutput<typeof AnnouncementSchema>
export type TimeConditionData = v.InferOutput<typeof TimeConditionSchema>
export type TimeGroupData = v.InferOutput<typeof TimeGroupSchema>
export type CallFlowControlData = v.InferOutput<typeof CallFlowControlSchema>
export type SetCallerIdData = v.InferOutput<typeof SetCallerIdSchema>
export type DirectDidData = v.InferOutput<typeof DirectDidSchema>
export type QueueExitData = v.InferOutput<typeof QueueExitSchema>
export type QueueOptionsData = v.InferOutput<typeof QueueOptionsSchema>
export type QueuePriorityData = v.InferOutput<typeof QueuePrioritySchema>
export type RecordingData = v.InferOutput<typeof RecordingSchema>
export type OtherDestinationData = v.InferOutput<typeof OtherDestinationSchema>

export const SAVED_OBJECT_TYPES = [
  'inboundRoute',
  'voicemail',
  'conference',
  'ringGroup',
  'queue',
  'ivr',
  'cqr',
  'announcement',
  'timeCondition',
  'timeGroup',
  'callFlowControl',
  'setCallerId',
  'directDid',
  'queueExit',
  'queueOptions',
  'queuePriority',
] as const

export type SavedObjectType = (typeof SAVED_OBJECT_TYPES)[number]

export type VisualPlanChange = {
  type: SavedObjectType
  ref: string
  isNew: boolean
  data: Record<string, unknown>
}

const SaveResponseSchema = v.object({ refs: v.record(v.string(), text) })

const ValidationErrorSchema = v.object({
  message: v.optional(v.string(), ''),
  errors: v.array(
    v.object({
      ref: v.string(),
      type: v.optional(v.string(), ''),
      field: v.string(),
      message: v.string(),
    }),
  ),
})

export type SaveFieldError = { ref: string; type: string; field: string; message: string }

export class VisualPlanValidationError extends Error {
  readonly errors: SaveFieldError[]

  constructor(errors: SaveFieldError[]) {
    super('visual_plan_validation_failed')
    this.errors = errors
  }
}

export const parseVisualPlanData = (raw: unknown): VisualPlanData =>
  v.parse(VisualPlanDataSchema, raw)

export const parseSaveValidationErrors = (raw: unknown): SaveFieldError[] | null => {
  const result = v.safeParse(ValidationErrorSchema, raw)
  return result.success ? result.output.errors : null
}

export const getVisualPlanData = async (): Promise<VisualPlanData> => {
  const { data } = await api.GET('/visualplan')
  return parseVisualPlanData(data)
}

export const saveVisualPlan = async (
  changes: VisualPlanChange[],
): Promise<Record<string, string>> => {
  try {
    const { data } = await api.POST('/visualplan', { body: { changes } })
    return v.parse(SaveResponseSchema, data).refs
  } catch (error) {
    if (isApiError(error) && error.status === 422) {
      const errors = parseSaveValidationErrors(error.body)
      if (errors) {
        throw new VisualPlanValidationError(errors)
      }
    }
    throw error
  }
}

export const uploadRecording = async (file: File, name: string): Promise<RecordingData> => {
  const body = new FormData()
  body.append('file', file)
  body.append('name', name)

  const { data } = await api.POST('/visualplan/recordings', {
    body: { file: file.name, name },
    bodySerializer: () => body,
  })
  return v.parse(RecordingSchema, data)
}

export type LayoutPositions = Record<string, { x: number; y: number }>

export const saveVisualPlanLayout = async (
  route: string,
  positions: LayoutPositions,
): Promise<void> => {
  const rounded = Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [
      id,
      { x: Math.round(point.x), y: Math.round(point.y) },
    ]),
  )
  await api.POST('/visualplan/layout', { body: { route, positions: rounded } })
}
