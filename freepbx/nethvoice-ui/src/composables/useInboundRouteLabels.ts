//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'
import {
  describeInboundDestination,
  isInvalidDestination,
  type InboundRoute,
  type RouteDestination,
} from '@/lib/routes/inbound'

export function useInboundRouteLabels() {
  const { t } = useI18n()

  // What the route answers, e.g. "0721405500 from 3351234567".
  const getRouteName = (route: Pick<InboundRoute, 'number' | 'cid'>): string => {
    if (route.number) {
      return route.cid
        ? t('routes.route_from', { did: route.number, cid: route.cid })
        : route.number
    }
    return route.cid ? t('routes.any_did_from', { cid: route.cid }) : t('routes.any_did')
  }

  // The name of the route, or what it answers when it has none.
  const getDisplayName = (route: Pick<InboundRoute, 'number' | 'cid' | 'description'>): string =>
    route.description.trim() || getRouteName(route)

  const describeDestination = (destination: RouteDestination): string =>
    isInvalidDestination(destination)
      ? t('routes.invalid_destination')
      : describeInboundDestination(destination, (kind) => t(`routes.destination_kind.${kind}`))

  return { getRouteName, getDisplayName, describeDestination, isInvalidDestination }
}
