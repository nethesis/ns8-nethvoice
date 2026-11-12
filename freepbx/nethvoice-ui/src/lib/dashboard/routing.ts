//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import {
  getInboundRouteName,
  type DestinationKind,
  type InboundRoute,
  type RouteDestination,
} from '@/lib/routes/inbound'
import {
  getRegistrationStatus,
  type RegistrationStatus,
  type TrunksLiveState,
} from '@/lib/trunks/liveState'
import type { Trunk } from '@/lib/trunks/trunks'

export type DashboardTrunk = {
  id: string
  label: string
  registration: RegistrationStatus
}

export type DashboardInboundRoute = {
  id: string
  label: string
  destination: string
}

export const listTrunkRegistrations = (
  trunks: Pick<Trunk, 'id' | 'name'>[],
  liveTrunks: TrunksLiveState | undefined,
): DashboardTrunk[] =>
  trunks.map((trunk) => ({
    id: String(trunk.id),
    label: trunk.name,
    registration: getRegistrationStatus(trunk.name, liveTrunks),
  }))

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

export const listInboundRouteDestinations = (
  routes: InboundRoute[],
  describeKind: (kind: DestinationKind) => string,
): DashboardInboundRoute[] =>
  routes.map((route) => ({
    id: route.id,
    label: getInboundRouteName(route),
    destination: describeInboundDestination(route.destination, describeKind),
  }))
