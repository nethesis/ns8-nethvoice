// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * It can be used to render a status dot.
 *
 * @param size - The status dot size.
 * @param status - The status of status dot.
 *
 */

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import type { StatusTypes } from '../../theme/Types'
import { useTheme } from '../../theme/Context'

export interface statusDotProps extends Omit<ComponentPropsWithRef<'button'>, 'color' | 'style'> {
  size?: 'extra_small' | 'small' | 'base' | 'large' | 'extra_large'
  animate?: boolean
  status: StatusTypes
}

export const StatusDot = forwardRef<HTMLButtonElement, statusDotProps>(
  ({ size = 'small', status, animate, className }, ref): JSX.Element => {
    const { statusDot: theme } = useTheme().theme
    const themeStatus: any = useTheme().theme.status
    return (
      <div
        className={classNames(
          theme.base,
          size && theme.sizes[size],
          themeStatus[status]?.avatar.dot,
          animate && theme.animation,
          className,
        )}
      >
        {animate && size === 'large' && (
          <div className='w-5 h-5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/60 rounded-full'></div>
        )}
        {animate && size === 'extra_large' && (
          <div className='w-8 h-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/60 rounded-full'></div>
        )}
      </div>
    )
  },
)

StatusDot.displayName = 'StatusDot'
