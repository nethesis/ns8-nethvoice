//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

export const sha1 = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const buildSecretKey = async (
  username: string,
  password: string,
  sharedSecret: string,
): Promise<string> => {
  const passwordHash = await sha1(password)
  return sha1(`${username}${passwordHash}${sharedSecret}`)
}
