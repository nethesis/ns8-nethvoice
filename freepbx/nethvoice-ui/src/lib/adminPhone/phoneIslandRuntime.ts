//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import './phoneIsland.css'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { PhoneIsland } from '@nethesis/phone-island'
import { ADMIN_PHONE_UA_TYPE } from '@/lib/adminPhone/adminPhone'

export type PhoneIslandOptions = { dataConfig: string; displayName: string }

export type PhoneIslandInstance = { unmount: () => void }

export const mountPhoneIsland = (
  element: HTMLElement,
  options: PhoneIslandOptions,
): PhoneIslandInstance => {
  const root = createRoot(element)

  root.render(
    createElement(PhoneIsland, {
      dataConfig: options.dataConfig,
      uaType: ADMIN_PHONE_UA_TYPE,
      sipOnly: true,
      displayName: options.displayName,
    }),
  )
  return { unmount: () => root.unmount() }
}
