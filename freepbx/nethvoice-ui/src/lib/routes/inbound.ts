//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { compareNatural, matchesText } from '@/lib/common'
import { VISUAL_PLAN_URL } from '@/lib/config'

export const INBOUND_ROUTES_KEY = 'inboundRoutes'

export const INBOUND_ROUTE_SORT_KEYS = ['number', 'description', 'destination'] as const

export type InboundRouteSortKey = (typeof INBOUND_ROUTE_SORT_KEYS)[number]

export const DESTINATION_KINDS = [
  'announcement',
  'call_flow',
  'conference',
  'cqr',
  'custom_context',
  'extension',
  'feature_code',
  'inbound_route',
  'ivr',
  'language',
  'misc_destination',
  'queue',
  'ring_group',
  'terminate_call',
  'time_condition',
  'trunk',
  'voice_agent',
  'voicemail',
  'voicemail_busy',
  'voicemail_instructions',
  'voicemail_no_message',
  'voicemail_unavailable',
] as const

export type DestinationKind = (typeof DESTINATION_KINDS)[number]

const DESTINATION_KIND_BY_CONTEXT: [RegExp, DestinationKind][] = [
  [/^ext-queues$/, 'queue'],
  [/^ext-group$/, 'ring_group'],
  [/^from-did-direct$/, 'extension'],
  [/^ext-local$/, 'voicemail'],
  [/^ext-meetme$/, 'conference'],
  [/^ivr-\d+$/, 'ivr'],
  [/^app-announcement-\d+$/, 'announcement'],
  [/^timeconditions$/, 'time_condition'],
  [/^app-daynight$/, 'call_flow'],
  [/^app-blackhole$/, 'terminate_call'],
  [/^ext-trunk$/, 'trunk'],
  [/^from-trunk$/, 'inbound_route'],
  [/^nethcqr$/, 'cqr'],
  [/^ext-miscdests$/, 'misc_destination'],
  [/^ext-featurecodes$/, 'feature_code'],
  [/^voice-agent-/, 'voice_agent'],
  [/^app-languages$/, 'language'],
]

const VOICEMAIL_KIND_BY_PREFIX: Record<string, DestinationKind> = {
  vmb: 'voicemail_busy',
  vmu: 'voicemail_unavailable',
  vms: 'voicemail_no_message',
  vmi: 'voicemail_instructions',
}

const DESTINATION_KIND_BY_CATEGORY: Record<string, DestinationKind> = {
  'Custom Contexts': 'custom_context',
}

const VOICEMAIL_DESCRIPTION = /^<([^>]+)>\s*(.*?)\s*\([^)]*\)$/

const nullableText = v.pipe(
  v.nullish(v.union([v.string(), v.number()]), ''),
  v.transform((value) => String(value).trim()),
)

const DestinationSchema = v.object({
  description: nullableText,
  category: nullableText,
  name: nullableText,
})

const DestinationsSchema = v.union([
  v.record(v.string(), DestinationSchema),
  v.pipe(
    v.array(v.unknown()),
    v.transform((): Record<string, v.InferOutput<typeof DestinationSchema>> => ({})),
  ),
])

const RouteSchema = v.object({
  extension: nullableText,
  cidnum: nullableText,
  description: nullableText,
  destination: nullableText,
})

const InboundRoutesResponseSchema = v.object({
  destinations: DestinationsSchema,
  routes: v.array(RouteSchema),
})

export type RouteDestination = {
  target: string
  kind: DestinationKind | null
  category: string
  description: string
}

export type InboundRoute = {
  id: string
  number: string
  cid: string
  description: string
  destination: RouteDestination
}

export type InboundRouteDeleteResult = 'deleted' | 'not_found'

export const getInboundRouteName = (
  route: Pick<InboundRoute, 'number' | 'cid'>,
  anyDid = '',
): string => {
  const number = route.number || anyDid

  if (!route.cid) {
    return number
  }
  return number ? `${number} / ${route.cid}` : route.cid
}

