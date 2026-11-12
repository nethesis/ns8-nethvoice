//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faDesktop, faHeadset, faMobileScreen } from '@fortawesome/free-solid-svg-icons'
import type { SoftwareDeviceType } from '@/lib/users/users'

export const DEVICE_ICONS: Record<SoftwareDeviceType, IconDefinition> = {
  webrtc: faHeadset,
  nethlink: faDesktop,
  mobile: faMobileScreen,
}
