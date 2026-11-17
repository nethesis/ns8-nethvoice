//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export type PbxCountrySources = {
  cached: string
  routesLocale: string
  countries?: readonly string[]
  defaultLanguage?: string
}

export const derivePbxCountry = ({
  cached,
  routesLocale,
  countries,
  defaultLanguage = '',
}: PbxCountrySources): string => {
  const isSupported = (pbxLocale: string) =>
    pbxLocale !== '' && (!countries || countries.includes(pbxLocale))

  if (isSupported(cached)) {
    return cached
  }

  if (isSupported(routesLocale)) {
    return routesLocale
  }
  return countries?.includes(defaultLanguage) ? defaultLanguage : ''
}
