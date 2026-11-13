// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Decode JWT payload without verification
 * Note: This only extracts the payload, it doesn't verify the signature
 * 
 * @param token - The JWT token
 * @returns The decoded payload or null if invalid
 */
export function decodeJWT(token: string) {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.')
    
    if (parts.length !== 3) {
      console.error('Invalid JWT format')
      return null
    }

    // Decode the payload (second part)
    const payload = parts[1]
    
    // Add padding if needed for base64 decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4)
    
    // Decode from base64url
    const decodedPayload = Buffer.from(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    
    return JSON.parse(decodedPayload.toString())
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}
