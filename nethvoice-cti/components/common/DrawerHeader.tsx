// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode } from 'react'
import { SideDrawerCloseIcon } from './SideDrawerCloseIcon'
import classNames from 'classnames'

export interface DrawerHeaderProps {
  title: string
  className?: string
  titleClassName?: string
  closeIconClassName?: string
  onClose?: () => void
  rightContent?: ReactNode
}

export const DrawerHeader: FC<DrawerHeaderProps> = ({
  title,
  className,
  titleClassName,
  closeIconClassName,
  onClose,
  rightContent,
}) => {
  return (
    <div className={classNames('pt-6 px-6', className)}>
      <div className='flex items-center justify-between'>
        <div
          className={classNames(
            'text-xl font-medium text-primaryNeutral dark:text-primaryNeutralDark',
            titleClassName,
          )}
        >
          {title}
        </div>
        <div className='flex items-center h-7'>
          {rightContent}
          <SideDrawerCloseIcon
            className={classNames('p-0.5', closeIconClassName)}
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  )
}
