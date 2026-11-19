//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faArrowUpWideShort,
  faBullhorn,
  faCircleNodes,
  faClock,
  faDatabase,
  faDoorOpen,
  faHashtag,
  faIdCard,
  faListCheck,
  faListOl,
  faPeopleGroup,
  faPhoneSlash,
  faPhoneVolume,
  faToggleOn,
  faUser,
  faUsers,
  faUsersRays,
  faVoicemail,
} from '@fortawesome/free-solid-svg-icons'
import type { NodeType } from '@/lib/visualplan/model'

export type NodeMeta = { icon: IconDefinition; tone: string }

export const NODE_META: Record<NodeType, NodeMeta> = {
  inboundRoute: {
    icon: faPhoneVolume,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700 dark:text-emerald-50',
  },
  extension: { icon: faUser, tone: 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-50' },
  voicemail: {
    icon: faVoicemail,
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700 dark:text-sky-50',
  },
  conference: {
    icon: faPeopleGroup,
    tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-700 dark:text-indigo-50',
  },
  hangup: {
    icon: faPhoneSlash,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-700 dark:text-rose-50',
  },
  ringGroup: {
    icon: faUsersRays,
    tone: 'bg-teal-100 text-teal-700 dark:bg-teal-700 dark:text-teal-50',
  },
  queue: { icon: faUsers, tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-700 dark:text-cyan-50' },
  ivr: {
    icon: faListOl,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-700 dark:text-violet-50',
  },
  cqr: {
    icon: faDatabase,
    tone: 'bg-purple-100 text-purple-700 dark:bg-purple-700 dark:text-purple-50',
  },
  announcement: {
    icon: faBullhorn,
    tone: 'bg-orange-100 text-orange-700 dark:bg-orange-700 dark:text-orange-50',
  },
  timeCondition: {
    icon: faClock,
    tone: 'bg-pink-100 text-pink-700 dark:bg-pink-700 dark:text-pink-50',
  },
  callFlowControl: {
    icon: faToggleOn,
    tone: 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-50',
  },
  setCallerId: {
    icon: faIdCard,
    tone: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-50',
  },
  directDid: {
    icon: faHashtag,
    tone: 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-50',
  },
  queueExit: {
    icon: faDoorOpen,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-700 dark:text-cyan-50',
  },
  queueOptions: {
    icon: faListCheck,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-700 dark:text-cyan-50',
  },
  queuePriority: {
    icon: faArrowUpWideShort,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-700 dark:text-cyan-50',
  },
  other: {
    icon: faCircleNodes,
    tone: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-50',
  },
}

export const PALETTE_GROUPS: { labelKey: string; types: NodeType[] }[] = [
  {
    labelKey: 'visual_plan.palette.group_routing',
    types: ['ivr', 'timeCondition', 'callFlowControl', 'cqr', 'announcement'],
  },
  {
    labelKey: 'visual_plan.palette.group_answer',
    types: ['ringGroup', 'queue', 'extension', 'voicemail', 'conference', 'hangup'],
  },
  {
    labelKey: 'visual_plan.palette.group_advanced',
    types: ['setCallerId', 'directDid', 'queueExit', 'queueOptions', 'queuePriority'],
  },
]

export type PaletteItem = { kind: 'new'; type: NodeType } | { kind: 'existing'; id: string }

export const PALETTE_MIME = 'application/x-nethvoice-visual-plan'

export const FORM_FIELDS = new Set([
  'agentTimeout',
  'alertInfo',
  'alertinfo',
  'announceFrequency',
  'announcement',
  'breakoutIvr',
  'cidName',
  'cidNum',
  'cidPrefix',
  'cidnum',
  'description',
  'directDial',
  'dynamicMembers',
  'extension',
  'failoverEnabled',
  'grppre',
  'id',
  'joinAnnouncement',
  'maxWait',
  'maxWaitEnabled',
  'members',
  'mode',
  'musicOnHold',
  'name',
  'position',
  'positionAnnouncement',
  'positionEnabled',
  'prefix',
  'priority',
  'recording',
  'ringTime',
  'ringing',
  'root',
  'staticMembers',
  'strategy',
  'timeGroup',
  'timeout',
  'variant',
  'varlength',
])
