// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import classNames from 'classnames'
import { FC, ComponentProps } from 'react'

// Follows NeEmptyState and the "Empty state" patterns of the Nethesis design system
export interface EmptyStateProps extends ComponentProps<'div'> {
  title: string
  description?: string
  icon?: any
  // 'plain': no card, straight on the page
  variant?: 'card' | 'plain'
}

export const EmptyState: FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  children,
  className,
  variant = 'card',
}): JSX.Element => {
  return (
    <div
      className={classNames(
        'w-full text-sm',
        variant === 'card' && 'bg-white shadow dark:bg-gray-800 px-6 py-7 sm:rounded-md sm:px-8',
        variant === 'plain' && 'px-6 py-7 sm:px-8',
        className,
      )}
    >
      <div className='flex flex-col items-center text-center'>
        {icon && (
          // the size is set here, whatever the caller passes, so every empty state matches
          <div className='mb-5 text-gray-400 dark:text-gray-400 [&_svg]:!h-14 [&_svg]:!w-14'>
            {icon}
          </div>
        )}
        <div className='text-base font-medium text-primaryNeutral dark:text-primaryNeutralDark'>
          {title}
        </div>
        {description && <div className='mt-1 text-gray-500 dark:text-gray-400'>{description}</div>}
        {children && <div className='mt-5'>{children}</div>}
      </div>
    </div>
  )
}
