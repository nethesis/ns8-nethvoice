//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { OverviewStatus } from '@/lib/overview/overview'

export const PRESENCE_DOT: Record<OverviewStatus, string> = {
  online: 'bg-green-500',
  busy: 'bg-red-500',
  ringing: 'bg-red-500',
  dnd: 'bg-gray-950',
  forward: 'bg-green-500',
  offline: 'bg-gray-500',
}
