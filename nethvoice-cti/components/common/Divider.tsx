// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import classNames from 'classnames'

export interface DividerProps {
  className?: string
  paddingY?: string
  borderColor?: string
}

export const Divider: FC<DividerProps> = ({
  className,
  paddingY = 'pb-8',
  borderColor = 'border-layoutDivider dark:border-layoutDividerDark',
}) => {
  return (
    <div className={classNames('relative', paddingY, className)}>
      <div className='absolute inset-0 flex items-center' aria-hidden='true'>
        <div className={classNames('w-full border-t', borderColor)} />
      </div>
    </div>
  )
}

Divider.displayName = 'Divider'
