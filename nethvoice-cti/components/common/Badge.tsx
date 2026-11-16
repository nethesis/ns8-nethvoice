// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The badge can be used to highlight values or statuses.
 *
 * @param label - The label to show.
 * @param rounded - It's useful to put the the label rounded or less
 * @param size - It's the size of the badge
 * @param variant - It's the type of the badge
 * @param dot - It's the dot for the presence
 * @param icon - It's the optional icon to show on the left of the content
 *
 */

import classNames from 'classnames'
import { FC, ComponentProps, ReactNode } from 'react'
import { useTheme } from '../../theme/Context'
import type { StatusTypes } from '../../theme/Types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

export interface BadgeProps extends ComponentProps<'span'> {
  variant: StatusTypes
  rounded?: 'base' | 'full'
  size?: 'base' | 'small' | 'large'
  icon?: ReactNode
  onRemove?: () => void
  removeLabel?: string
}

export const Badge: FC<BadgeProps> = ({
  rounded,
  variant,
  children,
  size,
  icon,
  onRemove,
  removeLabel,
  className,
  ...props
}): JSX.Element => {
  const { badge: theme, status: statuses } = useTheme().theme

  return (
    <>
      <span
        className={classNames(
          theme.base,
          rounded ? theme.rounded[rounded] : theme.rounded.base,
          variant && statuses[variant]?.badge.base,
          size ? theme.sizes[size] : theme.sizes.base,
          className,
        )}
        {...props}
      >
        {icon && <span className="mr-1.5 inline-flex items-center">{icon}</span>}
        {children}
        {onRemove && (
          <button
            type='button'
            aria-label={removeLabel || 'Remove'}
            className='ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current dark:hover:bg-white/10'
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
          >
            <FontAwesomeIcon icon={faXmark} className='h-3 w-3' aria-hidden='true' />
          </button>
        )}
      </span>
    </>
  )
}
