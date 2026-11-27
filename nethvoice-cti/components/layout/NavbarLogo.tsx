// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useState } from 'react'
import classNames from 'classnames'
import { getNavbarLogos } from '../../lib/loginAppearance'
import { getBrandName } from '../../lib/utils'

interface NavbarLogoProps {
  dark?: boolean
  imageClassName: string
  textClassName: string
}

export const NavbarLogo: FC<NavbarLogoProps> = ({
  dark = false,
  imageClassName,
  textClassName,
}) => {
  const [failed, setFailed] = useState(false)
  const logos = getNavbarLogos(typeof window !== 'undefined' ? (window as any).CONFIG : undefined)
  const brandName = getBrandName() || 'NethVoice'

  if (!logos || failed) {
    return (
      <span className={classNames('block break-words text-center font-medium', textClassName)}>
        {brandName}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={imageClassName}
      src={dark ? logos.dark : logos.light}
      alt={brandName}
      onError={() => setFailed(true)}
    />
  )
}
