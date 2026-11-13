//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

declare module '@nethesis/phone-island' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react'

  export type PhoneIslandProps = {
    dataConfig: string
    uaType: string
    showAlways?: boolean
    urlParamWithEvent?: boolean
    sipOnly?: boolean
    displayName?: string
  }

  export const PhoneIsland: ForwardRefExoticComponent<PhoneIslandProps & RefAttributes<unknown>>
}
