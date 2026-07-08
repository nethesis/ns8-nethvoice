// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode } from 'react'
import classNames from 'classnames'
import { Button } from './Button'
import { closeSideDrawer } from '../../lib/utils'
import { t } from 'i18next'

export interface DrawerFooterProps {
  cancelLabel?: string
  confirmLabel: string
  onCancel?: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
  className?: string
  confirmIcon?: ReactNode
  confirmVariant?:
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'white'
    | 'ghost'
    | 'dashboard'
    | 'whiteDanger'
  confirmClassName?: string
  showCancel?: boolean
  withPadding?: boolean
}

export const DrawerFooter: FC<DrawerFooterProps> = ({
  cancelLabel = t('Common.Cancel'),
  confirmLabel,
  onCancel = closeSideDrawer,
  onConfirm,
  confirmDisabled = false,
  className = '',
  confirmIcon,
  confirmVariant = 'primary',
  confirmClassName = '',
  showCancel = true,
  withPadding = false,
}) => {
  return (
    <div className={classNames('flex items-center justify-end', withPadding && 'px-5', className)}>
      {showCancel && (
        <Button variant='ghost' type='button' onClick={onCancel} className='mb-4'>
          {cancelLabel}
        </Button>
      )}
      <Button
        variant={confirmVariant}
        type='button'
        onClick={onConfirm}
        className={classNames('ml-4 mb-4', confirmClassName)}
        disabled={confirmDisabled}
      >
        {confirmIcon && <span className='mr-2'>{confirmIcon}</span>}
        {confirmLabel}
      </Button>
    </div>
  )
}
