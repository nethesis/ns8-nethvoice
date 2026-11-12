//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const MAX_TEXT_LENGTH = 300

const SECRET_KEY_PATTERN =
  /(secret|passw(or)?d|passwd|token|lkhash|^hash$|credential|authorization|web_user|voicemailpwd|^pin$)/i

export const isSecretKey = (key) => SECRET_KEY_PATTERN.test(key)

export const truncateText = (text, maxLength = MAX_TEXT_LENGTH) =>
  text.length > maxLength ? `${text.slice(0, maxLength)}…` : text

export const sanitize = (value) => {
  if (typeof value === 'string') {
    return truncateText(value)
  }

  if (Array.isArray(value)) {
    return value.map(sanitize)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSecretKey(key))
        .map(([key, item]) => [key, sanitize(item)]),
    )
  }
  return value
}

export const limitList = (items, limit) => ({
  total: items.length,
  truncated: items.length > limit,
  items: items.slice(0, limit),
})
