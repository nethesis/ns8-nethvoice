// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Capitalizes the first letter of a string
 * @param str String to capitalize
 * @returns String with first letter capitalized
 */
export const capitalizeFirstLetter = (str?: string): string => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
