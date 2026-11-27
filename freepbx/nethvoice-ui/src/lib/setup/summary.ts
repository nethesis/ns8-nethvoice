//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const SUMMARY_WARNINGS = [
  'no_extensions',
  'no_trunks',
  'no_inbound_routes',
  'no_outbound_routes',
  'all_outbound_routes_without_trunks',
  'outbound_routes_without_trunks',
  'outbound_routes_with_unusable_trunks',
] as const

export type SummaryWarning = (typeof SUMMARY_WARNINGS)[number]

export type SummaryCounts = {
  usersWithExtension: number
  usableTrunks: number
  inboundRoutes: number
  outboundRoutes: number
  outboundRoutesWithoutTrunks: number
  outboundRoutesWithUnusableTrunks: number
}

export const getSummaryWarnings = (counts: Partial<SummaryCounts>): SummaryWarning[] => {
  const warnings: SummaryWarning[] = []
  const isZero = (value: number | undefined) => value === 0
  const withoutTrunks = counts.outboundRoutesWithoutTrunks ?? 0

  if (isZero(counts.usersWithExtension)) {
    warnings.push('no_extensions')
  }

  if (isZero(counts.usableTrunks)) {
    warnings.push('no_trunks')
  }

  if (isZero(counts.inboundRoutes)) {
    warnings.push('no_inbound_routes')
  }

  if (isZero(counts.outboundRoutes)) {
    warnings.push('no_outbound_routes')
  } else if (withoutTrunks > 0 && withoutTrunks === counts.outboundRoutes) {
    warnings.push('all_outbound_routes_without_trunks')
  } else if (withoutTrunks > 0) {
    warnings.push('outbound_routes_without_trunks')
  }

  if (!isZero(counts.usableTrunks) && (counts.outboundRoutesWithUnusableTrunks ?? 0) > 0) {
    warnings.push('outbound_routes_with_unusable_trunks')
  }
  return warnings
}

export const getLanguageName = (language: string, uiLocale: string): string => {
  try {
    const name = new Intl.DisplayNames([uiLocale], { type: 'language' }).of(language) ?? language
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return language
  }
}
