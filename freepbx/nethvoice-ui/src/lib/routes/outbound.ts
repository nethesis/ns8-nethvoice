//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import * as v from 'valibot'
import { api } from '@/lib/api/client'
import { compareNatural, matchesText } from '@/lib/common'
import { OUTBOUND_ROUTE_ADVANCED_URL } from '@/lib/config'

export const OUTBOUND_ROUTES_KEY = 'outboundRoutes'
export const OUTBOUND_ROUTE_DEFAULTS_KEY = 'outboundRouteDefaults'

export const OUTBOUND_ROUTE_KINDS = ['national', 'cellphone', 'international', 'toll'] as const

export type OutboundRouteKind = (typeof OUTBOUND_ROUTE_KINDS)[number]

export const OUTBOUND_ROUTE_SORT_KEYS = ['position', 'name'] as const

export type OutboundRouteSortKey = (typeof OUTBOUND_ROUTE_SORT_KEYS)[number]

const FALLBACK_LOCALE = 'en'

const DEFAULT_ROUTE_NAME = new RegExp(`^(${OUTBOUND_ROUTE_KINDS.join('|')})_([a-z]{2,})$`)

const integer = v.pipe(v.union([v.number(), v.string()]), v.transform(Number), v.integer())

const TrunkSchema = v.pipe(
  v.object({
    trunkid: integer,
    name: v.nullish(v.string(), ''),
  }),
  v.transform(({ trunkid, name }) => ({ id: trunkid, name: name || String(trunkid) })),
)

const RouteSchema = v.object({
  route_id: integer,
  name: v.string(),
  trunks: v.nullish(v.array(TrunkSchema), []),
})

const RoutesResponseSchema = v.array(RouteSchema)

const DefaultRouteSchema = v.object({
  name: v.string(),
  trunks: v.nullish(v.array(TrunkSchema), []),
})

const DefaultsResponseSchema = v.union([
  v.record(v.string(), v.array(DefaultRouteSchema)),
  v.pipe(
    v.array(v.unknown()),
    v.transform((): Record<string, v.InferOutput<typeof DefaultRouteSchema>[]> => ({})),
  ),
])

export const DefaultRoutesSchema = v.object({
  country: v.pipe(v.string(), v.nonEmpty('routes.country_required')),
})

export type RouteTrunk = {
  id: number
  name: string
}

export type OutboundRoute = {
  id: number
  name: string
  kind: OutboundRouteKind | null
  locale: string
  trunks: RouteTrunk[]
}

export type OutboundRouteDefaults = {
  locales: string[]
  routeNamesByLocale: Record<string, string[]>
  trunks: RouteTrunk[]
}

type SaveRequest = Record<
  string,
  { route_id?: number; name: string; trunks: { trunkid: number; name: string }[] }[]
>

export const parseRouteName = (
  name: string,
): { kind: OutboundRouteKind | null; locale: string } => {
  const match = DEFAULT_ROUTE_NAME.exec(name)
  const kind = OUTBOUND_ROUTE_KINDS.find((item) => item === match?.[1]) ?? null

  return { kind, locale: kind && match ? match[2] : '' }
}

export const parseOutboundRoutes = (raw: unknown): OutboundRoute[] =>
  v.parse(RoutesResponseSchema, raw).map((route) => ({
    id: route.route_id,
    name: route.name,
    ...parseRouteName(route.name),
    trunks: route.trunks,
  }))

export const parseOutboundRouteDefaults = (raw: unknown): OutboundRouteDefaults => {
  const defaults = v.parse(DefaultsResponseSchema, raw)
  const locales = Object.keys(defaults)

  return {
    locales,
    routeNamesByLocale: Object.fromEntries(
      locales.map((locale) => [locale, defaults[locale].map((route) => route.name)]),
    ),
    trunks: Object.values(defaults)[0]?.[0]?.trunks ?? [],
  }
}

export const getRoutesLocale = (routes: Pick<OutboundRoute, 'locale'>[]): string =>
  routes.find((route) => route.locale)?.locale ?? ''

