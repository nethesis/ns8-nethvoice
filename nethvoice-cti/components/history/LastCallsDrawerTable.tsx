// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useEffect, useState, useMemo, useCallback } from 'react'
import {
  isCallAnswered,
  searchDrawerHistoryUser,
  searchDrawerHistorySwitchboard,
} from '../../lib/history'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import {
  faBuilding,
  faArrowRight,
  faPhone,
  faXmark,
  faArrowLeft,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { formatDateLoc } from '../../lib/dateTime'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { EmptyState, InlineNotification } from '../common'
import { CallSkeleton } from '../common/Skeleton'
import { useTranslation } from 'react-i18next'
import { isEqual } from 'lodash'
import { UserCallStatusIcon } from './UserCallStatusIcon'
import { CallsDate } from './CallsDate'
import { CallDetails } from './CallDetails'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { customScrollbarClass } from '../../lib/utils'

export interface LastCallsDrawerTableProps extends ComponentPropsWithRef<'div'> {
  callType: string
  dateFrom: Date
  dateTo: Date
  // number of calls to display
  limit: number
  // search a single phone number or all extensions of an operator (main extension must be at the first position of array)
  phoneNumbers: string[]
  isCustomerCard?: boolean
}

interface Call {
  src: string
  dst: string
  cnum: string
  type: 'internal' | 'in' | 'out'
  disposition: string
  time: string
  [key: string]: any
}

interface CallsResponse {
  rows: Call[]
  [key: string]: any
}

export const LastCallsDrawerTable = forwardRef<HTMLButtonElement, LastCallsDrawerTableProps>(
  (
    { callType, dateFrom, dateTo, limit, phoneNumbers, isCustomerCard, className, ...props },
    ref,
  ) => {
    const { t } = useTranslation()
    const [isLoaded, setLoaded] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [lastCalls, setLastCalls] = useState<CallsResponse>({ rows: [] })
    const [firstRender, setFirstRender] = useState(true)
    const { operators } = useSelector((state: RootState) => state.operators)
    const authStore = useSelector((state: RootState) => state.authentication)
    const [previousPhoneNumbers, setPreviousPhoneNumbers] = useState<string[]>([])
    const user = useSelector((state: RootState) => state.user)

    // history API returns irrelevant calls that need to be filtered, pageSize specifies the total number of calls to retrieve from backend
    const pageSize = 100

    const filterLastCalls = useCallback(
      (calls: CallsResponse): Call[] => {
        // if privacy is enabled, not filtering calls
        if (user?.profile?.macro_permissions?.nethvoice_cti?.permissions?.privacy?.value) {
          return calls.rows.slice(0, limit)
        }

        const relevantCalls = calls.rows.filter(
          (call: Call) =>
            phoneNumbers.includes(call.src) ||
            phoneNumbers.includes(call.cnum) ||
            phoneNumbers.includes(call.dst),
        )

        // limits the number of calls to the specified limit
        return relevantCalls.slice(0, limit)
      },
      [
        limit,
        phoneNumbers,
        user?.profile?.macro_permissions?.nethvoice_cti?.permissions?.privacy?.value,
      ],
    )

    const retrieveLastCalls = useCallback(async () => {
      setLoaded(false)
      setErrorMessage('')
      setLastCalls({ rows: [] })

      const dateStart = formatDateLoc(dateFrom, 'yyyyMMdd')
      const dateEnd = formatDateLoc(dateTo, 'yyyyMMdd')

      try {
        let res: CallsResponse

        if (callType === 'user') {
          res = await searchDrawerHistoryUser(
            authStore?.username,
            dateStart,
            dateEnd,
            phoneNumbers[0],
            'time%20desc',
            pageSize,
          )
        } else if (callType === 'switchboard') {
          res = await searchDrawerHistorySwitchboard(
            dateStart,
            dateEnd,
            phoneNumbers[0],
            'time%20desc',
            pageSize,
          )
        } else {
          throw new Error('Invalid call type')
        }

        res.rows = filterLastCalls(res)
        setLastCalls(res)
      } catch (e) {
        const errorKey =
          callType === 'user'
            ? 'Phonebook.Cannot retrieve last calls of user'
            : 'Phonebook.Cannot retrieve last calls of switchboard'

        setErrorMessage(t(errorKey) || '')
      } finally {
        setLoaded(true)
      }
    }, [authStore?.username, callType, dateFrom, dateTo, filterLastCalls, phoneNumbers, t])

    useEffect(() => {
      if (firstRender) {
        setFirstRender(false)
        return
      }

      retrieveLastCalls()
    }, [firstRender])

    useEffect(() => {
      if (isEqual(phoneNumbers, previousPhoneNumbers)) {
        return
      }

      setPreviousPhoneNumbers(phoneNumbers)
      setLoaded(false)
    }, [phoneNumbers, previousPhoneNumbers])

    useEffect(() => {
      if (!isLoaded && !firstRender) {
        retrieveLastCalls()
      }
    }, [isLoaded, firstRender])

    const checkIconSwitchboard = useCallback(
      (call: Call) => {
        const isAnswered = isCallAnswered(call)

        return (
          <>
            <div className='text-sm md:mt-0 flex'>
              <div>
                {call.type === 'internal' && (
                  <div>
                    {isAnswered ? (
                      <>
                        <FontAwesomeIcon
                          icon={faBuilding}
                          className='tooltip-switchboard-internal-answered h-4 w-4 text-iconStatusOnline dark:text-iconStatusOnlineDark'
                          aria-hidden='true'
                          data-tooltip-id='tooltip-switchboard-internal-answered'
                          data-tooltip-content={t('History.Internal answered') || ''}
                        />

                        <CustomThemedTooltip
                          id='tooltip-switchboard-internal-answered'
                          place='left'
                        />
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon
                          icon={faBuilding}
                          className='tooltip-switchboard-internal-missed h-4 w-4 text-iconStatusBusy dark:text-iconStatusBusyDark'
                          aria-hidden='true'
                          data-tooltip-id='tooltip-switchboard-internal-missed'
                          data-tooltip-content={t('History.Internal missed') || ''}
                        />

                        <CustomThemedTooltip
                          id='tooltip-switchboard-internal-missed'
                          place='left'
                        />
                      </>
                    )}
                  </div>
                )}
                {call.type !== 'internal' && (
                  <div>
                    {call.type === 'in' && (
                      <div>
                        {isAnswered ? (
                          <>
                            <FontAwesomeIcon
                              icon={faArrowLeft}
                              className='tooltip-switchboard-incoming-answered -rotate-45 h-5 w-3.5 text-iconStatusOnline dark:text-iconStatusOnlineDark'
                              aria-hidden='true'
                              data-tooltip-id='tooltip-switchboard-incoming-answered'
                              data-tooltip-content={t('History.Incoming answered') || ''}
                            />

                            <CustomThemedTooltip
                              id='tooltip-switchboard-incoming-answered'
                              place='left'
                            />
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon
                              icon={faMissed as IconDefinition}
                              className='tooltip-switchboard-incoming-missed h-5 w-4 text-iconStatusBusy dark:text-iconStatusBusyDark'
                              aria-hidden='true'
                              data-tooltip-id='tooltip-switchboard-incoming-missed'
                              data-tooltip-content={t('History.Incoming missed') || ''}
                            />

                            <CustomThemedTooltip
                              id='tooltip-switchboard-incoming-missed'
                              place='left'
                            />
                          </>
                        )}
                      </div>
                    )}
                    {call.type === 'out' && (
                      <div>
                        {isAnswered ? (
                          <>
                            <FontAwesomeIcon
                              icon={faArrowLeft}
                              className='tooltip-switchboard-outgoing-answered h-5 w-3.5 rotate-[135deg] text-iconStatusOnline dark:text-iconStatusOnlineDark'
                              aria-hidden='true'
                              data-tooltip-id='tooltip-switchboard-outgoing-answered'
                              data-tooltip-content={t('History.Outgoing answered') || ''}
                            />

                            <CustomThemedTooltip
                              id='tooltip-switchboard-outgoing-answered'
                              place='left'
                            />
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon
                              icon={faXmark}
                              className='tooltip-switchboard-outgoing-missed h-5 w-3.5 text-iconStatusBusy dark:text-iconStatusBusyDark'
                              aria-hidden='true'
                              data-tooltip-id='tooltip-switchboard-outgoing-missed'
                              data-tooltip-content={t('History.Outgoing missed') || ''}
                            />

                            <CustomThemedTooltip
                              id='tooltip-switchboard-outgoing-missed'
                              place='left'
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      },
      [t],
    )

    const skeletonCount = useMemo(() => Math.min(limit, 9), [limit])

    const callsTitle = useMemo(() => {
      if (isCustomerCard) return t('Phonebook.Last calls')
      if (callType === 'switchboard') return t('Phonebook.Last switchboard calls')
      if (callType === 'personal') return t('Phonebook.Last personal calls')
      return ''
    }, [callType, isCustomerCard, t])

    const hasRows = useMemo(() => lastCalls?.rows?.length > 0, [lastCalls?.rows?.length])

    // Rendering
    return (
      <>
        {/* Last calls title */}
        <h4 className='mt-6 text-base font-medium text-gray-700 dark:text-gray-200'>
          {callsTitle}
        </h4>
        {/* Divider */}
        {hasRows && <div className='mt-4 border-t border-gray-200 dark:border-gray-700'></div>}
        {/* error */}
        {errorMessage && (
          <InlineNotification
            type='error'
            title={errorMessage}
            className='my-4'
          ></InlineNotification>
        )}
        {!isLoaded && !errorMessage && (
          <ul role='list' className='divide-y divide-gray-200 dark:divide-gray-700'>
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <li key={index} className='py-4 px-5'>
                <CallSkeleton />
              </li>
            ))}
          </ul>
        )}
        {/* empty state */}
        {isLoaded && !errorMessage && lastCalls?.rows && !lastCalls.rows.length && (
          <div className='mt-4'>
            <EmptyState
              title={t('Phonebook.No recent calls') || ''}
              icon={
                <FontAwesomeIcon icon={faPhone} className='mx-auto h-12 w-12' aria-hidden='true' />
              }
            ></EmptyState>
          </div>
        )}
        {/* Last calls list */}
        {isLoaded && !errorMessage && hasRows && (
          <div className='mx-auto'>
            <div className='flex flex-col'>
              <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
                  {isLoaded && lastCalls?.rows && (
                    <div className={customScrollbarClass}>
                      <div>
                        <table className='min-w-full divide-y divide-gray-300 dark:divide-gray-700'>
                          <tbody className='divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 text-sm'>
                            {/* Not empty state  */}
                            {isLoaded &&
                              lastCalls?.rows &&
                              lastCalls.rows.map((call: any, index: number) => (
                                <tr key={index}>
                                  {/* Date */}
                                  <td className='whitespace-nowrap py-4 pr-3'>
                                    {/* Date column */}
                                    <CallsDate call={call} />
                                  </td>

                                  {/* Source */}
                                  <td className='px-3 py-4 whitespace-nowrap'>
                                    <CallDetails
                                      call={call}
                                      operators={operators}
                                      fromHistory
                                      direction='in'
                                    />
                                  </td>

                                  {/* Icon column */}
                                  <td className='pl-2 pr-6 py-4'>
                                    <FontAwesomeIcon
                                      icon={faArrowRight}
                                      className='ml-0 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-600'
                                      aria-hidden='true'
                                    />
                                  </td>

                                  {/* Destination */}
                                  <td className='px-3 py-4 whitespace-nowrap'>
                                    {/* Destination column */}
                                    <CallDetails
                                      call={call}
                                      operators={operators}
                                      fromHistory
                                      direction='out'
                                    />
                                  </td>

                                  {/* Outcome */}
                                  <td className='px-3 py-4'>
                                    {callType === 'user' && <UserCallStatusIcon call={call} />}
                                    {callType === 'switchboard' && checkIconSwitchboard(call)}{' '}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  },
)

LastCallsDrawerTable.displayName = 'LastCallsDrawerTable'
