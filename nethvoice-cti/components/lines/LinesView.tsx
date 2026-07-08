// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState, InlineNotification, Badge } from '../common'
import { isEmpty, debounce } from 'lodash'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  openShowPhoneLinesDrawer,
  retrieveLines,
  PAGE_SIZE,
  openEditMultipleLinesDrawer,
} from '../../lib/lines'
import {
  faAngleRight,
  faChevronLeft,
  faFilter,
  faVoicemail,
  faTurnDown,
} from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { LinesFilter } from './LinesFilter'
import { sortByProperty, customScrollbarClass } from '../../lib/utils'
import { store } from '../../store'
import { Table } from '../common/Table'
import { Pagination } from '../common/Pagination'

// Interface for lines structure
interface Line {
  calledIdNum: string
  callerIdNum: string
  destination: string
  description?: string
  offhour?: {
    calledIdNum: string
    callerIdNum: string
    action: string
    enabled: string
    period?: {
      datebegin: string
      dateend: string
    }
    audiomsg?: {
      announcement_id: number
      description: string
      privacy: string
      username: string
    }
    voicemail?: {
      voicemail_id: string
    }
    redirect?: {
      redirect_to: string
    }
  }
}

export interface LinesViewProps extends ComponentProps<'div'> {}

export const LinesView: FC<LinesViewProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const [lines, setLines]: any = useState({})
  const [isLinesLoaded, setLinesLoaded]: any = useState(false)
  const [linesError, setLinesError] = useState('')
  const [pageNum, setPageNum]: any = useState(1)
  const [firstRender, setFirstRender]: any = useState(true)
  const linesStore = useSelector((state: RootState) => state.lines)

  const [textFilter, setTextFilter]: any = useState('')
  const updateTextFilter = (newTextFilter: string) => {
    setTextFilter(newTextFilter)
    setLinesLoaded(false)
    setPageNum(1)
  }

  const debouncedUpdateTextFilter = useMemo(() => debounce(updateTextFilter, 400), [])

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter.cancel()
    }
  }, [debouncedUpdateTextFilter])

  const [dataPagination, setDataPagination]: any = useState({})
  //Get phone lines information
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    async function fetchLines() {
      if (!isLinesLoaded && !linesStore?.isLoading) {
        try {
          setLinesError('')
          const res = await retrieveLines(textFilter.trim(), pageNum, configurationType)

          setLines(res.rows)
          setDataPagination(res)
        } catch (e) {
          console.error(e)
          setLinesError(t('Lines.Cannot retrieve lines') || '')
        }
        store.dispatch.lines.setLoaded(true)
        setLinesLoaded(true)
        setSelectedLines([])
      }
    }
    fetchLines()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinesLoaded, pageNum, firstRender, linesStore?.isLoading])

  const phoneLines = useSelector((state: RootState) => state.phoneLines)

  useEffect(() => {
    // reload phone lines
    store.dispatch.lines.setLoaded(false)
    setLinesLoaded(false)
  }, [phoneLines])

  function goToPreviousPage() {
    if (pageNum > 1) {
      setPageNum(pageNum - 1)
      store.dispatch.lines.setLoaded(false)
      setLinesLoaded(false)
      setSelectedLines([])
    }
  }

  function goToNextPage() {
    if (pageNum < dataPagination.totalPages) {
      setPageNum(pageNum + 1)
      store.dispatch.lines.setLoaded(false)
      setLinesLoaded(false)
      setSelectedLines([])
    }
  }

  //set the default sort type
  const [sortBy, setSortBy]: any = useState('description')

  const updateSortFilter = (newSortBy: string) => {
    setSortBy(newSortBy)
  }

  //set the default configuration type
  const [configurationType, setConfigurationType]: any = useState('all')

  const updateConfigurationTypeFilter = (newConfigurationType: string) => {
    setConfigurationType(newConfigurationType)
    store.dispatch.lines.setLoaded(false)
    setLinesLoaded(false)
  }

  //check if the sort filter is changed
  // if it has changed check the type and reorder the object
  useEffect(() => {
    let newLines = null
    switch (sortBy) {
      case 'description':
        newLines = Array.from(lines).sort(sortByProperty('description'))
        break
      case 'calledIdNum':
        newLines = Array.from(lines).sort(sortByProperty('calledIdNum'))
        break
      default:
        newLines = Array.from(lines)
        break
    }
    setLines(newLines)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, isLinesLoaded])

  // Check which configuration will be shown
  function getConfiguration(configurationType: any) {
    if (
      configurationType.offhour &&
      configurationType.offhour.action &&
      configurationType.offhour.enabled &&
      configurationType.offhour.enabled !== 'never'
    ) {
      switch (configurationType.offhour.action) {
        case 'audiomsg':
          return (
            <>
              <div className='flex items-center'>
                <span>{t(`Lines.Announcement`)}</span>
              </div>
            </>
          )
        case 'audiomsg_voicemail':
          return (
            <>
              <div className='flex items-center'>
                <FontAwesomeIcon icon={faVoicemail} className='h-4 w-4 mr-2' aria-hidden='true' />
                <span>{t(`Lines.Announcement and voicemail`)}</span>
              </div>
            </>
          )
        case 'redirect':
          return (
            <>
              <div className='flex items-center'>
                <FontAwesomeIcon
                  icon={faTurnDown}
                  className='h-4 w-4 mr-2 rotate-[270deg]'
                  aria-hidden='true'
                />
                <span>{t(`Lines.Forward`)}</span>
              </div>
            </>
          )
        default:
          return (
            <>
              <div className='flex items-center'>
                <span>-</span>
              </div>
            </>
          )
      }
    } else {
      return (
        <>
          <div className='flex items-center'>
            <span>-</span>
          </div>
        </>
      )
    }
  }

  // Creation of the object to be sent to the drawer
  function checkObjectDrawer(lines: any) {
    let objConfigDrawer = {
      datebegin: null,
      dateend: null,
      enabled: false,
      name: null,
      number: null,
      callerNumber: null,
      action: '',
      redirect_to: null,
      announcement_id: null,
      voicemail_id: null,
      dateType: '',
      periodTypology: '',
    }
    if (lines) {
      // calledIdNum, description and callerIdNum no required check
      objConfigDrawer.name = lines.description
      objConfigDrawer.number = lines.calledIdNum
      objConfigDrawer.callerNumber = lines.callerIdNum

      if (lines.offhour) {
        // check if the configuration is enabled
        if (lines.offhour.enabled) {
          if (lines.offhour.enabled !== 'never' && lines.offhour.enabled !== undefined) {
            objConfigDrawer.enabled = true
          } else {
            objConfigDrawer.enabled = false
            objConfigDrawer.periodTypology = 'period'
            objConfigDrawer.dateType = 'specifyDay'
          }
        }
        //action can be 'audiomsg', 'audiomsg_voicemail' or 'redirect'
        objConfigDrawer.action = lines.offhour.action
        //lines.offhour.enabled can be 'never', 'always' or 'period'
        if (lines.offhour.enabled === 'period') {
          // set standard radio button for period equal to 'specifyDay'
          objConfigDrawer.periodTypology = 'period'
          objConfigDrawer.dateType = 'specifyDay'
          //set datebegin and dateend
          objConfigDrawer.datebegin = lines.offhour.period.datebegin
          objConfigDrawer.dateend = lines.offhour.period.dateend
        } else if (lines.offhour.enabled === 'always') {
          objConfigDrawer.periodTypology = 'always'
          objConfigDrawer.dateType = 'always'
        }
        // if action is equal to 'redirect' set input redirect_to
        if (
          lines.offhour.action === 'redirect' &&
          lines.offhour.redirect &&
          lines.offhour.redirect.redirect_to
        ) {
          objConfigDrawer.redirect_to = lines.offhour.redirect.redirect_to
        }
        // if action is equal to 'audiomsg' set input 'audiomsg_id'
        if (lines.offhour.action === 'audiomsg' && lines.offhour.audiomsg) {
          objConfigDrawer.announcement_id = lines.offhour.audiomsg.announcement_id
        }
        // if action is equal to 'audiomsg' set input 'audiomsg_id' and 'voicemail_id'
        if (
          lines.offhour.action === 'audiomsg_voicemail' &&
          lines.offhour.audiomsg &&
          lines.offhour.voicemail
        ) {
          objConfigDrawer.announcement_id = lines.offhour.audiomsg.announcement_id
          objConfigDrawer.voicemail_id = lines.offhour.voicemail.voicemail_id
        }
        // If offhour doesn't exist, set the date to always and the action to never to avoid empty radio button
      } else {
        objConfigDrawer.dateType = 'always'
        objConfigDrawer.action = 'audiomsg'
      }
    }
    openShowPhoneLinesDrawer(objConfigDrawer)
  }

  //Check if the configuration is activate or deactivate
  function getConfigurationStatus(lines: any) {
    if (lines.offhour && lines.offhour.enabled !== 'never') {
      return 'online'
    } else {
      return 'offline'
    }
  }

  // multiple selection table section

  const checkbox: any = useRef()
  const [checked, setChecked] = useState(false)
  const [indeterminate, setIndeterminate] = useState(false)
  const [selectedLines, setSelectedLines] = useState<Line[]>([])

  useEffect(() => {
    const isIndeterminate = selectedLines?.length > 0 && selectedLines?.length < lines?.length
    setChecked(selectedLines.length === lines?.length)
    setIndeterminate(isIndeterminate)
    if (lines.length > 0 && checkbox.current) {
      checkbox.current.indeterminate = isIndeterminate
    }
  }, [selectedLines, lines, linesStore?.isLoading])

  function toggleAllLines() {
    setSelectedLines(checked || indeterminate ? [] : lines)
    setChecked(!checked && !indeterminate)
    setIndeterminate(false)
  }

  const checkSelectedLines = (selectedLines: any) => {
    if (selectedLines.length === 1) {
      checkObjectDrawer(selectedLines[0])
    } else {
      openEditMultipleLinesDrawer(selectedLines)
    }
  }

  const columns = [
    {
      header: (
        <div className='relative w-full flex justify-center items-center py-3.5'>
          <input
            type='checkbox'
            className='h-4 w-4 rounded border-gray-300 text-primary dark:text-primaryDark focus:ring-primary dark:focus:ring-primaryDark'
            ref={checkbox}
            checked={checked}
            onChange={toggleAllLines}
          />
        </div>
      ),
      cell: (line: any) => (
        <div className='relative w-full flex justify-center items-center py-3.5'>
          <input
            type='checkbox'
            className='h-4 w-4 rounded border-gray-300 text-primary dark:text-primaryDark focus:ring-primary dark:focus:ring-primaryDark'
            value={line.calledIdNum}
            checked={selectedLines.includes(line)}
            onChange={(e) =>
              setSelectedLines(
                e.target.checked
                  ? [...selectedLines, line]
                  : selectedLines.filter((selectedLine) => selectedLine !== line),
              )
            }
          />
        </div>
      ),
      className: 'w-12',
    },
    {
      header:
        selectedLines?.length > 0 ? (
          <button
            type='button'
            className='inline-flex items-center rounded bg-white dark:bg-gray-600 px-2 py-1 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white dark:hover:bg-gray-500'
            onClick={() => {
              checkSelectedLines(selectedLines)
            }}
          >
            {selectedLines?.length === 1 ? t('Lines.Show selected') : t('Lines.Show all')}
          </button>
        ) : (
          t('Lines.Description')
        ),
      cell: (line: any) => (
        <div className='cursor-pointer' onClick={() => checkObjectDrawer(line)}>
          {line.description ? line.description : '-'}
        </div>
      ),
      className:
        'py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6 text-gray-700 dark:text-gray-200 min-w-[12rem]',
    },
    {
      header: t('Lines.Line number'),
      cell: (line: any) => (
        <div className='cursor-pointer' onClick={() => checkObjectDrawer(line)}>
          {line.calledIdNum ? line.calledIdNum : '-'}
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Lines.Caller number'),
      cell: (line: any) => (
        <div className='cursor-pointer' onClick={() => checkObjectDrawer(line)}>
          {line.callerIdNum ? line.callerIdNum : '-'}
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Lines.Custom configuration'),
      cell: (line: any) => (
        <div className='cursor-pointer whitespace-nowrap' onClick={() => checkObjectDrawer(line)}>
          {getConfiguration(line)}
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Lines.Configuration status'),
      cell: (line: any) => (
        <div className='cursor-pointer whitespace-nowrap' onClick={() => checkObjectDrawer(line)}>
          <Badge variant={getConfigurationStatus(line)} rounded='full'>
            {line.offhour && line.offhour.enabled !== 'never'
              ? t('Lines.Active')
              : t('Lines.Not active')}
          </Badge>
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: '',
      cell: (line: any) => (
        <div className='text-right cursor-pointer' onClick={() => checkObjectDrawer(line)}>
          <FontAwesomeIcon
            icon={faAngleRight}
            className='h-3 w-3 p-2 cursor-pointer text-gray-500 dark:text-gray-500'
            aria-hidden='true'
          />
        </div>
      ),
      className: 'relative py-3.5 pl-3 pr-4 sm:pr-3',
    },
  ]

  return (
    <div className={classNames(className)}>
      <div className='flex flex-col flex-wrap xl:flex-row justify-between gap-x-4 xl:items-end'>
        <LinesFilter
          updateTextFilter={debouncedUpdateTextFilter}
          updateSortFilter={updateSortFilter}
          updateConfigurationTypeFilter={updateConfigurationTypeFilter}
        />
      </div>
      {linesError && <InlineNotification type='error' title={linesError}></InlineNotification>}
      {!linesError && (
        <div className='mx-auto'>
          <div className='flex flex-col'>
            <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
              <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
                <Table
                  columns={columns}
                  data={lines}
                  isLoading={!isLinesLoaded}
                  emptyState={{
                    title: t('Lines.No lines'),
                    description: t('Lines.There are no lines with the current filter') || '',
                    icon: (
                      <FontAwesomeIcon
                        icon={faFilter}
                        className='mx-auto h-12 w-12'
                        aria-hidden='true'
                      />
                    ),
                  }}
                  rowKey={(line: any) =>
                    `${line.calledIdNum}_${line.callerIdNum || ''}_${line.description || ''}`
                  }
                  scrollable={true}
                  trClassName='h-[84px]'
                  maxHeight='calc(100vh - 480px)'
                  theadClassName='sticky top-0 bg-gray-100 dark:bg-gray-800 z-[1]'
                  tbodyClassName='text-sm divide-y divide-gray-200 bg-white dark:bg-gray-950 text-gray-700 dark:divide-gray-700 dark:text-gray-200'
                />
              </div>
            </div>
          </div>

          {!linesError && !!lines?.length && (
            <Pagination
              currentPage={pageNum}
              totalPages={dataPagination.totalPages}
              totalItems={dataPagination?.count || 0}
              pageSize={PAGE_SIZE}
              onPreviousPage={goToPreviousPage}
              onNextPage={goToNextPage}
              isLoading={!isLinesLoaded}
              itemsName={t('Lines.Lines') || ''}
            />
          )}
        </div>
      )}
    </div>
  )
}

LinesView.displayName = 'LinesView'
