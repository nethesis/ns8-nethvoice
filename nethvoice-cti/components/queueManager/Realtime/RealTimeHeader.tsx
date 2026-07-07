// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeadset, faUserCheck, faUserClock, faUserXmark } from '@fortawesome/free-solid-svg-icons'
import { cardContent } from '../../../lib/queueManager'

export interface RealTimeHeaderProps extends ComponentProps<'div'> {
  realTimeAgentCounters: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const RealTimeHeader: FC<RealTimeHeaderProps> = ({
  className,
  realTimeAgentCounters,
}): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {/* Connected calls */}
        {cardContent(faUserCheck, realTimeAgentCounters?.connected, 'Connected calls')}

        {/* Online operators */}
        {cardContent(faUserClock, realTimeAgentCounters?.online, 'Online operators')}

        {/* Free operators */}
        {cardContent(faHeadset, realTimeAgentCounters?.free, 'Free operators')}

        {/* Waiting calls */}
        {cardContent(faHeadset, realTimeAgentCounters?.waiting, 'Waiting calls')}

        {/* On break operators */}
        {cardContent(faUserXmark, realTimeAgentCounters?.paused, 'On break operators')}

        {/* Busy operators ( in queue ) */}
        {cardContent(faHeadset, realTimeAgentCounters?.busy, 'Busy operators (in queue)')}

        {/* Busy operators ( total calls ) */}
        {cardContent(faHeadset, realTimeAgentCounters?.tot, 'Total calls')}

        {/* Offline operators */}
        {cardContent(faHeadset, realTimeAgentCounters?.offline, 'Offline operators')}
      </div>
    </>
  )
}

RealTimeHeader.displayName = 'RealTimeHeader'
