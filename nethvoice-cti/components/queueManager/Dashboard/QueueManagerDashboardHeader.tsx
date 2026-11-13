// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDownLeftAndUpRightToCenter,
  faChevronDown,
  faTriangleExclamation,
  faPhone,
  faPhoneSlash,
  faArrowLeft,
  faClock,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import { isEmpty } from 'lodash'
import { Dropdown } from '../../common'
import {
  getAlarmsFlatList,
  getAlarm,
  getAlarmTime,
  cardContent,
} from '../../../lib/queueManager'

export interface QueueManagerDashboardHeaderProps extends ComponentProps<'div'> {
  totalAll: any
  totalAnswered: any
  totalFailed: any
  totalInvalid: any
  totalInProgress: any
  notManaged: any
}

// alarms are evaluated by the server every 30 seconds
const ALARMS_UPDATE_INTERVAL = 30000

// wraps the card in a dropdown only when there is something to open
const ConditionalDropdown = ({
  enabled,
  items,
  children,
}: {
  enabled: boolean
  items: ReactNode
  children: ReactNode
}) =>
  enabled ? (
    <Dropdown items={items} position='fullWidth' divider={true} className=''>
      {children}
    </Dropdown>
  ) : (
    <>{children}</>
  )

export const QueueManagerDashboardHeader: FC<QueueManagerDashboardHeaderProps> = ({
  className,
  totalAll,
  totalAnswered,
  totalFailed,
  totalInvalid,
  totalInProgress,
  notManaged,
}): JSX.Element => {
  const { t } = useTranslation()
  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)
  const [alarmsList, setAlarmsList] = useState<any>({})

  // get alarm list information and keep it updated while the dashboard is open
  useEffect(() => {
    async function getAlarmList() {
      try {
        const res = await getAlarm()
        setAlarmsList(res)
      } catch (err) {
        console.error(err)
      }
    }
    getAlarmList()
    const interval = setInterval(getAlarmList, ALARMS_UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Alarms section

  // Create a object with all alarms type and description
  const alarmsType = {
    queuefewop: {
      description: `${t('QueueManager.queuefewop alarm')}`,
    },
    queueholdtime: {
      description: `${t('QueueManager.queueholdtime alarm')}`,
    },
    queueload: {
      description: `${t('QueueManager.queueload alarm')}`,
    },
    queuemaxwait: {
      description: `${t('QueueManager.queuemaxwait alarm')}`,
    },
  }

  const alarms = getAlarmsFlatList(alarmsList)

  const queueLabel = (queueId: string) => {
    const queueName = queueManagerStore?.queues?.[queueId]?.name
    return queueName ? `${queueName} (${queueId})` : queueId
  }

  // built only when there is an alarm: every queue in alarm gets its own row
  const dropdownItems = isEmpty(alarms) ? null : (
    <div className='cursor-default w-full rounded-md bg-red-50 dark:bg-red-950'>
      <Dropdown.Header>
        <span className='block text-base font-semibold mb-2'>
          {t('QueueManager.Alarm error detected')}
        </span>
        <div className='border-t border-gray-300 dark:border-gray-600' />
        <ul role='list' className='flex flex-col divide-y divide-gray-300 dark:divide-gray-600'>
          {alarms.map((alarm: any) => (
            <li key={`${alarm.queue}-${alarm.type}`} className='flex flex-col py-3 gap-1'>
              <div className='flex items-center gap-3'>
                <FontAwesomeIcon
                  icon={faClock}
                  className='h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400'
                  aria-hidden='true'
                />
                <span className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  {queueLabel(alarm.queue)}
                </span>
                <span className='ml-auto text-sm font-medium text-gray-900 dark:text-gray-100'>
                  {getAlarmTime(alarm.date)}
                </span>
              </div>
              <span className='text-sm leading-5'>
                {alarmsType[alarm.type as keyof typeof alarmsType]?.description || alarm.type}
              </span>
            </li>
          ))}
        </ul>
      </Dropdown.Header>
    </div>
  )

  return (
    <>
      <div>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3'>
          {/* Alarm, hidden when the alarms are disabled */}
          {alarmsList?.status === true && (
            <div className='rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-1 mt-1 relative flex items-center'>
              <div className='w-full'>
                {/* the card only opens when there is an alarm to show */}
                <ConditionalDropdown enabled={!isEmpty(alarms)} items={dropdownItems}>
                  <div className='flex items-center'>
                    <div
                      className={`h-10 w-10 flex items-center justify-center rounded-xl mt-1 mb-1 ${
                        !isEmpty(alarms)
                          ? 'bg-red-50 dark:bg-emerald-50'
                          : 'bg-emerald-50 dark:bg-emerald-800'
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        className={`h-6 w-6 py-2 flex items-center ${
                          !isEmpty(alarms)
                            ? 'text-rose-600'
                            : 'text-emerald-600 dark:text-emerald-100'
                        }`}
                        aria-hidden='true'
                      />
                    </div>
                    <div className='flex items-center ml-4 text-gray-900 dark:text-white'>
                      <p className='text-3xl font-medium tracking-tight text-left leading-10'>
                        {alarms.length}
                      </p>
                      <p className='text-sm font-normal leading-5 text-left ml-4'>
                        {alarms.length === 1 ? t('QueueManager.Alarm') : t('QueueManager.Alarms')}
                      </p>
                    </div>
                    {!isEmpty(alarms) && (
                      <div className='flex items-center ml-auto'>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className='h-3.5 w-3.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 hover:dark:text-gray-500'
                          aria-hidden='true'
                        />
                      </div>
                    )}
                  </div>
                </ConditionalDropdown>
              </div>
            </div>
          )}

          {/* not Managed */}
          {cardContent(faListCheck, notManaged?.count, 'Not managed customers')}

          {/* total calls */}
          {cardContent(faPhone, totalAll, 'Total calls')}

          {/* total answered */}
          {cardContent(faArrowLeft, totalAnswered, 'Answered calls')}

          {/*lostCalls */}
          {cardContent(faMissed, totalFailed, 'Lost calls')}

          {/* totalInvalid */}
          {cardContent(faPhoneSlash, totalInvalid, 'Invalid calls')}

          {/* In progress */}
          {cardContent(faDownLeftAndUpRightToCenter, totalInProgress, 'In progress')}
        </div>
      </div>
    </>
  )
}

QueueManagerDashboardHeader.displayName = 'QueueManagerDashboardHeader'
