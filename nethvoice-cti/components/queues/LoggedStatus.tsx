// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useId } from 'react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faClock,
  faMugSaucer,
  faThumbTack,
  faUserClock,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { useIsTruncated } from '../../lib/hooks/useIsTruncated'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

export interface LoggedStatusProps extends ComponentProps<'div'> {
  loggedIn: boolean
  paused: boolean
  pauseReason?: string
}

const PAUSE_REASONS: Record<string, { label: string; icon: IconDefinition }> = {
  'Lunch break': { label: 'Queues.Lunch break', icon: faMugSaucer },
  Emergency: { label: 'Queues.Emergency', icon: faCircleExclamation },
  Backend: { label: 'Queues.Backend', icon: faThumbTack },
}

export const LoggedStatus: FC<LoggedStatusProps> = ({
  loggedIn,
  paused,
  pauseReason,
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

  const pauseReasonData = PAUSE_REASONS[pauseReason ?? '']
  const label = t(
    status === 'loggedIn'
      ? 'Queues.Logged in'
      : status === 'paused'
      ? pauseReasonData?.label ?? 'Queues.On a break'
      : 'Queues.Logged out',
  )
  const tooltipId = `logged-status-${useId()}`
  const { ref, isTruncated } = useIsTruncated<HTMLSpanElement>(label)

  return (
    <>
      <div
        className={classNames(
          'flex items-center gap-2 text-sm min-w-0',
          status === 'loggedIn'
            ? 'text-green-700 dark:text-green-600'
            : status === 'paused'
            ? 'text-yellow-700 dark:text-yellow-600'
            : 'text-gray-500 dark:text-gray-400',
          className,
        )}
        data-tooltip-id={isTruncated ? tooltipId : undefined}
        data-tooltip-content={isTruncated ? label : undefined}
      >
        <FontAwesomeIcon
          icon={
            status === 'loggedIn'
              ? faCircleCheck
              : status === 'paused'
              ? pauseReasonData?.icon ?? faClock
              : faCircleXmark
          }
          className='h-4 w-4 shrink-0'
          aria-hidden='true'
        />
        <span ref={ref} className='truncate'>
          {label}
        </span>
        {isTruncated && <CustomThemedTooltip id={tooltipId} place='top' positionStrategy='fixed' />}
      </div>
    </>
  )
}

LoggedStatus.displayName = 'LoggedStatus'
