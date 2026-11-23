// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { t } from 'i18next'
import { PHONE_KEY_TYPES } from './phoneKeys'

interface PhysicalPhoneKeyBadgeProps {
  type: string
}

const BADGE_STYLES: { [key: string]: string } = {
  line: 'bg-surfaceBadgeGreen dark:bg-surfaceBadgeGreenDark text-textBadgeGreen dark:text-textBadgeGreenDark',
  blf: 'bg-surfaceBadgeBlueNethLink dark:bg-surfaceBadgeBlueNethLinkDark text-textBadgeBlueNethLink dark:text-textBadgeBlueNethLinkDark',
  queuetoggle:
    'bg-surfaceBadgeAmber dark:bg-surfaceBadgeAmberDark text-textBadgeAmber dark:text-textBadgeAmberDark',
  dnd: 'bg-surfaceBadgeRose dark:bg-surfaceBadgeRoseDark text-textBadgeRose dark:text-textBadgeRoseDark',
  speed_dial:
    'bg-surfaceBadgeCyan dark:bg-surfaceBadgeCyanDark text-textBadgeCyan dark:text-textBadgeCyanDark',
}

export const getKeyTypeBadgeText = (type: string) => {
  const keyType = PHONE_KEY_TYPES.find((item) => item.value === type)
  return keyType ? t(keyType.badge) : ''
}

export const getKeyTypeSearchText = (type: string) => {
  const keyType = PHONE_KEY_TYPES.find((item) => item.value === type)
  return keyType ? `${t(keyType.badge)} ${t(keyType.label)}` : ''
}

export const PhysicalPhoneKeyBadge: FC<PhysicalPhoneKeyBadgeProps> = ({ type }) => {
  const keyType = PHONE_KEY_TYPES.find((item) => item.value === type)

  if (!keyType || !BADGE_STYLES[type]) {
    return null
  }

  return (
    <span
      className={`${BADGE_STYLES[type]} inline-flex items-center justify-center rounded-full px-3 py-0.5 text-sm font-medium leading-5 text-center whitespace-nowrap`}
    >
      {t(keyType.badge)}
    </span>
  )
}

PhysicalPhoneKeyBadge.displayName = 'PhysicalPhoneKeyBadge'