export const getDestinationKind = (target: string): DestinationKind | null => {
  const [context, targetId = ''] = target.split(',')

  if (context === 'ext-local') {
    const voicemailKind = VOICEMAIL_KIND_BY_PREFIX[targetId.slice(0, 3)]

    if (voicemailKind && /^\d+$/.test(targetId.slice(3))) {
      return voicemailKind
    }
  }
  return DESTINATION_KIND_BY_CONTEXT.find(([pattern]) => pattern.test(context))?.[1] ?? null
}

const describeTarget = (target: string, description: string): string => {
  const targetId = target.split(',')[1] ?? ''
  const numbered = /^(\d+)\s+(.+)$/.exec(description)

  if (numbered && numbered[1] === targetId) {
    return `${numbered[2]} (${numbered[1]})`
  }
  const voicemail = VOICEMAIL_DESCRIPTION.exec(description)

  if (voicemail && targetId.endsWith(voicemail[1])) {
    return voicemail[2] ? `${voicemail[2]} (${voicemail[1]})` : voicemail[1]
  }
  return description.replace(/^Agent:\s*/, '')
}

export const isInvalidDestination = (destination: RouteDestination): boolean =>
  Boolean(destination.target) &&
  !destination.kind &&
  !destination.category &&
  destination.description === destination.target

export const describeInboundDestination = (
  destination: RouteDestination,
  describeKind: (kind: DestinationKind) => string,
): string => {
  if (!destination.description) {
    return ''
  }
  const prefix = destination.kind ? describeKind(destination.kind) : destination.category

  return prefix ? `${prefix}: ${destination.description}` : destination.description
}

export const parseInboundRoutes = (raw: unknown): InboundRoute[] => {
  const { destinations, routes } = v.parse(InboundRoutesResponseSchema, raw)

  return routes.map((route) => {
    const known = route.destination ? destinations[route.destination] : undefined
    const kind = known
      ? (getDestinationKind(route.destination) ??
        DESTINATION_KIND_BY_CATEGORY[known.category || known.name] ??
        null)
      : null

    return {
      id: `${route.extension}/${route.cidnum}`,
      number: route.extension,
      cid: route.cidnum,
      description: route.description,
      destination: {
        target: route.destination,
        kind,
        category: known ? known.category || known.name : '',
        description: known
          ? describeTarget(route.destination, known.description)
          : route.destination,
      },
    }
  })
}

export const getInboundRoutes = async (): Promise<InboundRoute[]> => {
  const { data } = await api.GET('/inboundroutes')
  return parseInboundRoutes(data)
}

export const deleteInboundRoute = async (
  route: InboundRoute,
): Promise<InboundRouteDeleteResult> => {
  try {
    await api.POST('/inboundroutes/delete', {
      body: { extension: route.number, cid: route.cid },
    })
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return 'not_found'
    }
    throw error
  }
  return 'deleted'
}

export const filterInboundRoutes = (
  routes: InboundRoute[],
  textFilter: string,
  describeDestination: (destination: RouteDestination) => string,
): InboundRoute[] =>
  routes.filter((route) =>
    matchesText(
      textFilter,
      route.number,
      route.cid,
      route.description,
      describeDestination(route.destination),
    ),
  )

export const sortInboundRoutes = (
  routes: InboundRoute[],
  sortKey: InboundRouteSortKey,
  descending: boolean,
  describeDestination: (destination: RouteDestination) => string,
): InboundRoute[] => {
  const valueOf = (route: InboundRoute) => {
    if (sortKey === 'description') {
      return route.description
    }
    return sortKey === 'destination'
      ? describeDestination(route.destination)
      : getInboundRouteName(route)
  }
  const sorted = [...routes].sort(
    (a, b) => compareNatural(valueOf(a), valueOf(b)) || compareNatural(a.id, b.id),
  )

  return descending ? sorted.reverse() : sorted
}

export const getVisualPlanRouteUrl = (route?: Pick<InboundRoute, 'number' | 'cid'>): string => {
  const did = route ? `${route.number} / ${route.cid}` : 'new_route'
  return `${VISUAL_PLAN_URL}/?did=${encodeURIComponent(did)}`
}
