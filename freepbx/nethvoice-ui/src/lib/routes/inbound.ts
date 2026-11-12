//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
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
  'extension',
  'feature_code',
  'inbound_route',
  'ivr',
  'misc_destination',
  'queue',
  'ring_group',
  'terminate_call',
  'time_condition',
  'trunk',
  'voice_agent',
  'voicemail',
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
]

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

export const getInboundRouteName = (route: Pick<InboundRoute, 'number' | 'cid'>): string =>
  route.cid ? `${route.number} / ${route.cid}` : route.number

export const getDestinationKind = (target: string): DestinationKind | null => {
  const [context] = target.split(',')

  return DESTINATION_KIND_BY_CONTEXT.find(([pattern]) => pattern.test(context))?.[1] ?? null
}

const describeTarget = (target: string, description: string): string => {
  const targetId = target.split(',')[1] ?? ''
  const numbered = /^(\d+)\s+(.+)$/.exec(description)

  if (numbered && numbered[1] === targetId) {
    return `${numbered[2]} (${numbered[1]})`
  }
  return description.replace(/^Agent:\s*/, '')
}

export const parseInboundRoutes = (raw: unknown): InboundRoute[] => {
  const { destinations, routes } = v.parse(InboundRoutesResponseSchema, raw)

  return routes.map((route) => {
    const known = route.destination ? destinations[route.destination] : undefined
    const kind = getDestinationKind(route.destination)

    return {
      id: `${route.extension}/${route.cidnum}`,
      number: route.extension,
      cid: route.cidnum,
      description: route.description,
      destination: {
        target: route.destination,
        kind: known ? kind : null,
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

export const deleteInboundRoute = async (route: InboundRoute): Promise<void> => {
  await api.POST('/inboundroutes/delete', {
    body: { extension: route.number, cid: route.cid },
  })
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
