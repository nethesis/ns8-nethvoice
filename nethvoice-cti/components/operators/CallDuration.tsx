// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect } from 'react'
import classNames from 'classnames'
import { formatCallDuration } from '../../lib/dateTime'

export interface CallDurationProps extends ComponentProps<'div'> {
  startTime: number
}

export const CallDuration: FC<CallDurationProps> = ({ startTime, className }): JSX.Element => {
  const [duration, setDuration]: any = useState(0)
  const [firstRender, setFirstRender]: any = useState(true)

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    updateDuration()
    const id = setInterval(updateDuration, 1000)

    return () => {
      clearInterval(id)
    }
  }, [firstRender, startTime])

  const updateDuration = () => {
    if (startTime) {
      const d = (new Date().getTime() - startTime) / 1000
      setDuration(d)
    } else {
      setDuration(0)
    }
  }

  return <div className={classNames(className)}>{formatCallDuration(duration)}</div>
}

CallDuration.displayName = 'CallDuration'
