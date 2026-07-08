// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, InlineNotification, Avatar } from '../common'
import { Pagination } from '../common/Pagination'
import { debounce } from 'lodash'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getAnnouncementsFiltered, downloadMsg, PAGE_SIZE } from '../../lib/lines'
import {
  faPlay,
  faDownload,
  faTrash,
  faLock,
  faLockOpen,
  faChevronLeft,
  faAngleRight,
  faFilter,
} from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { AnnouncementFilter } from './AnnouncementFilter'
import { useDispatch, useSelector } from 'react-redux'
import { Dispatch, RootState } from '../../store'
import { capitalize } from 'lodash'
import {
  getApiEndpoint,
  getApiScheme,
  sortByProperty,
  playFileAudio,
  sortByDateAsc,
  sortByDateDesc,
} from '../../lib/utils'
import { openShowOperatorDrawer } from '../../lib/operators'
import { openEditAnnouncementDrawer, reloadAnnouncement } from '../../lib/lines'
import { useEventListener } from '../../lib/hooks/useEventListener'
import { CallsDate } from '../history/CallsDate'
import { Table } from '../common/Table'

export interface AnnouncementViewProps extends ComponentProps<'div'> {}

export const AnnouncementView: FC<AnnouncementViewProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const [lines, setLines]: any = useState({})
  const [isLinesLoaded, setLinesLoaded]: any = useState(false)
  const [linesError, setLinesError] = useState('')
  const [pageNum, setPageNum]: any = useState(1)
  const [firstRender, setFirstRender]: any = useState(true)
  const [textFilter, setTextFilter]: any = useState('')
  const [donwloadAudioMessageError, setDownloadAudioMessageError] = useState('')
  const reloadValue = useSelector((state: RootState) => state.announcement.reloadValue)

  const apiEnpoint = getApiEndpoint()
  const apiScheme = getApiScheme()
  const downloadUrl = apiScheme + apiEnpoint + '/api/static/'

  //Get operators information from store
  const operators: any = useSelector((state: RootState) => state.operators)
  const profile: any = useSelector((state: RootState) => state.user)

  const dispatch = useDispatch<Dispatch>()

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

  async function announcementSavedCallback() {
    dispatch.sideDrawer.setShown(false)
    // Reload announcements without affecting the current filter/sort state
    reloadAnnouncement()
  }

  // Show modal announcement
  useEventListener('phone-island-recording-saved', (data) => {
    if (data?.tempFileName) {
      dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'showSaveRecordedAnnouncement',
        config: {
          isEdit: false,
          recordedFilename: data.tempFileName,
          announcementSavedCallback: announcementSavedCallback,
        },
      })
    }
  })

  useEventListener('phone-island-physical-recording-saved', (data) => {
    if (data?.tempFileName) {
      dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'showSaveRecordedAnnouncement',
        config: {
          isEdit: false,
          recordedFilename: data.tempFileName,
          announcementSavedCallback: announcementSavedCallback,
        },
      })
      dispatch.sideDrawer.setAvoidClose(true)
    }
  })

  const [dataPagination, setDataPagination]: any = useState({})

  const [startPage, setStartPage]: any = useState(0)
  const [endPage, setEndPage]: any = useState(0)
  const [cleanLines, setCleanLines]: any = useState([])

  //Get Lines information
  useEffect(() => {
    async function fetchLines() {
      if (firstRender) {
        setFirstRender(false)
        return
      }
      if (!isLinesLoaded) {
        try {
          setLinesError('')
          const res = await getAnnouncementsFiltered(textFilter.trim(), pageNum)
          setLines(res?.rows)
          //use another state to keep the original lines (not paginated for sorting)
          setCleanLines(res?.rows)
          setStartPage(res?.start)
          setEndPage(res?.end)

          setDataPagination(res)
        } catch (e) {
          console.error(e)
          setLinesError(t('Lines.Cannot retrieve lines') || '')
        }
        setLinesLoaded(true)
      }
    }
    fetchLines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinesLoaded, firstRender, reloadValue])

  const announcement = useSelector((state: RootState) => state.announcement)

  useEffect(() => {
    // reload phonebook
    setLinesLoaded(false)
  }, [announcement])

  function goToPreviousPage() {
    if (pageNum > 1) {
      setPageNum(pageNum - 1)
      setLinesLoaded(false)
    }
  }

  function goToNextPage() {
    if (pageNum < dataPagination?.totalPages) {
      setPageNum(pageNum + 1)
      setLinesLoaded(false)
    }
  }

  async function donwloadSelectedAnnouncement(announcementId: any) {
    if (announcementId) {
      try {
        const res = await downloadMsg(announcementId)
        var link = document.createElement('a')
        link.download = res
        link.href = downloadUrl + res
        link.setAttribute('type', 'hidden')
        document.body.appendChild(link)
        link.click()
      } catch (error) {
        setDownloadAudioMessageError('Cannot download announcement')
        return
      }
    }
  }

  async function playSelectedAnnouncement(announcementId: any) {
    if (announcementId) {
      playFileAudio(announcementId, 'announcement')
    }
  }

  const [sortBy, setSortBy]: any = useState('name')
  const auth = useSelector((state: RootState) => state.authentication)

  const updateSortFilter = (newSortBy: string) => {
    setSortBy(newSortBy)
  }

  const paginateTable = (filteredLines: any) => {
    let newLinesPaginate = filteredLines?.slice(startPage, endPage)
    return newLinesPaginate
  }

  useEffect(() => {
    if (isLinesLoaded) {
      let newLines = null
      let filteredLinesPaginate = null
      switch (sortBy) {
        case 'username':
          newLines = Array.from(cleanLines).sort(sortByProperty('username'))
          filteredLinesPaginate = paginateTable(newLines)

          break
        case 'description':
          newLines = Array.from(cleanLines).sort(sortByProperty('description'))
          filteredLinesPaginate = paginateTable(newLines)
          break
        case 'desc':
          newLines = Array.from(cleanLines).sort(sortByDateDesc)
          filteredLinesPaginate = paginateTable(newLines)
          break
        case 'asc':
          newLines = Array.from(cleanLines).sort(sortByDateAsc)
          filteredLinesPaginate = paginateTable(newLines)

          break
        default:
          newLines = Array.from(cleanLines)
          filteredLinesPaginate = paginateTable(newLines)

          break
      }

      setLines(filteredLinesPaginate)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, isLinesLoaded])

  const columns = [
    {
      header: t('Lines.Name'),
      cell: (announcement: any) => (
        <div className='flex flex-col'>
          <div
            className={`${
              auth?.username === announcement?.username ? 'cursor-pointer hover:underline' : ''
            }`}
            onClick={() => {
              auth?.username === announcement?.username
                ? openEditAnnouncementDrawer(
                    announcement?.description,
                    announcement?.id,
                    announcement?.privacy,
                  )
                : ''
            }}
          >
            {announcement?.description}{' '}
          </div>
        </div>
      ),
      className:
        'py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6 text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Lines.Author'),
      cell: (announcement: any) => (
        <div className='flex items-center'>
          <Avatar
            src={operators?.avatars[announcement?.username]}
            placeholderType='operator'
            size='base'
            className='mr-3 cursor-pointer'
            onClick={() => openShowOperatorDrawer(operators?.operators[announcement?.username])}
            status={operators?.operators[announcement?.username]?.mainPresence}
            star={operators?.operators?.[announcement?.username]?.favorite}
          />
          <div>{operators?.operators[announcement?.username]?.name}</div>
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Lines.Creation date'),
      cell: (announcement: any) => (
        <div className='flex flex-col'>
          <CallsDate call={announcement} isInAnnouncement={true} />
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: t('Lines.Privacy'),
      cell: (announcement: any) => (
        <div className='flex items-center'>
          <FontAwesomeIcon
            icon={announcement.privacy === 'private' ? faLock : faLockOpen}
            className={`h-4 text-gray-500 dark:text-gray-500 ${
              announcement.privacy === 'private' ? 'mr-3' : 'mr-2'
            }`}
            aria-hidden='true'
          />
          <span>{t(`Lines.${capitalize(announcement.privacy)}`)}</span>
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-200',
    },
    {
      header: '',
      cell: (announcement: any) => (
        <div className='flex gap-2 justify-end items-center'>
          <div>
            <Button
              variant='white'
              onClick={() => playSelectedAnnouncement(announcement.id)}
              disabled={
                profile?.mainPresence === 'busy' || profile?.mainPresence === 'incoming'
                  ? true
                  : false
              }
            >
              <FontAwesomeIcon icon={faPlay} className='h-4 w-4 mr-2' aria-hidden='true' />{' '}
              {t('Lines.Play')}
            </Button>
          </div>
          <div>
            <Button variant='white' onClick={() => donwloadSelectedAnnouncement(announcement.id)}>
              <FontAwesomeIcon icon={faDownload} className='h-4 w-4 mr-2' aria-hidden='true' />{' '}
              {t('Lines.Download')}
            </Button>
          </div>
          {auth.username === announcement.username ? (
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faAngleRight}
                className='h-3 w-3 ml-4 cursor-pointer text-gray-500 dark:text-gray-500'
                aria-hidden='true'
                onClick={() => {
                  openEditAnnouncementDrawer(
                    announcement.description,
                    announcement.id,
                    announcement.privacy,
                  )
                }}
              />
            </div>
          ) : (
            <div className='w-[30px]'></div>
          )}
        </div>
      ),
      className: 'relative py-3.5 pl-3 pr-4 sm:pr-6',
    },
  ]

  const announcementsArray = isLinesLoaded ? Object.values(lines) : []

  return (
    <div className={classNames(className)}>
      <div className='flex-col flex-wrap xl:flex-row justify-between gap-x-4 xl:items-end'>
        <AnnouncementFilter
          updateTextFilter={debouncedUpdateTextFilter}
          updateSortFilter={updateSortFilter}
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
                  data={announcementsArray}
                  isLoading={!isLinesLoaded}
                  emptyState={{
                    title: t('Lines.No announcement'),
                    description: t('Lines.There are no announcement with current filter') || '',
                    icon: (
                      <FontAwesomeIcon
                        icon={faFilter}
                        className='mx-auto h-12 w-12'
                        aria-hidden='true'
                      />
                    ),
                  }}
                  rowKey={(announcement: any) => announcement.id}
                  trClassName='h-[84px]'
                  scrollable={true}
                  maxHeight='calc(100vh - 480px)'
                  theadClassName='sticky top-0 bg-gray-100 dark:bg-gray-800 z-[1]'
                  tbodyClassName='text-sm divide-y divide-gray-200 bg-white dark:bg-gray-950 text-gray-700 dark:divide-gray-700 dark:text-gray-200'
                />
              </div>
            </div>
          </div>

          {/* pagination */}
          {!linesError && isLinesLoaded && dataPagination?.count > 0 && (
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

AnnouncementView.displayName = 'AnnouncementView'
