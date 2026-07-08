// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect } from 'react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleXmark, faClock, faUserClock } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'

export interface LoggedStatusProps extends ComponentProps<'div'> {
  loggedIn: boolean
  paused: boolean
}

export const LoggedStatus: FC<LoggedStatusProps> = ({
  loggedIn,
  paused,
  className,
}): JSX.Element => {
  const [firstRender, setFirstRender]: any = useState(true)
  const [status, setStatus]: any = useState('loggedOut')
  const { t } = useTranslation()

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    if (!loggedIn) {
      setStatus('loggedOut')
    } else {
      if (paused) {
        setStatus('paused')
      } else {
        setStatus('loggedIn')
      }
    }
  }, [firstRender, loggedIn, paused])

  return (
    <>
      <div
        className={classNames(
          'flex items-center gap-2 text-sm shrink-0',
          status === 'loggedIn'
            ? 'text-green-700 dark:text-green-600'
            : status === 'paused'
            ? 'text-yellow-700 dark:text-yellow-600'
            : 'text-gray-500 dark:text-gray-400',
          className,
        )}
      >
        <FontAwesomeIcon
          icon={
            status === 'loggedIn' ? faCircleCheck : status === 'paused' ? faClock : faCircleXmark
          }
          className='h-4 w-4'
        />
        <span>
          {t(
            status === 'loggedIn'
              ? 'Queues.Logged in'
              : status === 'paused'
              ? 'Queues.On a break'
              : 'Queues.Logged out',
          )}
        </span>
      </div>
    </>
  )
}

LoggedStatus.displayName = 'LoggedStatus'