const toRequestTrunks = (trunks: RouteTrunk[]) =>
  trunks.map((trunk) => ({ trunkid: trunk.id, name: trunk.name }))

export const buildCreateDefaultsRequest = (
  locale: string,
  defaults: OutboundRouteDefaults,
): SaveRequest => ({
  [locale]: (defaults.routeNamesByLocale[locale] ?? []).map((name) => ({
    name,
    trunks: toRequestTrunks(defaults.trunks),
  })),
})

export const buildUpdateTrunksRequest = (
  routes: OutboundRoute[],
  routeId: number,
  trunks: RouteTrunk[],
): SaveRequest => ({
  [getRoutesLocale(routes) || FALLBACK_LOCALE]: routes.map((route) => ({
    route_id: route.id,
    name: route.name,
    trunks: toRequestTrunks(route.id === routeId ? trunks : route.trunks),
  })),
})

export const getAvailableTrunks = (allTrunks: RouteTrunk[], assigned: RouteTrunk[]): RouteTrunk[] =>
  allTrunks.filter((trunk) => !assigned.some((item) => item.id === trunk.id))

export const moveItem = <T>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const moved = [...items]
  const [item] = moved.splice(from, 1)

  moved.splice(to, 0, item)
  return moved
}

export const haveSameTrunks = (a: RouteTrunk[], b: RouteTrunk[]): boolean =>
  a.length === b.length && a.every((trunk, index) => trunk.id === b[index].id)

export const filterOutboundRoutes = (
  routes: OutboundRoute[],
  textFilter: string,
  describeRoute: (route: OutboundRoute) => string[],
): OutboundRoute[] =>
  routes.filter((route) =>
    matchesText(
      textFilter,
      route.name,
      ...describeRoute(route),
      ...route.trunks.map((trunk) => trunk.name),
    ),
  )

export const sortOutboundRoutes = (
  routes: OutboundRoute[],
  sortKey: OutboundRouteSortKey,
  descending: boolean,
  getRouteTitle: (route: OutboundRoute) => string,
): OutboundRoute[] => {
  const sorted =
    sortKey === 'name'
      ? [...routes].sort(
          (a, b) => compareNatural(getRouteTitle(a), getRouteTitle(b)) || a.id - b.id,
        )
      : [...routes]

  return descending ? sorted.reverse() : sorted
}

export const getOutboundRouteAdvancedUrl = (route: Pick<OutboundRoute, 'id'>): string =>
  `${OUTBOUND_ROUTE_ADVANCED_URL}${encodeURIComponent(route.id)}`

export const getOutboundRoutes = async (): Promise<OutboundRoute[]> => {
  const { data } = await api.GET('/outboundroutes')
  return parseOutboundRoutes(data)
}

export const getOutboundRouteDefaults = async (): Promise<OutboundRouteDefaults> => {
  const { data } = await api.GET('/outboundroutes/defaults')
  return parseOutboundRouteDefaults(data)
}

export const postDefaultOutboundRoutes = async (locale: string): Promise<void> => {
  if ((await getOutboundRoutes()).length > 0) {
    return
  }
  const body = buildCreateDefaultsRequest(locale, await getOutboundRouteDefaults())

  if (body[locale].length === 0) {
    throw new Error(`No default outbound routes for "${locale}"`)
  }
  await api.POST('/outboundroutes', { body })
}

export const postOutboundRouteTrunks = async (
  routeId: number,
  trunks: RouteTrunk[],
): Promise<void> => {
  const routes = await getOutboundRoutes()

  if (!routes.some((route) => route.id === routeId)) {
    throw new Error(`Outbound route ${routeId} does not exist anymore`)
  }
  await api.POST('/outboundroutes', {
    body: buildUpdateTrunksRequest(routes, routeId, trunks),
  })
}

export const refreshFreepbxSession = async (): Promise<void> => {
  await api.GET('/login').catch(() => undefined)
}
