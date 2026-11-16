// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect } from 'react'
import { Badge } from '../common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone } from '@fortawesome/free-solid-svg-icons'
import { capitalize } from 'lodash'
import classNames from 'classnames'
import { isOperatorCallable } from '../../lib/operators'

export interface OperatorStatusBadgeProps extends ComponentProps<'div'> {
  operator: any
  currentUsername: string
  callEnabled: boolean
  size?: 'base' | 'small' | 'large'
  onCall?: Function
}

export const OperatorStatusBadge: FC<OperatorStatusBadgeProps> = ({
  operator,
  currentUsername,
  callEnabled,
  size,
  onCall,
  className,
}): JSX.Element => {
  const [isCallable, setCallable] = useState(false)

  useEffect(() => {
    const callable = isOperatorCallable(operator, currentUsername)
    setCallable(callable && callEnabled)
  }, [operator, currentUsername, callEnabled])

  const badgeClicked = (ev: any) => {
    if (isCallable && onCall) {
      // notify parent component
      onCall(operator, ev)
    }
  }

  return (
    <>
      <div className={classNames(className)}>
        <Badge
          rounded='full'
          variant={operator?.mainPresence}
          size={size}
          onClick={badgeClicked}
          className={classNames(
            isCallable && 'hover:bg-emerald-300 dark:hover:bg-emerald-900 cursor-pointer',
          )}
        >
          {['incoming', 'ringing'].includes(operator?.mainPresence) ? (
            <div className='flex items-center'>
              {/* ringing icon */}
              <span className='ringing-animation mr-2'></span>
              <span>{capitalize(operator?.mainPresence)}</span>
            </div>
          ) : isCallable ? (
            <div className='flex items-center'>
              {/* phone icon */}
              <FontAwesomeIcon
                icon={faPhone}
                className='mr-1.5 h-3 w-3 flex-shrink-0'
                aria-hidden='true'
              />
              <span>{capitalize(operator?.mainPresence)}</span>
            </div>
          ) : (
            <span>{capitalize(operator?.mainPresence)}</span>
          )}
        </Badge>
      </div>
    </>
  )
}

OperatorStatusBadge.displayName = 'OperatorStatusBadge'
