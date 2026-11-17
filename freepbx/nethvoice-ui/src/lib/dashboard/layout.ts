//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const DASHBOARD_CARDS = [
  'presence',
  'devices',
  'phoneStatus',
  'callsSummary',
  'calls',
  'hourlyCalls',
  'trunks',
  'inboundRoutes',
] as const

export type DashboardCardId = (typeof DASHBOARD_CARDS)[number]

const isDashboardCard = (value: unknown): value is DashboardCardId =>
  typeof value === 'string' && (DASHBOARD_CARDS as readonly string[]).includes(value)

export const normalizeCardOrder = (saved: unknown): DashboardCardId[] => {
  const known = Array.isArray(saved) ? saved.filter(isDashboardCard) : []
  const unique = [...new Set(known)]

  return [...unique, ...DASHBOARD_CARDS.filter((card) => !unique.includes(card))]
}

export const moveCardTo = (
  order: DashboardCardId[],
  card: DashboardCardId,
  target: DashboardCardId,
): DashboardCardId[] => {
  const from = order.indexOf(card)
  const to = order.indexOf(target)

  if (from === -1 || to === -1 || from === to) {
    return order
  }
  const next = order.filter((item) => item !== card)
  next.splice(to, 0, card)
  return next
}

export const moveCardBy = (
  order: DashboardCardId[],
  visible: DashboardCardId[],
  card: DashboardCardId,
  offset: number,
): DashboardCardId[] => {
  const index = visible.indexOf(card)
  const target = visible[index + offset]

  if (index === -1 || target === undefined) {
    return order
  }
  return moveCardTo(order, card, target)
}
