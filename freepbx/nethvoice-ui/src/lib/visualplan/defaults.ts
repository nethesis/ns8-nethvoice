//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { VisualPlanData } from '@/lib/visualplan/api'
import { newEntryId, type NodeDataByType, type NodeType } from '@/lib/visualplan/model'

export const RING_STRATEGIES = [
  'ringall',
  'ringall-prim',
  'hunt',
  'hunt-prim',
  'memoryhunt',
  'memoryhunt-prim',
  'firstavailable',
  'firstnotonphone',
  'random',
] as const

export const QUEUE_STRATEGIES = [
  'ringall',
  'leastrecent',
  'fewestcalls',
  'random',
  'rrmemory',
  'rrordered',
  'linear',
  'wrandom',
] as const

export const usedNumbers = (data: VisualPlanData): Set<string> =>
  new Set([
    ...data.extensions.map((item) => item.extension),
    ...data.ringGroups.map((item) => item.id),
    ...data.queues.map((item) => item.id),
    ...data.conferences.map((item) => item.id),
  ])

export const suggestNumber = (used: Set<string>, start: number): string => {
  let candidate = start
  while (used.has(String(candidate))) {
    candidate += 1
  }
  return String(candidate)
}

export type DefaultsContext = { data: VisualPlanData; reserved: Set<string> }

export const defaultNodeData = <T extends NodeType>(
  type: T,
  ctx: DefaultsContext,
): NodeDataByType[T] | null => {
  const used = new Set([...usedNumbers(ctx.data), ...ctx.reserved])
  const defaults: { [K in NodeType]?: () => NodeDataByType[K] } = {
    ringGroup: () => ({
      id: suggestNumber(used, 600),
      description: '',
      members: [],
      strategy: 'ringall',
      ringTime: 20,
    }),
    queue: () => ({
      id: suggestNumber(used, 400),
      name: '',
      staticMembers: [],
      dynamicMembers: [],
      strategy: 'ringall',
      agentTimeout: 15,
      maxWait: 0,
      ringing: 'moh',
      cidPrefix: '',
      joinAnnouncement: null,
      positionAnnouncement: false,
      announceFrequency: 0,
      breakoutIvr: null,
      musicOnHold: 'inherit',
    }),
    conference: () => ({ id: suggestNumber(used, 800), name: '' }),
    ivr: () => ({
      id: null,
      name: '',
      description: '',
      announcement: null,
      directDial: false,
      entries: [{ id: newEntryId(), value: '1' }],
    }),
    cqr: () => ({ id: null, name: '', description: '', announcement: null, entries: [] }),
    announcement: () => ({ id: null, description: '', recording: null }),
    timeCondition: () => ({ id: null, name: '', timeGroup: null, timeGroupRef: null }),
    callFlowControl: () => ({
      id: ctx.data.availableCallFlowCodes.find((code) => !ctx.reserved.has(`cf:${code}`)) ?? '',
      name: '',
      state: 'DAY',
    }),
    extension: () => ({ extension: '', name: '', voicemail: false }),
    voicemail: () => ({ extension: '', mode: 'vmu' }),
    hangup: () => ({ variant: 'hangup' }),
    setCallerId: () => ({
      id: null,
      description: '',
      cidName: '${CALLERID(name)}',
      cidNum: '${CALLERID(num)}',
    }),
    directDid: () => ({ id: null, prefix: '', root: '', varlength: 2, timeout: 15 }),
    queueExit: () => ({ id: null, name: '' }),
    queueOptions: () => ({
      id: null,
      name: '',
      cidPrefix: '',
      alertInfo: '',
      joinAnnouncement: null,
      musicOnHold: '',
      positionEnabled: false,
      position: 2,
      maxWaitEnabled: false,
      maxWait: 300,
      failoverEnabled: false,
    }),
    queuePriority: () => ({ id: null, description: '', priority: 0 }),
  }
  const factory = defaults[type]
  return factory ? (factory() as NodeDataByType[T]) : null
}
