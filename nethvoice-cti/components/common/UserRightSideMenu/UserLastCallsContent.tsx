// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPhone,
  faUsers,
  faSortAmountAsc,
  faCheck,
  faEllipsisVertical,
  faArrowRightLong,
  faUserPlus,
  faFilter,
} from '@fortawesome/free-solid-svg-icons'
import { Button, Avatar, EmptyState, Dropdown, Badge } from '../../common'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { useTranslation } from 'react-i18next'
import { CallTypes, getLastCalls, getEffectiveCnam } from '../../../lib/history'
import { getNMonthsAgoDate } from '../../../lib/utils'
import { formatDateLoc, getTimeDifference } from '../../../lib/dateTime'
import type { SortTypes } from '../../../lib/history'
import { UserCallStatusIcon } from '../../history/UserCallStatusIcon'
import { getJSONItem, setJSONItem } from '../../../lib/storage'
import { openCreateLastCallContact, openShowContactDrawer } from '../../../lib/phonebook'
import { CallDetails } from '../../history/CallDetails'
import Link from 'next/link'
import { Skeleton } from '../../common/Skeleton'
import { customScrollbarClass } from '../../../lib/utils'
import { CustomThemedTooltip } from '../CustomThemedTooltip'
import { format, utcToZonedTime } from 'date-fns-tz'
import { formatDistanceToNowStrict } from 'date-fns'
import { enGB, it } from 'date-fns/locale'
import i18next from 'i18next'

interface LastCallTypes extends CallTypes {
  username: string
}

type LastCallsTypes = LastCallTypes[]

interface LastCallItemProps {
  call: LastCallTypes
  operators: any
  queuesStore: any
  t: (key: string) => string
  openLastCardUserDrawer: (userInformation: any) => void
  handleCreateContact: (call: any) => void
}

