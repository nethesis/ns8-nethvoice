//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'
import { isOutboundRouteError, type OutboundRoute } from '@/lib/routes/outbound'
import { getCountryLabel } from '@/lib/settings/system'
import { describeError } from '@/stores/notifications'

export function useOutboundRouteLabels() {
  const { t, locale } = useI18n()

  const hasManyLocales = (routes: Pick<OutboundRoute, 'locale'>[]): boolean =>
    new Set(routes.map((route) => route.locale).filter(Boolean)).size > 1

  const getRouteTitle = (route: Pick<OutboundRoute, 'kind' | 'name'>): string =>
    route.kind ? t(`routes.outbound_kind.${route.kind}`) : route.name

  const getRouteTitleAmong = (
    route: Pick<OutboundRoute, 'kind' | 'name' | 'locale'>,
    routes: Pick<OutboundRoute, 'locale'>[],
  ): string =>
    route.kind && route.locale && hasManyLocales(routes)
      ? `${getRouteTitle(route)} (${getCountryLabel(route.locale, locale.value)})`
      : getRouteTitle(route)

  const getRouteDescription = (route: Pick<OutboundRoute, 'kind'>): string =>
    route.kind ? t(`routes.outbound_kind.${route.kind}_description`) : t('routes.custom_route')

  const describeRouteError = (error: unknown): string =>
    isOutboundRouteError(error) ? t(`routes.${error.code}`) : describeError(error)

  return { getRouteTitle, getRouteTitleAmong, getRouteDescription, describeRouteError }
}
