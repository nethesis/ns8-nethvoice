//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'
import type { OutboundRoute } from '@/lib/routes/outbound'

export function useOutboundRouteLabels() {
  const { t } = useI18n()

  const getRouteTitle = (route: Pick<OutboundRoute, 'kind' | 'name'>): string =>
    route.kind ? t(`routes.outbound_kind.${route.kind}`) : route.name

  const getRouteDescription = (route: Pick<OutboundRoute, 'kind'>): string =>
    route.kind ? t(`routes.outbound_kind.${route.kind}_description`) : t('routes.custom_route')

  return { getRouteTitle, getRouteDescription }
}
