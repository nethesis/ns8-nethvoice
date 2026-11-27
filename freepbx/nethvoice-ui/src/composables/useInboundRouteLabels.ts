//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'
import {
  describeInboundDestination,
  getInboundRouteName,
  isInvalidDestination,
  type InboundRoute,
  type RouteDestination,
} from '@/lib/routes/inbound'

export function useInboundRouteLabels() {
  const { t } = useI18n()

  const getRouteName = (route: Pick<InboundRoute, 'number' | 'cid'>): string =>
    getInboundRouteName(route, t('routes.any_did'))

  const describeDestination = (destination: RouteDestination): string =>
    isInvalidDestination(destination)
      ? t('routes.invalid_destination')
      : describeInboundDestination(destination, (kind) => t(`routes.destination_kind.${kind}`))

  return { getRouteName, describeDestination, isInvalidDestination }
}
