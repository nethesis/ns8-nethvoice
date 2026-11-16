//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { OverviewStatus } from '@/lib/overview/overview'

export const PRESENCE_DOT: Record<OverviewStatus, string> = {
  online: 'bg-green-500',
  busy: 'bg-rose-500',
  ringing: 'bg-rose-500',
  dnd: 'bg-rose-500',
  forward: 'bg-amber-500',
  offline: 'bg-gray-500',
}
