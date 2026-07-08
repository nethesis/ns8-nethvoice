// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState, InlineNotification } from '../common'
import { isEmpty, debounce } from 'lodash'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { openShowPhoneLinesDrawer } from '../../lib/lines'
import { openShowRuleDetailsDrawer } from '../../lib/lines'
import { faPhone, faAngleRight } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { RulesFilter } from './RulesFilter'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

export interface RulesViewProps extends ComponentProps<'div'> {}

const table = [
  {
    name: 'Announcement 1',
    typology: 'Event',
    begin: '2022-05-12T09:00:00.000Z',
    end: '2022-05-12T12:00:00.000Z',
    activation: 'attiva',
  },
  {
    name: 'Announcement 2',
    typology: 'News',
    begin: '2022-06-01T00:00:00.000Z',
    end: '2022-06-30T23:59:59.999Z',
    activation: 'non attiva',
  },
  {
    name: 'Announcement 3',
    typology: 'Promotion',
    begin: '2022-07-15T12:00:00.000Z',
    end: '2022-08-15T12:00:00.000Z',
    activation: 'attiva',
  },
  {
    name: 'Announcement 4',
    typology: 'Sale',
    begin: '2022-09-01T00:00:00.000Z',
    end: '2022-09-08T23:59:59.999Z',
    activation: 'non attiva',
  },
]