const LastCallItem = memo(
  ({
    call,
    operators,
    queuesStore,
    t,
    openLastCardUserDrawer,
    handleCreateContact,
  }: LastCallItemProps) => {
    const [isHovered, setIsHovered] = useState(false)

    // Keep the same timezone behavior used by the generic CallsDate component
    const diffValueConversation = (diffValueOriginal: number) => {
      const sign = diffValueOriginal >= 0 ? '+' : '-'
      const hours = Math.abs(diffValueOriginal).toString().padStart(2, '0')
      return `${sign}${hours}00`
    }

    const getLocalTimezoneOffset = () => {
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      return format(new Date(), 'xx', { timeZone: localTimezone })
    }

    const getDifferenceBetweenTimezone = () => {
      const differenceValueBetweenTimezone = getTimeDifference(false)
      return diffValueConversation(differenceValueBetweenTimezone)
    }

    const getCompactTimeAgo = (call: any) => {
      const localTimeZone = getLocalTimezoneOffset()
      const differenceBetweenTimezone = getDifferenceBetweenTimezone()
      const selectedLanguage = i18next?.languages[0] || 'en'

      const shortIt = {
        ...it,
        formatDistance: (token: string, count: number, options?: any) => {
          const map: Record<string, string> = {
            xSeconds: 's',
            xMinutes: 'm',
            xHours: 'h',
            xDays: 'g',
            xMonths: 'mes',
            xYears: 'a',
          }

          const unit = map[token] || ''
          const suffix = options?.addSuffix
            ? options.comparison && options.comparison > 0
              ? ' tra'
              : ' fa'
            : ''

          return `${count}${unit}${suffix}`
        },
      }

      const shortEn = {
        ...enGB,
        formatDistance: (token: string, count: number, options?: any) => {
          const map: Record<string, string> = {
            xSeconds: 's',
            xMinutes: 'm',
            xHours: 'h',
            xDays: 'd',
            xMonths: 'mo',
            xYears: 'y',
          }

          const unit = map[token] || ''
          const suffix = options?.addSuffix
            ? options.comparison && options.comparison > 0
              ? ' in'
              : ' ago'
            : ''

          return `${count}${unit}${suffix}`
        },
      }

      const callDate = utcToZonedTime(call?.time * 1000, differenceBetweenTimezone)
      
      return formatDistanceToNowStrict(callDate, {
        addSuffix: true,
        locale: selectedLanguage === 'it' ? shortIt : shortEn,
      })
    }

    const getCallDateString = (call: any) => {
      const selectedLanguage = i18next?.languages[0] || 'en'
      const differenceBetweenTimezone = getDifferenceBetweenTimezone()
      return format(
        utcToZonedTime(call?.time * 1000, differenceBetweenTimezone),
        'd MMM yyyy HH:mm',
        { locale: selectedLanguage === 'it' ? it : enGB },
      )
    }

    const isIncoming = call.direction === 'in'
    const hasNoInfo = isIncoming
      ? !(getEffectiveCnam(call.cnam, call.src || call.cnum) || call.ccompany)
      : !(getEffectiveCnam(call.dst_cnam, call.dst) || call.dst_ccompany)

    const renderCallDetails = (direction: 'in' | 'out') => (
      <CallDetails
        call={call}
        operators={operators}
        hideName={true}
        fromHistory={false}
        isQueueBadgeAvailable={call.channel.includes('from-queue')}
        direction={direction}
        tooltipPlace='top'
      />
    )

    const renderCallNumber = (direction: 'in' | 'out') => (
      <CallDetails
        call={call}
        operators={operators}
        hideNumber={true}
        highlightNumber={true}
        isExtensionNumberLastCalls={true}
        direction={direction}
      />
    )

    return (
      <div
        className='group relative flex items-center py-6 px-3'
        onMouseEnter={() => hasNoInfo && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className='relative min-w-0 flex-1 items-center px-6'>
          <div className='flex items-start'>
            <Avatar
              size='base'
              placeholderType='person'
              src={operators[call?.username]?.avatarBase64}
              status={operators[call?.username]?.mainPresence}
              onClick={() => openLastCardUserDrawer(call)}
            />
            <div className='ml-4 truncate flex flex-col gap-1.5'>
              <div className='flex items-center'>
                <div
                  className={`text-sm font-medium text-gray-700 dark:text-gray-200 w-32 xl:w-40 2xl:w-48`}
                >
                  {renderCallDetails(call.direction === 'in' ? 'in' : 'out')}
                </div>
              </div>

              {call?.channel?.includes('from-queue') && (
                <div>
                  <>
                    <Badge
                      size='small'
                      variant='offline'
                      rounded='full'
                      className={`overflow-hidden tooltip-queue-${call?.queue}`}
                      data-tooltip-id={`tooltip-queue-${call?.queue}`}
                      data-tooltip-content={
                        queuesStore?.queues[call?.queue]?.name
                          ? `${queuesStore?.queues[call?.queue]?.name} ${call?.queue}`
                          : t('QueueManager.Queue')
                      }
                    >
                      <FontAwesomeIcon
                        icon={faUsers}
                        className='h-4 w-4 mr-2 ml-1'
                        aria-hidden='true'
                      />
                      <div className={`truncate max-w-20 xl:max-w-28 2xl:max-w-40 mr-1`}>
                        {queuesStore?.queues[call?.queue]?.name
                          ? `${queuesStore?.queues[call?.queue]?.name} ${call?.queue}`
                          : t('QueueManager.Queue')}
                      </div>
                    </Badge>
                    <CustomThemedTooltip id={`tooltip-queue-${call?.queue}`} place='left' />
                  </>
                </div>
              )}

              <div className='truncate text-sm text-primary dark:text-primaryDark'>
                <div className='flex items-center'>
                  <UserCallStatusIcon call={call} tooltipPlace='bottom' />
                  <span className='cursor-pointer hover:underline'>
                    {renderCallNumber(call.direction === 'in' ? 'in' : 'out')}
                  </span>
                </div>
              </div>

              <div
                className='font-poppins text-sm leading-4 font-normal text-gray-600 dark:text-gray-300 truncate pb-1'
                data-tooltip-id={`tooltip-lastcall-date-${call.uniqueid}`}
                data-tooltip-content={getCallDateString(call)}
              >
                {getCompactTimeAgo(call)} ({getCallDateString(call)})
              </div>
              <CustomThemedTooltip id={`tooltip-lastcall-date-${call.uniqueid}`} place='bottom' />
            </div>
          </div>

          {/* Create contact button */}
          {hasNoInfo && isHovered && (
            <div className='absolute right-3 top-0 transform'>
              <Button
                variant='ghost'
                className='flex items-center border dark:border-borderDark border-borderLight dark:hover:bg-hoverDark hover:bg-hoverLight'
                onClick={() => handleCreateContact(call)}
                size='small'
              >
                <FontAwesomeIcon
                  className='text-base dark:text-textBlueDark text-textBlueLight'
                  icon={faUserPlus}
                />
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  },
)

LastCallItem.displayName = 'LastCallItem'

export const UserLastCallsContent = () => {
  const { t } = useTranslation()
  const operators = useSelector((state: RootState) => state.operators.operators)
  const username = useSelector((state: RootState) => state.user.username)
  const feature_codes = useSelector((state: RootState) => state.user.feature_codes)
  const queuesStore = useSelector((state: RootState) => state.queues)
  const [lastCalls, setLastCalls]: any = useState<LastCallsTypes>()
  const [filteredCalls, setFilteredCalls]: any = useState<LastCallsTypes>()
  const firstLoadedRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const defaultSort: string = getJSONItem(`preferences-${username}`).lastUserCallsSort || ''
  const [sort, setSort] = useState<SortTypes>(defaultSort || 'time_desc')
  const { profile } = useSelector((state: RootState) => state.user)
  const [directionFilter, setDirectionFilter] = useState<string>('all')

  const getLastCallsList = useCallback(
    async (newSort: SortTypes) => {
      if (profile?.macro_permissions?.cdr?.value) {
        const dateStart = getNMonthsAgoDate(2)
        const dateEnd = getNMonthsAgoDate()
        const dateStartString = formatDateLoc(dateStart, 'yyyyMMdd')
        const dateEndString = formatDateLoc(dateEnd, 'yyyyMMdd')
        const callsData = await getLastCalls(username, dateStartString, dateEndString, newSort)
        if (callsData) {
          const callsFinalInformations = getLastCallsUsername(callsData.rows)
          setLastCalls(callsFinalInformations)
          applyFilters(callsFinalInformations, directionFilter)
          setIsLoading(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [username, profile?.macro_permissions?.cdr?.value, directionFilter],
  )

  const getLastCallsUsername = useCallback(
    (callsData: CallTypes[]) => {
      if (!callsData) return []

      return callsData.map((call: CallTypes) => {
        let callName =
          call.direction === 'out'
            ? getEffectiveCnam(call.dst_cnam, call.dst) || call.dst_ccompany
            : call.direction === 'in'
            ? getEffectiveCnam(call.cnam, call.src || call.cnum) || call.ccompany
            : ''

        let operator: any = null

        if (callName) {
          operator = Object.values(operators).find((operator: any) => operator.name === callName)
        } else {
          operator = Object.values(operators).find((operator: any) => {
            const isExten = operator.endpoints.extension.find((exten: any) => exten.id === call.dst)
            return !!isExten
          })
        }
        return { ...call, username: operator?.username || '' }
      })
    },
    [operators],
  )

  const applyFilters = useCallback(
    (calls: LastCallsTypes, direction: string) => {
      if (!calls) return

      let result = [...calls]

      if (direction !== 'all') {
        result = result.filter((call) => call.direction === direction)
      }

      // Get audio test code from feature_codes, fallback to '*41' if not available
      const audioTestCode = feature_codes?.audio_test || '*41'

      result = result.filter((call) => {
        const numberToCheck = call.direction === 'in' ? call.src : call.dst
        return !numberToCheck?.includes(audioTestCode)
      })

      setFilteredCalls(result)
    },
    [feature_codes?.audio_test],
  )

  const handleDirectionFilter = useCallback(
    (direction: string) => {
      setDirectionFilter(direction)
      if (lastCalls) {
        applyFilters(lastCalls, direction)
      }
    },
    [lastCalls, applyFilters],
  )

  const sortCalls = useCallback(
    (newSort: SortTypes): void => {
      getLastCallsList(newSort)
      setSort(newSort)
      const preferences = getJSONItem(`preferences-${username}`)
      preferences['lastUserCallsSort'] = newSort
      setJSONItem(`preferences-${username}`, preferences)
    },
    [getLastCallsList, username],
  )

  const [firstRender, setFirstRender] = useState(true)

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    if (username && !firstLoadedRef.current) {
      firstLoadedRef.current = true
      setIsLoading(true)
      getLastCallsList(sort)
    }

    return () => {
      /* cleanup */
    }
  }, [username, firstRender, getLastCallsList, sort])

  const lastCallsUpdate = useSelector((state: RootState) => state.lastCalls)

  useEffect(() => {
    if (lastCallsUpdate.isReload) {
      setIsLoading(true)
      getLastCallsList(sort)
    }
  }, [lastCallsUpdate.isReload, getLastCallsList, sort])

  const openLastCardUserDrawer = useCallback((userInformation: any) => {
    const isIncoming = userInformation?.direction === 'in'
    const rawName = isIncoming ? userInformation?.cnam : userInformation?.dst_cnam
    const extension = isIncoming ? userInformation?.src : userInformation?.dst
    const phoneNumber = isIncoming ? (userInformation?.src || userInformation?.cnum) : userInformation?.dst
    const effectiveName = getEffectiveCnam(rawName, phoneNumber)
    const company = isIncoming ? userInformation?.ccompany : userInformation?.dst_ccompany

    if (effectiveName || company) {
      const contact = {
        displayName: effectiveName || company || '-',
        kind: 'person',
        extension: extension,
      }
      openShowContactDrawer(contact)
    } else if (extension) {
      openCreateLastCallContact({ extension })
    }
  }, [])

  const handleCreateContact = useCallback((call: any) => {
    const isIncoming = call?.direction === 'in'
    const extension = isIncoming ? call?.src : call?.dst
    if (extension) {
      openCreateLastCallContact({ extension })
    }
  }, [])

  useEffect(() => {
    if (lastCalls) {
      applyFilters(lastCalls, directionFilter)
    }
  }, [lastCalls, directionFilter, applyFilters])

  return (
    <>
      <div className='flex h-full flex-col bg-elevation0 dark:bg-elevation0Dark'>
        <div className='py-4 px-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-medium text-primaryNeutral dark:text-primaryNeutralDark leading-7'>
              {t('LastCalls.Last calls')}
            </h2>
            <div className='flex gap-2 items-center'>
              <Dropdown
                items={
                  <>
                    <Dropdown.Header>
                      <span className='font-poppins font-light'>{t('LastCalls.Filter by')}</span>
                    </Dropdown.Header>
                    <Dropdown.Item onClick={() => handleDirectionFilter('all')}>
                      <span className='font-poppins font-light'>{t('LastCalls.All calls')}</span>
                      {directionFilter === 'all' && (
                        <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                      )}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleDirectionFilter('in')}>
                      <span className='font-poppins font-light'>{t('LastCalls.Incoming')}</span>
                      {directionFilter === 'in' && (
                        <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                      )}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleDirectionFilter('out')}>
                      <span className='font-poppins font-light'>{t('LastCalls.Outgoing')}</span>
                      {directionFilter === 'out' && (
                        <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                      )}
                    </Dropdown.Item>
                  </>
                }
                position='left'
              >
                <Button className='flex gap-2 h-9 w-9' variant='white'>
                  <FontAwesomeIcon icon={faFilter} className='h-4 w-4' />
                </Button>
              </Dropdown>

              <Dropdown
                items={
                  <>
                    <Dropdown.Header>
                      <span className='font-poppins font-light'>{t('LastCalls.Sort by')}</span>
                    </Dropdown.Header>
                    <Dropdown.Item onClick={() => sortCalls('time_desc')}>
                      <span className='font-poppins font-light'>{t('LastCalls.Newest')}</span>
                      {sort === 'time_desc' && (
                        <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                      )}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => sortCalls('time_asc')}>
                      <span className='font-poppins font-light'>{t('LastCalls.Oldest')}</span>
                      {sort === 'time_asc' && (
                        <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                      )}
                    </Dropdown.Item>
                  </>
                }
                position='left'
              >
                <Button className='flex gap-2 h-9 w-9' variant='white'>
                  <FontAwesomeIcon icon={faSortAmountAsc} className='h-4 w-4' />
                </Button>
              </Dropdown>
              <Dropdown
                items={
                  <>
                    <Link
                      href={{ pathname: '/history', query: { section: 'Calls' } }}
                      className='w-full'
                    >
                      <Dropdown.Item icon={faArrowRightLong}>
                        {t('LastCalls.Go to history')}
                      </Dropdown.Item>
                    </Link>
                  </>
                }
                position='left'
              >
                <Button variant='ghost' className='py-2 px-2 h-9 w-9'>
                  <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                  <span className='sr-only'>{t('LastCalls.Open lastcalls menu')}</span>
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>
        <span className='border-b border-layoutDivider dark:border-layoutDividerDark'></span>
        <ul role='list' className={`flex-1 ${customScrollbarClass}`}>
          {/* Skeleton loader */}
          {isLoading &&
            Array.from(Array(4)).map((_, index) => (
              <li key={`skeleton-${index}`}>
                <div className='group relative flex items-center py-6 px-3'>
                  <div className='relative min-w-0 flex-1 items-center px-6'>
                    <div className='flex items-start'>
                      {/* Avatar skeleton - matching Avatar size='base' */}
                      <Skeleton variant='circular' className='h-10 w-10 flex-shrink-0' />

                      <div className='ml-4 truncate flex flex-col gap-1.5'>
                        {/* Name/company skeleton */}
                        <div className='flex items-center'>
                          <div className='text-sm font-medium w-64'>
                            <Skeleton width='85%' height='16px' />
                          </div>
                        </div>

                        {/* Phone number with status icon skeleton */}
                        <div className='truncate text-sm'>
                          <div className='flex items-center'>
                            {/* UserCallStatusIcon skeleton */}
                            <div className='mt-1 text-sm md:mt-0 flex'>
                              <div>
                                <Skeleton
                                  variant='circular'
                                  className='mr-2 h-5 w-8 flex-shrink-0'
                                />
                              </div>
                            </div>
                            <span className='cursor-pointer hover:underline'>
                              <Skeleton width='45%' height='23.25px' />
                            </span>
                          </div>
                        </div>

                        {/* CallsDate skeleton */}
                        <Skeleton width='35%' height='16px' />

                        {/* Queue badge skeleton (conditional) */}
                        <div>
                          <Skeleton width='45%' height='16px' className='rounded-full' />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Divider */}
                {index !== 3 && (
                  <div className='px-6 relative'>
                    <div className='border-b border-layoutDivider dark:border-layoutDividerDark'></div>
                  </div>
                )}
              </li>
            ))}

          {/* Empty state */}
          {!isLoading && filteredCalls?.length === 0 && (
            <div className='py-4 px-6'>
              <EmptyState
                title={
                  directionFilter !== 'all'
                    ? t(`LastCalls.No ${directionFilter === 'in' ? 'incoming' : 'outgoing'} calls`)
                    : t('LastCalls.No calls')
                }
                icon={
                  <FontAwesomeIcon
                    icon={faPhone}
                    className='mx-auto h-12 w-12'
                    aria-hidden='true'
                  />
                }
              />
            </div>
          )}

          {!isLoading &&
            filteredCalls?.length! > 0 &&
            filteredCalls.map((call: any, index: number) => (
              <li key={`${call.id}-${index}`}>
                <LastCallItem
                  call={call}
                  operators={operators}
                  queuesStore={queuesStore}
                  t={t}
                  openLastCardUserDrawer={openLastCardUserDrawer}
                  handleCreateContact={handleCreateContact}
                />
                {/* Avoid to show if latest */}
                {index !== filteredCalls?.length - 1 && (
                  <div className='px-6 relative'>
                    <div className='border-b border-layoutDivider dark:border-layoutDividerDark'></div>
                  </div>
                )}
              </li>
            ))}
        </ul>
      </div>
    </>
  )
}
