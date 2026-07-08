// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeadset, faUserCheck, faUserClock, faUserXmark } from '@fortawesome/free-solid-svg-icons'
import { cardContent } from '../../../lib/queueManager'

export interface QueueManagementHeaderProps extends ComponentProps<'div'> {
  agentCountersSelectedQueue: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const QueueManagementHeader: FC<QueueManagementHeaderProps> = ({
  className,
  agentCountersSelectedQueue,
}): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'>
        {/* Online operators */}
        {cardContent(
          faUserCheck,
          agentCountersSelectedQueue?.online ? agentCountersSelectedQueue?.online : 0,
          'Online operators',
        )}

        {/* On break operators */}
        {cardContent(
          faUserClock,
          agentCountersSelectedQueue?.paused ? agentCountersSelectedQueue?.paused : 0,
          'On break operators',
        )}

        {/* Offline operators */}
        {cardContent(
          faUserXmark,
          agentCountersSelectedQueue?.offline ? agentCountersSelectedQueue?.offline : 0,
          'Offline operators',
        )}

        {/* Free operators */}
        {cardContent(
          faHeadset,
          agentCountersSelectedQueue?.free ? agentCountersSelectedQueue?.free : 0,
          'Free operators',
        )}

        {/* Busy operators ( in queue ) */}
        {cardContent(
          faHeadset,
          agentCountersSelectedQueue?.connected ? agentCountersSelectedQueue?.connected : 0,
          'Busy operators (in queue)',
        )}

        {/* Busy operators ( out queue ) */}
        {cardContent(
          faHeadset,
          agentCountersSelectedQueue?.busy ? agentCountersSelectedQueue?.busy : 0,
          'Busy operators (out queue)',
        )}
      </div>
    </>
  )
}

QueueManagementHeader.displayName = 'QueueManagementHeader'
