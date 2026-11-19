//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { TimeGroupData } from '@/lib/visualplan/api'
import type { FlowState } from '@/lib/visualplan/graph'
import { entryOutputId, type FlowNode } from '@/lib/visualplan/model'
import { ALWAYS_SPEC, MONTHS, parseTimeRule, WEEKDAYS } from '@/lib/visualplan/timeGroups'

export const SIMULATION_STEP_LIMIT = 50

export type CallFlowState = 'DAY' | 'NIGHT'

export type MenuChoice =
  { kind: 'entry'; entryId: string } | { kind: 'timeout' } | { kind: 'invalid' }

export type SimulationOptions = {
  date: Date
  timeGroups: { ref: string; data: TimeGroupData }[]
  callFlowStates: Record<string, CallFlowState>
  menuChoices: Record<string, MenuChoice>
  answered: Record<string, boolean>
}

export type StepReason =
  | 'start'
  | 'next'
  | 'time_matches'
  | 'time_does_not_match'
  | 'no_time_group'
  | 'normal_mode'
  | 'override_mode'
  | 'menu_choice'
  | 'menu_timeout'
  | 'menu_invalid'
  | 'cqr_no_match'
  | 'answered'
  | 'not_answered'
  | 'ends_call'

export type SimulationStep = { nodeId: string; output: string | null; reason: StepReason }

export type SimulationEnd =
  'answered' | 'ended' | 'not_connected' | 'loop' | 'menu_repeats' | 'too_long'

export type SimulationResult = { steps: SimulationStep[]; end: SimulationEnd }

const toMinutes = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const inRange = (value: number, start: number, end: number): boolean =>
  start <= end ? value >= start && value <= end : value >= start || value <= end

const INVALID = 'invalid'

const rangeOf = (
  start: string,
  end: string,
  parse: (value: string) => number | null,
): [number, number] | null | typeof INVALID => {
  if (!start) {
    return end ? INVALID : null
  }
  const from = parse(start)
  const to = parse(end || start)
  return from === null || to === null ? INVALID : [from, to]
}

const indexIn =
  (names: readonly string[]) =>
  (value: string): number | null => {
    const index = names.indexOf(value.toLowerCase())
    return index < 0 ? null : index
  }

const dayOfMonth = (value: string): number | null =>
  /^\d{1,2}$/.test(value) ? Number(value) : null

export const matchesTimeSpec = (spec: string, date: Date): boolean => {
  const rule = parseTimeRule(spec)
  const checks: [[number, number] | null | typeof INVALID, number][] = [
    [rangeOf(rule.startTime, rule.endTime, toMinutes), date.getHours() * 60 + date.getMinutes()],
    [rangeOf(rule.startDay, rule.endDay, indexIn(WEEKDAYS)), (date.getDay() + 6) % 7],
    [rangeOf(rule.startDate, rule.endDate, dayOfMonth), date.getDate()],
    [rangeOf(rule.startMonth, rule.endMonth, indexIn(MONTHS)), date.getMonth()],
  ]
  return checks.every(
    ([range, value]) => range === null || (range !== INVALID && inRange(value, range[0], range[1])),
  )
}

export const matchesTimeGroup = (group: TimeGroupData, date: Date): boolean =>
  group.times.some(
    (spec) => spec.trim().toLowerCase() !== ALWAYS_SPEC && matchesTimeSpec(spec, date),
  )

const targetOf = (state: FlowState, source: string, output: string): string | null =>
  state.edges.find((edge) => edge.source === source && edge.output === output)?.target ?? null

type Decision = { output: string | null; reason: StepReason; end?: SimulationEnd }

const decide = (node: FlowNode, options: SimulationOptions): Decision => {
  switch (node.type) {
    case 'inboundRoute':
      return { output: 'destination', reason: 'start' }
    case 'timeCondition': {
      const ref =
        node.data.timeGroupRef ??
        (node.data.timeGroup === null ? null : String(node.data.timeGroup))
      const group = options.timeGroups.find((item) => item.ref === ref)
      if (!group) {
        return { output: 'falseDestination', reason: 'no_time_group' }
      }
      return matchesTimeGroup(group.data, options.date)
        ? { output: 'trueDestination', reason: 'time_matches' }
        : { output: 'falseDestination', reason: 'time_does_not_match' }
    }
    case 'callFlowControl':
      return (options.callFlowStates[node.id] ?? node.data.state) === 'NIGHT'
        ? { output: 'overrideDestination', reason: 'override_mode' }
        : { output: 'normalDestination', reason: 'normal_mode' }
    case 'ivr': {
      const first = node.data.entries[0]
      const choice: MenuChoice =
        options.menuChoices[node.id] ??
        (first ? { kind: 'entry', entryId: first.id } : { kind: 'timeout' })
      if (choice.kind === 'entry') {
        const entry = node.data.entries.find((item) => item.id === choice.entryId)
        if (entry) {
          return { output: entryOutputId(entry), reason: 'menu_choice' }
        }
      }
      return choice.kind === 'invalid'
        ? { output: 'invalidDestination', reason: 'menu_invalid' }
        : { output: 'timeoutDestination', reason: 'menu_timeout' }
    }
    case 'cqr': {
      const choice = options.menuChoices[node.id]
      const entry =
        choice?.kind === 'entry'
          ? node.data.entries.find((item) => item.id === choice.entryId)
          : undefined
      return entry
        ? { output: entryOutputId(entry), reason: 'menu_choice' }
        : { output: 'defaultDestination', reason: 'cqr_no_match' }
    }
    case 'ringGroup':
    case 'queue':
      return (options.answered[node.id] ?? true)
        ? { output: null, reason: 'answered', end: 'answered' }
        : { output: 'destination', reason: 'not_answered' }
    case 'queueOptions':
    case 'announcement':
    case 'setCallerId':
    case 'queuePriority':
      return { output: 'destination', reason: 'next' }
    case 'extension':
      return { output: null, reason: 'answered', end: 'answered' }
    default:
      return { output: null, reason: 'ends_call', end: 'ended' }
  }
}

export const simulateCall = (state: FlowState, options: SimulationOptions): SimulationResult => {
  const steps: SimulationStep[] = []
  const visited = new Set<string>()
  let current: string | null = state.rootId

  while (current) {
    const node: FlowNode | undefined = state.nodes[current]
    if (!node) {
      return { steps, end: 'not_connected' }
    }
    if (visited.has(node.id)) {
      return { steps, end: node.type === 'ivr' ? 'menu_repeats' : 'loop' }
    }
    if (steps.length >= SIMULATION_STEP_LIMIT) {
      return { steps, end: 'too_long' }
    }
    visited.add(node.id)

    const decision = decide(node, options)
    steps.push({ nodeId: node.id, output: decision.output, reason: decision.reason })

    if (decision.end) {
      return { steps, end: decision.end }
    }
    current = decision.output ? targetOf(state, node.id, decision.output) : null
    if (!current) {
      return { steps, end: 'not_connected' }
    }
  }
  return { steps, end: 'not_connected' }
}
