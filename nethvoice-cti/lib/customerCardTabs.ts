// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

export const decodeCustomerCardHtml = (base64: string): string => {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

export const orderCustomerCards = (order: unknown, cards: Record<string, unknown>): string[] => {
  const available = Object.keys(cards)
  const ordered = Array.isArray(order)
    ? order.filter(
        (key, index): key is string =>
          typeof key === 'string' && available.includes(key) && order.indexOf(key) === index,
      )
    : []

  return [...ordered, ...available.filter((key) => !ordered.includes(key))]
}