export const RulesView: FC<RulesViewProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const [lines, setLines]: any = useState({})
  const [isLinesLoaded, setLinesLoaded]: any = useState(false)
  const [linesError, setLinesError] = useState('')
  const [pageNum, setPageNum]: any = useState(1)
  const [firstRender, setFirstRender]: any = useState(true)
  const [intervalId, setIntervalId]: any = useState(0)
  const queuesStore = useSelector((state: RootState) => state.queues)

  const [textFilter, setTextFilter]: any = useState('')
  const updateTextFilter = (newTextFilter: string) => {
    setTextFilter(newTextFilter)
    setPageNum(1)
  }

  const debouncedUpdateTextFilter = useMemo(() => debounce(updateTextFilter, 400), [])

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter.cancel()
    }
  }, [debouncedUpdateTextFilter])

  const deleteAnnouncement = (index: any) => {
  }

  const filterLinesTable = (lines: any) => {
    let limit = 10
    const filteredLinesTables = lines.filter((telephoneLines: any) => {
      return telephoneLines.name.toLowerCase().includes(textFilter)
    })
    return filteredLinesTables.slice(0, limit)
  }

  const filteredTable = filterLinesTable(table)

  return (
    <div className={classNames(className)}>
      {/* TO DO CHECK ON MOBILE DEVICE  */}
      <div className='flex-col flex-wrap xl:flex-row justify-between gap-x-4 xl:items-end'>
        <RulesFilter updateTextFilter={debouncedUpdateTextFilter} />
      </div>
      {linesError && <InlineNotification type='error' title={linesError}></InlineNotification>}
      {/* {!linesError && ( */}
      <div className='mx-auto'>
        <div className='flex flex-col overflow-hidden'>
          <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
            <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
              <div className='overflow-hidden shadow ring-1 md:rounded-lg ring-opacity-5 dark:ring-opacity-5 ring-gray-900 dark:ring-gray-100'>
                {/* empty state */}
                {isLinesLoaded && isEmpty(lines.rows) && (
                  <EmptyState
                    title={t('Lines.No lines')}
                    description={t('Lines.There are no lines with current filters') || ''}
                    icon={
                      <FontAwesomeIcon
                        icon={faPhone}
                        className='mx-auto h-12 w-12'
                        aria-hidden='true'
                      />
                    }
                    className='bg-white dark:bg-gray-900'
                  ></EmptyState>
                )}
                {/* {(!isLinesLoaded || !isEmpty(lines.rows)) && ( */}
                <table className='min-w-full divide-y divide-gray-300 dark:divide-gray-600'>
                  <thead className='bg-white dark:bg-gray-900'>
                    <tr>
                      <th
                        scope='col'
                        className='py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6 text-gray-700 dark:text-gray-200'
                      >
                        {t('Lines.Name')}
                      </th>
                      <th
                        scope='col'
                        className='px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200'
                      >
                        {t('Lines.Typology')}
                      </th>
                      <th
                        scope='col'
                        className='px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200'
                      >
                        {t('Lines.Begin')}
                      </th>
                      <th
                        scope='col'
                        className='px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200'
                      >
                        {t('Lines.End')}
                      </th>
                      <th
                        scope='col'
                        className='px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200'
                      >
                        {t('Lines.Activation')}
                      </th>
                      <th scope='col' className='relative py-3.5 pl-3 pr-4 sm:pr-6'>
                        <span className='sr-only'>{t('Lines.Delete')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className=' text-sm divide-y divide-gray-200 bg-white text-gray-700 dark:divide-gray-700 dark:bg-gray-900 dark:text-gray-200'>
                    {/* skeleton */}
                    {/* {!isLinesLoaded &&
                          Array.from(Array(5)).map((e, i) => (
                            <tr key={i}>
                              {Array.from(Array(5)).map((e, j) => (
                                <td key={j}>
                                  <div className='px-4 py-6'>
                                    <div className='animate-pulse h-5 rounded bg-gray-300 dark:bg-gray-600'></div>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))} */}
                    {/* lines */}
                    {/* {isLinesLoaded &&
                          lines?.rows?.map((call: any, index: number) => ( */}

                    {filteredTable.map((announcement: any, index: number) => (
                      <tr key={index}>
                        {/* Name */}
                        <td className='py-4 pl-4 pr-3 sm:pl-6'>
                          <div className='flex flex-col'>
                            <div>{announcement.name} </div>
                          </div>
                        </td>
                        {/* Typology */}
                        <td className='px-3 py-4'>
                          <div>{announcement.typology}</div>
                        </td>
                        {/* Begin */}
                        <td className='px-3 py-4'>
                          <div className='flex items-center'>
                            <span>{announcement.begin}</span>
                          </div>
                        </td>
                        {/* End */}
                        <td className='px-3 py-4'>
                          <div className='flex items-center'>
                            <span>{announcement.end}</span>
                          </div>
                        </td>
                        {/* Activation */}
                        <td className='px-3 py-4'>
                          <div className='flex items-center'>
                            <span>{announcement.activation}</span>
                          </div>
                        </td>
                        {/* show details */}
                        <td className='relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6'>
                          <FontAwesomeIcon
                            icon={faAngleRight}
                            className='h-3 w-3 p-2 cursor-pointer text-gray-500 dark:text-gray-500'
                            aria-hidden='true'
                            onClick={() => openShowRuleDetailsDrawer(announcement.name)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* )} */}
              </div>
            </div>
          </div>
        </div>
        {/* pagination */}
        {/* {!LinesError && !!lines?.rows?.length && (
            <nav
              className='flex items-center justify-between border-t px-0 py-4 mb-8 border-gray-100 dark:border-gray-800'
              aria-label='Pagination'
            >
              <div className='hidden sm:block'>
                <p className='text-sm text-gray-700 dark:text-gray-200'>
                  {t('Common.Showing')}{' '}
                  <span className='font-medium'>{PAGE_SIZE * (pageNum - 1) + 1}</span> -&nbsp;
                  <span className='font-medium'>
                    {PAGE_SIZE * (pageNum - 1) + PAGE_SIZE < lines?.count
                      ? PAGE_SIZE * (pageNum - 1) + PAGE_SIZE
                      : lines?.count}
                  </span>{' '}
                  {t('Common.of')} <span className='font-medium'>{lines?.count}</span>{' '}
                  {t('Queues.lines')}
                </p>
              </div>
              <div className='flex flex-1 justify-between sm:justify-end'>
                <Button
                  type='button'
                  variant='white'
                  disabled={isPreviousPageButtonDisabled()}
                  onClick={() => goToPreviousPage()}
                  className='flex items-center'
                >
                  <FontAwesomeIcon icon={faChevronLeft} className='mr-2 h-4 w-4' />
                  <span> {t('Common.Previous page')}</span>
                </Button>
                <Button
                  type='button'
                  variant='white'
                  className='ml-3 flex items-center'
                  disabled={isNextPageButtonDisabled()}
                  onClick={() => goToNextPage()}
                >
                  <span>{t('Common.Next page')}</span>
                  <FontAwesomeIcon icon={faAngleRight} className='ml-2 h-4 w-4' />
                </Button>
              </div>
            </nav>
          )} */}
      </div>
      {/* )} */}
    </div>
  )
}

RulesView.displayName = 'RulesView'
