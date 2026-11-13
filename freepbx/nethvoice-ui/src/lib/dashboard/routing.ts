//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import {
  describeInboundDestination,
  getInboundRouteName,
  isInvalidDestination,
  type DestinationKind,
  type InboundRoute,
} from '@/lib/routes/inbound'
import {
  getProviderStatus,
  getRegistrationStatus,
  type ProviderStatus,
  type RegistrationStatus,
  type TrunksLiveState,
} from '@/lib/trunks/liveState'
import type { Trunk } from '@/lib/trunks/trunks'

export type DashboardTrunkStatus = ProviderStatus | RegistrationStatus | 'not_connected'

export type DashboardTrunk = {
  id: string
  label: string
  status: DashboardTrunkStatus
}

export type DashboardInboundRoute = {
  id: string
  label: string
  destination: string
  invalidDestination: boolean
}

export type InboundRouteTexts = {
  describeKind: (kind: DestinationKind) => string
  anyDid: string
}

const UNREGISTERED = 'unregistered'

export const getDashboardTrunkStatus = (
  trunkName: string,
  liveTrunks: TrunksLiveState | undefined,
): DashboardTrunkStatus => {
  const provider = getProviderStatus(trunkName, liveTrunks)

  if (provider === 'unknown' || provider === 'pending' || provider === 'offline') {
    return provider
  }

  if (liveTrunks?.[trunkName]?.registration === UNREGISTERED) {
    return 'not_connected'
  }
  const registration = getRegistrationStatus(trunkName, liveTrunks)

  return registration === 'unmonitored' ? provider : registration
}

export const listTrunkStatuses = (
  trunks: Pick<Trunk, 'id' | 'name'>[],
  liveTrunks: TrunksLiveState | undefined,
): DashboardTrunk[] =>
  trunks.map((trunk) => ({
    id: String(trunk.id),
    label: trunk.name,
    status: getDashboardTrunkStatus(trunk.name, liveTrunks),
  }))

export const listInboundRouteDestinations = (
  routes: InboundRoute[],
  texts: InboundRouteTexts,
): DashboardInboundRoute[] =>
  routes.map((route) => {
    const invalidDestination = isInvalidDestination(route.destination)

    return {
      id: route.id,
      label: getInboundRouteName(route, texts.anyDid),
      destination: invalidDestination
        ? ''
        : describeInboundDestination(route.destination, texts.describeKind),
      invalidDestination,
    }
  })
