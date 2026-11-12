//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const MIN_SEARCH_LENGTH = 2

export const DEFAULT_PAGE_SIZE = 10

export const PAGE_SIZES = [5, 10, 25, 50, 100]

export type Focusable = { focus(): void }

export const normalize = (str: string) => {
  return str.toLowerCase().replace(/\s+/g, '_')
}

export const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export const matchesText = (filter: string, ...values: (string | number | null | undefined)[]) => {
  const needle = foldText(filter)

  if (!needle) {
    return true
  }
  return values.some((value) => foldText(String(value ?? '')).includes(needle))
}

export const paginate = <T>(items: T[], pageNum: number, pageSize: number): T[] => {
  const start = (pageNum - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export const compareNatural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
