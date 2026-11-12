//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import {
  faDesktop,
  faHeadset,
  faMobileScreenButton,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import type { OverviewDeviceType } from '@/lib/overview/overview'

export const DEVICE_ICONS: Record<OverviewDeviceType, IconDefinition> = {
  webrtc: faHeadset,
  nethlink: faDesktop,
  mobile: faMobileScreenButton,
  physical: faOfficePhone,
}
