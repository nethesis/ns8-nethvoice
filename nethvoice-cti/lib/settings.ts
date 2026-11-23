// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadPreference } from "./storage"

interface NewIslandConfigTypes {
  hostname: string
  username: string
  auth_token: string
  sip_exten: string
  sip_secret: string
  sip_host: string
  sip_port: string
}

export function newIslandConfig(obj: NewIslandConfigTypes): string {
  // Return the encoded string
  return btoa(
    `${obj.hostname}:${obj.username}:${obj.auth_token}:${obj.sip_exten}:${obj.sip_secret}:${obj.sip_host}:${obj.sip_port}`,
  )
}

export const getSelectedSettingsPage = (currentUsername: string) => {
  const selectedSettingsPage = loadPreference('settingsSelectedPage', currentUsername) || ''
  return { selectedSettingsPage }
}
