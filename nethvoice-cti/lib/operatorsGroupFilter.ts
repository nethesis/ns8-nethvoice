// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

const GROUP_FILTERS_WITHOUT_GROUP = ['all', 'favorites']

export const keepAvailableGroupFilter = (selected: string[], available: string[]): string[] => {
  const kept = selected.filter(
    (value) => GROUP_FILTERS_WITHOUT_GROUP.includes(value) || available.includes(value),
  )

  return kept.length ? kept : ['all']
}
