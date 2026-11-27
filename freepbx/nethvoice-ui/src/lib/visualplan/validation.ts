//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { VisualPlanData } from '@/lib/visualplan/api'
import {
  indexEdges,
  outgoingDestinations,
  reachableIds,
  type FlowState,
} from '@/lib/visualplan/graph'
import { usedNumbers } from '@/lib/visualplan/defaults'
import {
  getOutputs,
  inboundRouteKey,
  NEW_REF_PREFIX,
  type FlowNode,
  type NodeType,
  type OutputDef,
} from '@/lib/visualplan/model'

export type IssueLevel = 'error' | 'warning'

export type Issue = {
  level: IssueLevel
  code: string
  field?: string
  output?: string
  params?: Record<string, number>
}

export type Issues = Record<string, Issue[]>

const DIGITS = /^\d+$/
const DID_PATTERN = /^[0-9A-Za-z+*#_.[\]-]*$/
const MENU_SELECTION = /^[0-9*#]{1,30}$/
const UNSAFE_TEXT = /[\u0000-\u001f\u007f]|\$[{[]/
const CALLER_ID_TOKENS = /\$\{CALLERID\((name|num)\)\}/g
const CALLER_ID_UNSAFE = /[\u0000-\u001f\u007f$[\];]/
const RING_MEMBER = /^[0-9*#+]{1,20}$/
const QUEUE_MEMBER = /^[0-9*#]{1,20}$/

export const TEXT_LIMITS: Partial<Record<NodeType, Record<string, number>>> = {
  inboundRoute: { extension: 50, cidnum: 50, description: 100, alertinfo: 255, grppre: 80 },
  conference: { name: 50 },
  ringGroup: { description: 35 },
  queue: { name: 35, cidPrefix: 100 },
  ivr: { name: 50, description: 150 },
  cqr: { name: 60, description: 120 },
  announcement: { description: 50 },
  timeCondition: { name: 50 },
  callFlowControl: { name: 190 },
  setCallerId: { description: 50, cidName: 150, cidNum: 150 },
  directDid: { prefix: 3, root: 20 },
  queueExit: { name: 50 },
  queueOptions: { name: 100, cidPrefix: 100, alertInfo: 100 },
  queuePriority: { description: 50 },
}

const DESTINATION_LIMITS: Partial<Record<NodeType, Record<string, number>>> = {
  inboundRoute: { destination: 60 },
  queue: { destination: 50 },
  ivr: { invalidDestination: 50, timeoutDestination: 50, entry: 50 },
  cqr: { defaultDestination: 50, entry: 50 },
  timeCondition: { trueDestination: 50, falseDestination: 50 },
  directDid: { timeoutDestination: 80, busyDestination: 80, unavailableDestination: 80 },
  queueExit: { any: 80 },
  queueOptions: { destination: 80, failoverDestination: 80 },
  callFlowControl: { normalDestination: 190, overrideDestination: 190 },
}

const ERROR_OUTPUT_TYPES: NodeType[] = ['inboundRoute', 'queuePriority']

// Exits without a destination: an error where the call has nowhere to go, otherwise a warning
// that says what happens to the calls. Queues and queue exits accept free exits.
const missingDestination = (node: FlowNode, output: OutputDef): Issue | null => {
  if (
    ERROR_OUTPUT_TYPES.includes(node.type) ||
    output.id.startsWith('entry:') ||
    (node.type === 'timeCondition' && output.id === 'trueDestination')
  ) {
    return { level: 'error', code: 'destination_required', output: output.id }
  }
  if (node.type === 'queue' || node.type === 'queueExit') return null
  if (node.type === 'queueOptions' && output.id === 'failoverDestination') return null
  const code =
    node.type === 'announcement'
      ? 'no_destination_after_recording'
      : node.type === 'ringGroup'
        ? 'no_destination_unanswered'
        : 'no_destination'
  return { level: 'warning', code, output: output.id }
}

const error = (code: string, field?: string): Issue => ({ level: 'error', code, field })

const required = (value: string, field: string, code = 'required'): Issue[] =>
  value.trim() ? [] : [error(code, field)]

const named = (value: string, field: string): Issue[] => required(value, field, 'name_required')

const between = (value: number, min: number, max: number, field: string): Issue[] =>
  Number.isInteger(value) && value >= min && value <= max
    ? []
    : [{ level: 'error', code: 'out_of_range', field, params: { min, max } }]

const textIssues = (node: FlowNode): Issue[] => {
  const limits = TEXT_LIMITS[node.type] ?? {}
  const data: Record<string, unknown> = node.data
  const issues: Issue[] = []

  for (const [field, max] of Object.entries(limits)) {
    const value = data[field]
    if (typeof value !== 'string') continue
    if (node.type === 'setCallerId' && (field === 'cidName' || field === 'cidNum')) {
      if (CALLER_ID_UNSAFE.test(value.replace(CALLER_ID_TOKENS, ''))) {
        issues.push(error('unsafe_caller_id', field))
        continue
      }
    } else if (UNSAFE_TEXT.test(value)) {
      issues.push(error('unsafe_text', field))
      continue
    }
    if ([...value].length > max) {
      issues.push({ level: 'error', code: 'too_long', field, params: { max } })
    }
  }
  return issues
}

const memberIssues = (values: string[], pattern: RegExp, field: string): Issue[] => {
  if (values.some((value) => !pattern.test(value))) return [error('invalid_members', field)]
  return new Set(values).size === values.length ? [] : [error('duplicate_members', field)]
}

const duplicates = (values: string[]): Set<number> => {
  const seen = new Map<string, number>()
  const result = new Set<number>()

  values.forEach((value, index) => {
    const key = value.trim()
    const first = seen.get(key)
    if (first !== undefined) {
      result.add(first)
      result.add(index)
    } else {
      seen.set(key, index)
    }
  })
  return result
}

type Context = {
  data: VisualPlanData
  state: FlowState
  used: Set<string>
  newNumbers: Map<string, number>
  newCodes: Map<string, number>
  originalRouteKey: string | null
}

const numberIssues = (ctx: Context, node: FlowNode, id: string): Issue[] => {
  if (!node.isNew) {
    return []
  }
  if (!DIGITS.test(id)) {
    return [error(id ? 'number_digits' : 'number_required', 'id')]
  }
  if (ctx.used.has(id) || (ctx.newNumbers.get(id) ?? 0) > 1) {
    return [error('number_in_use', 'id')]
  }
  return []
}

const fieldIssues = (ctx: Context, node: FlowNode): Issue[] => {
  switch (node.type) {
    case 'inboundRoute': {
      const issues: Issue[] = []
      const name = node.data.description.trim().toLowerCase()
      if (!name) {
        issues.push(error('name_required', 'description'))
      } else if (
        ctx.data.inboundRoutes.some(
          (route) =>
            inboundRouteKey(route) !== ctx.originalRouteKey &&
            route.description.trim().toLowerCase() === name,
        )
      ) {
        issues.push(error('route_name_exists', 'description'))
      }
      if (!DID_PATTERN.test(node.data.extension) || node.data.extension.length > 50) {
        issues.push(error('did_invalid', 'extension'))
      }
      if (node.data.description.length > 100) issues.push(error('too_long', 'description'))
      if (!DID_PATTERN.test(node.data.cidnum)) issues.push(error('invalid', 'cidnum'))
      const key = inboundRouteKey(node.data)
      if (
        key !== ctx.originalRouteKey &&
        ctx.data.inboundRoutes.some((route) => inboundRouteKey(route) === key)
      ) {
        issues.push(error('route_exists', 'extension'))
      }
      return issues
    }
    case 'conference':
      return [...numberIssues(ctx, node, node.data.id), ...named(node.data.name, 'name')]
    case 'ringGroup':
      return [
        ...numberIssues(ctx, node, node.data.id),
        ...named(node.data.description, 'description'),
        ...(node.data.members.length
          ? memberIssues(node.data.members, RING_MEMBER, 'members')
          : [error('members_required', 'members')]),
        ...between(node.data.ringTime, 1, 300, 'ringTime'),
      ]
    case 'queue':
      return [
        ...numberIssues(ctx, node, node.data.id),
        ...named(node.data.name, 'name'),
        ...memberIssues(
          node.data.staticMembers.map((member) => member.extension),
          QUEUE_MEMBER,
          'staticMembers',
        ),
        ...(node.data.staticMembers.some(
          (member) =>
            !Number.isInteger(member.penalty) || member.penalty < 0 || member.penalty > 99,
        )
          ? [error('invalid_penalty', 'staticMembers')]
          : []),
        ...memberIssues(node.data.dynamicMembers, QUEUE_MEMBER, 'dynamicMembers'),
        ...between(node.data.agentTimeout, 0, 600, 'agentTimeout'),
        ...between(node.data.maxWait, 0, 86400, 'maxWait'),
        ...(node.data.positionAnnouncement
          ? between(node.data.announceFrequency, 0, 3600, 'announceFrequency')
          : []),
      ]
    case 'ivr':
    case 'cqr': {
      const issues = named(node.data.name, 'name')
      const dup = duplicates(node.data.entries.map((entry) => entry.value))
      node.data.entries.forEach((entry, index) => {
        const field = `entry:${entry.id}`
        if (!entry.value.trim()) {
          issues.push(error(node.type === 'ivr' ? 'digit_required' : 'required', field))
        } else if (node.type === 'ivr' && !MENU_SELECTION.test(entry.value.trim())) {
          issues.push(error('invalid_selection', field))
        } else if (dup.has(index)) {
          issues.push(error(node.type === 'ivr' ? 'digit_in_use' : 'duplicate', field))
        }
      })
      return issues
    }
    case 'announcement':
      return [
        ...named(node.data.description, 'description'),
        ...(node.data.recording === null ? [error('recording_required', 'recording')] : []),
      ]
    case 'timeCondition':
      return [
        ...named(node.data.name, 'name'),
        ...(node.data.timeGroup === null && !node.data.timeGroupRef
          ? [error('time_group_required', 'timeGroup')]
          : []),
      ]
    case 'callFlowControl': {
      const issues = named(node.data.name, 'name')
      if (node.isNew) {
        if (!ctx.data.availableCallFlowCodes.includes(node.data.id)) {
          issues.push(error(node.data.id ? 'number_in_use' : 'required', 'id'))
        } else if ((ctx.newCodes.get(node.data.id) ?? 0) > 1) {
          issues.push(error('number_in_use', 'id'))
        }
      }
      return issues
    }
    case 'extension':
    case 'voicemail':
      return ctx.data.extensions.some((item) => item.extension === node.data.extension)
        ? []
        : [
            error(
              node.data.extension
                ? 'not_found'
                : node.type === 'voicemail'
                  ? 'mailbox_required'
                  : 'extension_required',
              'extension',
            ),
          ]
    case 'setCallerId':
      return named(node.data.description, 'description')
    case 'directDid':
      return [
        ...(/^\d{0,3}$/.test(node.data.prefix) ? [] : [error('invalid', 'prefix')]),
        ...(node.data.root
          ? /^\d+$/.test(node.data.root)
            ? []
            : [error('invalid', 'root')]
          : [error('required', 'root')]),
        ...between(node.data.varlength, 1, 9, 'varlength'),
        ...between(node.data.timeout, 1, 600, 'timeout'),
      ]
    case 'queueExit':
      return named(node.data.name, 'name')
    case 'queueOptions':
      return [
        ...named(node.data.name, 'name'),
        ...(node.data.positionEnabled ? between(node.data.position, 1, 1000, 'position') : []),
        ...(node.data.maxWaitEnabled ? between(node.data.maxWait, 0, 86400, 'maxWait') : []),
      ]
    case 'queuePriority':
      return [
        ...named(node.data.description, 'description'),
        ...between(node.data.priority, 0, 20, 'priority'),
      ]
    case 'other':
      return ctx.data.destinations.some((item) => item.destination === node.data.destination)
        ? []
        : [{ level: 'warning', code: 'unknown_destination' }]
    default:
      return []
  }
}

const countBy = (values: string[]): Map<string, number> => {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return counts
}

const destinationLimit = (node: FlowNode, output: string): number => {
  const limits = DESTINATION_LIMITS[node.type]
  if (!limits) return 255
  return limits[output] ?? limits[output.startsWith('entry:') ? 'entry' : ''] ?? limits.any ?? 255
}

export const validateFlow = (
  state: FlowState,
  data: VisualPlanData,
  originalRouteKey: string | null,
  dirtyIds: Set<string> = new Set(),
): Issues => {
  const nodes = Object.values(state.nodes)
  const newNodes = nodes.filter((node) => node.isNew)
  const ctx: Context = {
    data,
    state,
    used: usedNumbers(data),
    newNumbers: countBy(
      newNodes.flatMap((node) =>
        node.type === 'conference' || node.type === 'ringGroup' || node.type === 'queue'
          ? [node.data.id]
          : [],
      ),
    ),
    newCodes: countBy(
      newNodes.flatMap((node) => (node.type === 'callFlowControl' ? [node.data.id] : [])),
    ),
    originalRouteKey,
  }
  const reachable = reachableIds(state)
  const index = indexEdges(state)
  const issues: Issues = {}

  for (const node of nodes) {
    const list = [...fieldIssues(ctx, node), ...textIssues(node)]
    const destinations = outgoingDestinations(state, node, index)

    for (const output of getOutputs(node)) {
      const destination = destinations[output.id] ?? ''
      if (!destination) {
        const issue = missingDestination(node, output)
        if (issue) list.push(issue)
      } else if (
        destination &&
        !destination.startsWith(NEW_REF_PREFIX) &&
        destination.length > destinationLimit(node, output.id)
      ) {
        list.push({ level: 'error', code: 'destination_too_long', output: output.id })
      }
    }
    if (node.type === 'inboundRoute' && !node.data.extension && !node.data.cidnum) {
      list.push({ level: 'warning', code: 'catch_all' })
    }
    if (!reachable.has(node.id)) {
      list.push({ level: 'warning', code: node.isNew ? 'not_in_flow_new' : 'not_in_flow' })
    }
    const untouched =
      (!node.isNew && !dirtyIds.has(node.id)) || (node.isNew && !reachable.has(node.id))
    const final = untouched
      ? list.map((issue) =>
          issue.level === 'error' ? { ...issue, level: 'warning' as const } : issue,
        )
      : list
    if (final.length) {
      issues[node.id] = final
    }
  }
  return issues
}

export const hasErrors = (issues: Issues): boolean =>
  Object.values(issues).some((list) => list.some((issue) => issue.level === 'error'))

export const fieldError = (issues: Issue[] | undefined, field: string): string | undefined =>
  issues?.find((issue) => issue.level === 'error' && issue.field === field)?.code
