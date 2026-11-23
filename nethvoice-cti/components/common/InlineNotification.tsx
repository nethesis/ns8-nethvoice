// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * It can be used to render an Alert
 *
 * @param children - The children/s to render.
 * @param type - The alert type.
 *
 */

import classNames from 'classnames'
import { FC, ComponentProps } from 'react'
import { useTheme } from '../../theme/Context'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleXmark,
  faCircleInfo,
  faTriangleExclamation,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'

export interface InlineNotificationProps extends ComponentProps<'div'> {
  type: 'info' | 'warning' | 'success' | 'error'
  title: string
}
export const InlineNotification: FC<InlineNotificationProps> = ({
  type,
  title,
  children,
  className,
}): JSX.Element => {
  const { inlineNotification: theme } = useTheme().theme
  let checkIcon =
    type === 'info' ? (
      <FontAwesomeIcon icon={faCircleInfo} className={theme.iconStyle[type]} aria-hidden='true' />
    ) : type === 'warning' ? (
      <FontAwesomeIcon
        icon={faTriangleExclamation}
        className={theme.iconStyle[type]}
        aria-hidden='true'
      />
    ) : type === 'success' ? (
      <FontAwesomeIcon icon={faCircleCheck} className={theme.iconStyle[type]} aria-hidden='true' />
    ) : (
      <FontAwesomeIcon icon={faCircleXmark} className={theme.iconStyle[type]} aria-hidden='true' />
    )

  return (
    <div
      className={classNames(theme.base, type ? theme.type[type] : theme.type.success, className)}
    >
      <div className='flex-shrink-0'>{checkIcon}</div>
      <div className='min-w-0 flex-1'>
          <h3 className={theme.titleStyle[type]}>{title}</h3>
          <div className={theme.childrenText[type]}>{children}</div>
      </div>
    </div>
  )
}
