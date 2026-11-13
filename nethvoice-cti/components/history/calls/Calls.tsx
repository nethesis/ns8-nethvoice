// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  faArrowUpRightFromSquare,
  faMagnifyingGlass,
  faPhone,
  faArrowRight,
  faDownload,
  faTrash,
  faFileLines,
  faVoicemail,
  faChevronDown,
  faChevronUp,
  faUsers,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { t } from 'i18next'
import { FC, ComponentProps, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  DEFAULT_CONTENT_FILTER,
  DEFAULT_CALL_DIRECTION_FILTER,
  DEFAULT_CALL_TYPE_FILTER,
  DEFAULT_QUEUE_FILTER,
  DEFAULT_SORT_BY,
  deleteRec,
  downloadCallRec,
  getFilterValues,
  getHistoryQueues,
  hasVoicemailMessage,
  openDrawerHistory,
  search,
} from '../../../lib/history'
import { PAGE_SIZE } from '../../../lib/queuesLib'
import { subDays, startOfDay } from 'date-fns'
import { useEventListener } from '../../../lib/hooks/useEventListener'
import { InlineNotification, Dropdown, Button } from '../../common'
import { MissingPermission } from '../../common/MissingPermissionsPage'
import { CallsDate } from '../CallsDate'
import { Filter } from './Filter'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, Dispatch } from '../../../store'
import { CustomThemedTooltip } from '../../common/CustomThemedTooltip'
import {
  getApiVoiceEndpoint,
  getApiScheme,
  getApiEndpoint,
  playFileAudio,
} from '../../../lib/utils'
import { debounce } from 'lodash'
import { formatDateLoc } from '../../../lib/dateTime'
import Link from 'next/link'
import { CallStatus } from './CallStatus'
import { CallSource } from './CallSource'
import { CallDestination } from './CallDestination'
import { CallDuration } from './CallDuration'
import { CallRecording } from './CallRecording'
import { Pagination } from '../../common/Pagination'
import { Table } from '../../common/Table'
import { checkSummaryList } from '../../../services/user'
import { Skeleton, TableSkeleton } from '../../common/Skeleton'
import { useRouter } from 'next/router'

export interface CallsProps extends ComponentProps<'div'> {}

// Stable empty list, so a page with no rows yet does not hand the memo below a
// new array reference on every render.
const NO_ROWS: any[] = []

export const Calls: FC<CallsProps> = ({ className }): JSX.Element => {
  const dispatch = useDispatch<Dispatch>()
  const router = useRouter()
  const { operators } = useSelector((state: RootState) => state.operators)
  const { profile } = useSelector((state: RootState) => state.user)
  const { name, mainextension, feature_codes } = useSelector((state: RootState) => state.user)
  // The code in use, the default until the feature codes arrive: the history is
  // fetched again only if the PBX uses another one, not when they arrive.
  const audioTestCode = feature_codes?.audio_test || '*41'
  const authenticationStore = useSelector((state: RootState) => state.authentication)
  const lastCallsUpdate = useSelector((state: RootState) => state.lastCalls)
  const { username } = authenticationStore

  const [historyError, setHistoryError] = useState('')
  // incremented by the "Reset filters" button of the empty state
  const [resetFiltersTrigger, setResetFiltersTrigger] = useState(0)
  const [isHistoryLoaded, setHistoryLoaded] = useState(false)
  const [isLoadingPagination, setIsLoadingPagination] = useState(false)
  const [history, setHistory]: any = useState({})
  const [pageNum, setPageNum]: any = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [filterText, setFilterText]: any = useState('')
  const [callType, setCallType]: any = useState('user')
  const [sortBy, setSortBy]: any = useState('time%20desc')
  const [contentFilter, setContentFilter]: any = useState(DEFAULT_CONTENT_FILTER)
  const [queueFilter, setQueueFilter]: any = useState(DEFAULT_QUEUE_FILTER)
  const [availableQueues, setAvailableQueues] = useState<{ queue: string; name?: string }[]>([])
  const [dateEnd, setDateEnd]: any = useState('')
  const [dateBegin, setDateBegin]: any = useState('')
  const [callDirection, setCallDirection]: any = useState('all')
  const [areFiltersInitialized, setAreFiltersInitialized] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [summaryStatusMap, setSummaryStatusMap] = useState<Record<string, any>>({})
  // Extra conversations the user took part in (e.g. the consultation leg of a
  // transfer) that are not a directly-requested history row. Rendered as their
  // own conversation rows. Keyed by transcript id, not uniqueid (which they may
  // share with the main leg).
  const [extraConversations, setExtraConversations] = useState<any[]>([])
  const [isLoadingSummaryStatus, setIsLoadingSummaryStatus] = useState(false)
  const [handledSummaryLinkedId, setHandledSummaryLinkedId] = useState<string | null>(null)
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0)
  const historyRefreshTimeoutsRef = useRef<number[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = (linkedid: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(linkedid)) {
        next.delete(linkedid)
      } else {
        next.add(linkedid)
      }
      return next
    })
  }

  useEffect(() => {
    setExpandedRows(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pageNum,
    pageSize,
    callType,
    callDirection,
    sortBy,
    contentFilter,
    dateBegin,
    dateEnd,
    filterText,
    historyRefreshToken,
  ])

  const apiVoiceEnpoint = getApiVoiceEndpoint()
  const apiScheme = getApiScheme()
  const apiEndpoint = getApiEndpoint()

  //report page link
  const pbxReportUrl = apiScheme + apiVoiceEnpoint + '/pbx-report/'
  // URL for the recording file
  const recordingUrlPath = apiScheme + apiEndpoint + '/api/static/'

  const DateFromNotConverted = startOfDay(subDays(new Date(), 7))
  const dateFrom: any = formatDateLoc(DateFromNotConverted, 'yyyy-MM-dd')
  const dateTo: any = formatDateLoc(new Date(), 'yyyy-MM-dd')
  const checkDateType = new RegExp(/-/, 'g')

  useEffect(() => {
    if (!username) {
      return
    }

    const filterValues = getFilterValues(username)
    setCallType(filterValues.callType || DEFAULT_CALL_TYPE_FILTER)
    setCallDirection(filterValues.callDirection || DEFAULT_CALL_DIRECTION_FILTER)
    setSortBy(filterValues.sortBy || DEFAULT_SORT_BY)
    setContentFilter(filterValues.contentFilter || DEFAULT_CONTENT_FILTER)
    setQueueFilter(filterValues.queue || DEFAULT_QUEUE_FILTER)
    setAreFiltersInitialized(true)
  }, [username])

  useEffect(() => {
    let isMounted = true

    async function fetchHistoryQueues() {
      if (
        !username ||
        !/^[0-9]{8}([0-9]{4})?$/.test(dateBegin) ||
        !/^[0-9]{8}([0-9]{4})?$/.test(dateEnd)
      ) {
        return
      }

      try {
        const queues = await getHistoryQueues(username, dateBegin, dateEnd)
        if (isMounted) {
          setAvailableQueues(Array.isArray(queues) ? queues : [])
        }
      } catch {
        if (isMounted) {
          setAvailableQueues([])
        }
      }
    }

    fetchHistoryQueues()

    return () => {
      isMounted = false
    }
  }, [username, dateBegin, dateEnd])

  const clearSummaryLinkedIdQuery = useCallback(() => {
    if (!router.isReady || !router.query.summaryLinkedid) {
      return
    }

    const nextQuery = { ...router.query }
    delete nextQuery.summaryLinkedid
    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    )
  }, [router])

  const openSummaryDrawerByCall = useCallback(
    (call: any, summaryStatus?: any) => {
      const uniqueid = summaryStatus?.uniqueid ?? call?.uniqueid
      const linkedid = call?.linkedid

      if (!uniqueid || !linkedid) {
        return
      }

      dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'callSummary',
        config: {
          uniqueid,
          linkedid,
          // Exact transcript row id, so the drawer loads this specific
          // conversation when several share a uniqueid (transfer legs).
          id: summaryStatus?.id ?? call?.transcriptId,
          isSummary: summaryStatus?.has_summary || false,
          // Switchboard supervisors are not call participants: tell the API to
          // authorize the drawer fetch by capability instead of membership.
          switchboard: callType === 'switchboard',
        },
      })
    },
    [dispatch, callType],
  )

  const openVoicemailInboxByMessageId = useCallback(
    (voicemailMessageId: string) => {
      if (!voicemailMessageId) {
        return
      }

      dispatch.voicemail.setSelectedVoicemailId(voicemailMessageId)
    },
    [dispatch],
  )

  useEffect(() => {
    const summaryLinkedId = router.query.summaryLinkedid as string | undefined

    if (!router.isReady || !summaryLinkedId || handledSummaryLinkedId === summaryLinkedId) {
      return
    }

    let isMounted = true

    const openSummaryFromQuery = async () => {
      try {
        const response = await checkSummaryList([{ linkedid: summaryLinkedId }])
        const summaryStatus = response?.data?.find((item: any) => item?.linkedid === summaryLinkedId)

        if (!isMounted) {
          return
        }

        if (!summaryStatus || summaryStatus?.error || summaryStatus?.state !== 'done') {
          return
        }

        openSummaryDrawerByCall(
          { linkedid: summaryLinkedId, uniqueid: summaryStatus?.uniqueid },
          summaryStatus,
        )
        setHandledSummaryLinkedId(summaryLinkedId)
        clearSummaryLinkedIdQuery()
      } catch (error) {
        console.error('Error opening summary from query:', error)
      }
    }

    openSummaryFromQuery()

    return () => {
      isMounted = false
    }
  }, [router, handledSummaryLinkedId, openSummaryDrawerByCall, clearSummaryLinkedIdQuery])

  useEffect(() => {
    return () => {
      historyRefreshTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      historyRefreshTimeoutsRef.current = []
    }
  }, [])

  const scheduleHistoryRefresh = useCallback((delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      setHistoryRefreshToken((current) => current + 1)
      historyRefreshTimeoutsRef.current = historyRefreshTimeoutsRef.current.filter(
        (storedTimeoutId) => storedTimeoutId !== timeoutId,
      )
    }, delayMs)

    historyRefreshTimeoutsRef.current.push(timeoutId)
  }, [])

  useEffect(() => {
    if (!lastCallsUpdate.isReload) {
      return
    }

    setHistoryLoaded(false)
    scheduleHistoryRefresh(1500)
    scheduleHistoryRefresh(5000)
  }, [lastCallsUpdate.isReload, scheduleHistoryRefresh])

  useEffect(() => {
    if (!dateBegin) {
      return setDateBegin(dateFrom.replace(/-/g, ''))
    } else {
      setDateBegin(dateBegin.replace(/-/g, ''))
    }
  }, [dateBegin, dateFrom])

  useEffect(() => {
    if (!dateEnd) {
      return setDateEnd(dateTo.replace(/-/g, ''))
    } else {
      setDateEnd(dateEnd.replace(/-/g, ''))
    }
  }, [dateTo, dateEnd])

  //Get the history of the user
  useEffect(() => {
    // Guard against out-of-order responses: when a filter (callType, direction, …)
    // changes while a request is still in flight, the stale response must NOT win.
    // Without this, switching from personal to switchboard while the personal
    // request is slow lets the personal result land and populate the grid even
    // though switchboard is now selected. `ignore` is flipped by the cleanup so
    // only the latest effect run applies its result.
    let ignore = false
    async function fetchHistory() {
      if (
        areFiltersInitialized &&
        dateBegin &&
        !checkDateType.test(dateBegin) &&
        dateEnd &&
        !checkDateType.test(dateEnd) &&
        !(callType === 'user' && callDirection === 'internal')
      ) {
        try {
          setHistoryError('')
          setIsLoadingPagination(true)
          const res = await search(
            callType,
            username,
            dateBegin,
            dateEnd,
            filterText,
            sortBy,
            callDirection,
            pageNum,
            pageSize,
            contentFilter,
            queueFilter,
            audioTestCode,
          )
          if (ignore) return
          setHistory(res)
          setHistoryLoaded(true)
        } catch (e) {
          if (ignore) return
          setHistoryError('Cannot retrieve history')
          setHistoryLoaded(true)
        } finally {
          if (!ignore) setIsLoadingPagination(false)
        }
      }
    }

    // Always start a fresh fetch when a dependency changes. We no longer gate on
    // !isLoadingPagination (which used to DROP a fetch while another was running,
    // e.g. a switchboard switch requested during a slow personal load never fired);
    // the `ignore` guard makes concurrent fetches safe by keeping only the latest.
    if (areFiltersInitialized) {
      setHistoryLoaded(false)
      fetchHistory()
    }
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    areFiltersInitialized,
    callType,
    username,
    dateBegin,
    dateEnd,
    filterText,
    pageNum,
    pageSize,
    sortBy,
    callDirection,
    contentFilter,
    historyRefreshToken,
    queueFilter,
    // The audio-test code arrives from its own request, so it is null on the first
    // fetch and the server is asked to filter the default *41. Without this the
    // fetch never repeats once the real code lands, and a PBX that changed it
    // would fall back to filtering the echo calls client-side — which shortens
    // pages, the very thing the server-side filter was added to fix. It is the code
    // in use, default included, so a PBX on *41 is not asked for the page twice.
    audioTestCode,
  ])

  // Function to load summary status for current page calls
  // Read inside loadSummaryStatus instead of captured, so the callback's identity
  // depends on the fetched page alone and the effect below needs no dependency
  // exception — while still never running against a stale view.
  const callTypeRef = useRef(callType)
  callTypeRef.current = callType

  const loadSummaryStatus = useCallback(async () => {
    if (!history?.rows || history?.rows?.length === 0) {
      return
    }

    const lookups = history.rows
      .map((call: any) => ({
        uniqueid: call?.uniqueid,
        linkedid: call?.linkedid,
      }))
      .filter((lookup: any) => lookup?.uniqueid || lookup?.linkedid)

    if (lookups.length === 0) {
      return
    }

    try {
      setIsLoadingSummaryStatus(true)

      const response = await checkSummaryList(lookups, callTypeRef.current === 'switchboard')

      if (response?.data && Array.isArray(response?.data)) {
        const statusMap: Record<string, any> = {}
        const extras: any[] = []
        response.data.forEach((item: any) => {
          if (item?.error) {
            return
          }
          if (item?.extra) {
            // A conversation the user joined that is not the requested row
            // (transfer consultation leg): rendered as its own row.
            extras.push(item)
          } else if (item?.uniqueid) {
            statusMap[item.uniqueid] = item
            // Also key by linkedid: after grouping, a parent row's uniqueid is the
            // answered leg, not the call/transcript uniqueid — but its linkedid
            // matches, so the summary can still be resolved. A call's linkedid IS
            // the uniqueid of its first leg, so this must never overwrite an entry
            // already keyed by a leg's own uniqueid: that leg's row would then
            // resolve whichever conversation happened to come last in the response.
            if (item?.linkedid && !statusMap[item.linkedid]) {
              statusMap[item.linkedid] = item
            }
          }
        })

        setSummaryStatusMap(statusMap)
        setExtraConversations(extras)
      }
    } catch (error) {
      console.error('Error loading summary status:', error)
    } finally {
      setIsLoadingSummaryStatus(false)
    }
  }, [history?.rows])

  // Load summary status once per fetched page. Trigger only on the fetched data
  // (history.rows), not on pageNum + the loadSummaryStatus identity: pageNum
  // changed first (stale history) and then history.rows updated, firing this
  // twice — one /statuses call with the previous page's ids and one with the new.
  useEffect(() => {
    if (history?.rows?.length) {
      loadSummaryStatus()
    }
  }, [loadSummaryStatus, history?.rows])

  // Reload summary status when phone-island-summary-ready event is received
  useEventListener('phone-island-summary-ready', () => {
    loadSummaryStatus()
  })

  // Poll for summary status updates if any call is summarizing/in progress
  useEffect(() => {
    // Check if any call has state 'summarizing' or 'progress'
    const hasCallInProgress = Object.values(summaryStatusMap).some(
      (status: any) => status?.state === 'summarizing' || status?.state === 'progress',
    )

    if (!hasCallInProgress) {
      return
    }

    // Set up polling interval
    const pollInterval = setInterval(() => {
      loadSummaryStatus()
    }, 10000)

    // Cleanup interval on unmount or when hasCallInProgress changes
    return () => {
      clearInterval(pollInterval)
    }
  }, [summaryStatusMap, loadSummaryStatus])

  //Calculate the total pages of the history
  useEffect(() => {
    if (history?.count) {
      setTotalPages(Math?.ceil(history?.count / pageSize))
    }
  }, [history?.count, pageSize])

  async function playSelectedAudioFile(callId: any) {
    if (callId) {
      playFileAudio(callId, 'call_recording')
    }
  }

  function openTranscriptionDrawer(call: any) {
    const summaryStatus = call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid] ?? summaryStatusMap?.[call?.linkedid]
    openSummaryDrawerByCall(call, summaryStatus)
  }

  const downloadRecordingFileAudio = async (callIdInformation: any) => {
    if (callIdInformation !== '') {
      try {
        let fileName = await downloadCallRec(callIdInformation)

        // Get the file URL
        const fileUrl = `${recordingUrlPath + fileName}`

        const link = document.createElement('a')
        link.href = fileUrl
        link.download = fileName
        link.click()
      } catch {
      }
    }
  }

  const deleteRecordingAudioFile = async (callIdInformation: string) => {
    if (callIdInformation !== '') {
      try {
        await deleteRec(callIdInformation)
        // reload the history by resetting the loading state
        setHistoryLoaded(false)
      } catch {
      }
    }
  }

  // TODO: Re-enable summary/transcription deletion when the server-side implementation is available.
  // const deleteSummaryTranscription = async (linkedId: string) => {
  //   if (linkedId !== '') {
  //     try {
  //       await deleteSummary(linkedId)
  //       loadSummaryStatus()
  //     } catch (err) {
  //       console.error('Error deleting summary/transcription:', err)
  //     }
  //   }
  // }

  // Dropdown actions for the recording file
  const getRecordingActions = (callId: string) => (
    <>
      <div className='border-b border-divider dark:border-dividerDark'>
        <Dropdown.Item icon={faDownload} onClick={() => downloadRecordingFileAudio(callId)}>
          <span className='text-dropdownText dark:text-dropdownTextDark'>
            {t('Common.Download')}
          </span>
        </Dropdown.Item>
      </div>
      <Dropdown.Item icon={faTrash} isRed onClick={() => deleteRecordingAudioFile(callId)}>
        <span>{t('Common.Delete')}</span>
      </Dropdown.Item>
    </>
  )

  // Combined actions for recording and summary/transcription
  const getCallActions = (call: any) => {
    const linkedId = call?.linkedid
    // Resolve the summary the same way the row icon does: the row's own status
    // (set by the switchboard overlay) first, then by uniqueid, then linkedid.
    // Otherwise the kebab menu can be empty even when the summary icon is shown.
    const summaryStatus =
      call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid] ?? summaryStatusMap?.[linkedId]
    const hasRecording = call?.recordingfile
    const hasSummary = summaryStatus?.has_summary
    const hasTranscription = summaryStatus?.has_transcription
    // 'failed' keeps the transcription when only the AI summary step failed
    const showSummaryActions =
      (summaryStatus?.state === 'done' || summaryStatus?.state === 'failed') &&
      (hasSummary || hasTranscription)

    return (
      <>
        {/* View/Download actions - in black */}
        {showSummaryActions && (
          <Dropdown.Item icon={faFileLines} onClick={() => openTranscriptionDrawer(call)}>
            <span className='text-dropdownText dark:text-dropdownTextDark'>
              {hasSummary
                ? t('Common.View summary') || 'View summary'
                : t('Common.View transcription') || 'View transcription'}
            </span>
          </Dropdown.Item>
        )}

        {hasRecording && (
          <Dropdown.Item
            icon={faDownload}
            onClick={() => downloadRecordingFileAudio(call?.uniqueid)}
          >
            <span className='text-dropdownText dark:text-dropdownTextDark'>
              {t('Common.Download')}
            </span>
          </Dropdown.Item>
        )}

        {/* Divider before delete actions */}
        {(hasRecording || showSummaryActions) && (
          <div className='border-b border-divider dark:border-dividerDark' />
        )}

        {/* Delete actions - in red */}
        {hasRecording && (
          <Dropdown.Item
            icon={faTrash}
            isRed
            onClick={() => deleteRecordingAudioFile(call.uniqueid)}
          >
            <span>{t('History.Delete recording')}</span>
          </Dropdown.Item>
        )}

        {/* TODO: Re-enable summary/transcription deletion when the server-side implementation is available. */}
        {/* {showSummaryActions && (
          <Dropdown.Item icon={faTrash} isRed onClick={() => deleteSummaryTranscription(linkedId)}>
            <span>
              {hasSummary
                ? t('History.Delete call summary') || 'Delete call summary'
                : t('History.Delete call transcription') || 'Delete call transcription'}
            </span>
          </Dropdown.Item>
        )} */}
      </>
    )
  }

  const updateFilterText = (newFilterText: string) => {
    setPageNum(1)
    setFilterText(newFilterText)
  }

  const updateCallTypeFilter = (newCallType: string) => {
    setPageNum(1)
    setCallType(newCallType)
  }

  const updateCallDirectionFilter = (newCallDirection: string) => {
    setPageNum(1)
    setCallDirection(newCallDirection)
  }

  const updateDateBeginFilter = (newDateBegin: string) => {
    setDateBegin(newDateBegin)
  }

  const updateDateEndFilter = (newDateEnd: string) => {
    setDateEnd(newDateEnd)
  }

  const updateSortFilter = (newSortBy: string) => {
    setSortBy(newSortBy)
  }

  const updateQueueFilter = (newQueue: string) => {
    setPageNum(1)
    setQueueFilter(newQueue)
  }

  function goToPreviousPage() {
    if (pageNum > 1 && !isLoadingPagination) {
      setPageNum(pageNum - 1)
    }
  }

  function goToNextPage() {
    if (pageNum < totalPages && !isLoadingPagination) {
      setPageNum(pageNum + 1)
    }
  }

  const debouncedUpdateFilterText = useMemo(() => debounce(updateFilterText, 400), [])
  const isProfileLoading = typeof profile?.macro_permissions?.cdr?.value === 'undefined'

  // Stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateFilterText.cancel()
    }
  }, [debouncedUpdateFilterText])

  // Audio-test (echo, *41) calls are now filtered server-side by the middleware
  // The rows arrive ready to display: the middleware filters the audio-test
  // (echo) calls server-side, so pages come back full, and groups a call's legs
  // into one expandable row.
  //
  // The echo filter is repeated here as a safety net: an older middleware ignores
  // the audioTest parameter and returns those calls with no error of any kind,
  // and dropping the few rows it missed is cheaper than showing them. Against a
  // middleware that honours the parameter this removes nothing.
  const filteredHistory = useMemo(() => {
    const rows = history?.rows
    if (!rows?.length) {
      return NO_ROWS
    }
    return rows.filter((call: any) => {
      const numberToCheck = call?.direction === 'in' ? call?.src : call?.dst
      return !numberToCheck?.includes(audioTestCode)
    })
  }, [history?.rows, audioTestCode])

  // Merge in the extra conversations the user took part in (e.g. the transfer
  // consultation leg) as their own rows, placed next to the related call.
  const displayRows = useMemo(() => {
    // Switchboard (supervisor) view: render one clean row per real conversation
    // of each call (taken from the transcript), replacing the raw CDR legs —
    // which for transfers include technical/duplicated rows with wrong parties.
    // Calls with no transcript keep their original CDR row so nothing vanishes.
    if (callType === 'switchboard') {
      // Switchboard shows one row per call (linkedid) — the middleware's collapsed
      // parent — with the legs as expandable interactions. Enrich each parent with
      // its primary transcript conversation so the parties are clean (who actually
      // talked, not a technical "s"/routing leg) and the summary/transcript icon
      // resolves. A page still holds pageSize calls.
      const txByLinked = new Map<string, any[]>()
      // summaryStatusMap holds each item under both its uniqueid and its linkedid,
      // so the same conversation arrives twice: keep one entry per id.
      const seenTx = new Set<string>()
      const addTx = (item: any) => {
        if (!item?.linkedid) {
          return
        }
        const key = String(item?.id ?? `${item.linkedid}-${item?.uniqueid}`)
        if (seenTx.has(key)) {
          return
        }
        seenTx.add(key)
        const arr = txByLinked.get(item.linkedid) || []
        arr.push(item)
        txByLinked.set(item.linkedid, arr)
      }
      Object.values(summaryStatusMap || {}).forEach(addTx)
      ;(extraConversations || []).forEach(addTx)

      return filteredHistory.map((row: any) => {
        const txs = txByLinked.get(row?.linkedid)
        if (!txs || txs.length === 0) {
          return row
        }
        // The primary conversation is the longest one (the actual answered talk):
        // it carries the transcript/summary this row must open.
        const primary = [...txs].sort(
          (a: any, b: any) => (Number(b?.duration_seconds) || 0) - (Number(a?.duration_seconds) || 0),
        )[0]
        // Only the transcript is taken from here. The parties are NOT: the
        // middleware already resolves who actually talked from the call's legs
        // (final recipient, original caller, transfers), and overwriting them with
        // the transcript's numbers silently replaced that with whichever segment
        // happened to be the longest.
        return {
          ...row,
          summaryStatus: primary,
          transcriptId: primary?.id,
        }
      })
    }
    if (!extraConversations || extraConversations.length === 0) {
      return filteredHistory
    }

    const result: any[] = [...filteredHistory]

    extraConversations.forEach((conv: any) => {
      const related = filteredHistory.find((c: any) => c?.linkedid === conv?.linkedid)
      // Only place an extra conversation next to its call on the current page.
      // No related row (e.g. stale extras during a page change) → skip, never
      // emit an orphan row with no timestamp (would crash the date cell).
      if (!related) {
        return
      }
      const isOut = !!mainextension && conv?.src_number === mainextension
      const isIn = !!mainextension && conv?.dst_number === mainextension
      const direction = isOut ? 'out' : isIn ? 'in' : related?.direction || 'in'

      // Borrow the duration/disposition from the CDR leg whose parties include BOTH
      // conversation parties (e.g. a transfer consultation leg recorded over a Local
      // channel has no own CDR row for this user, so without this it would render as
      // 00:00:00). Prefer ANSWERED + longest. Mirrors the switchboard path above.
      const normNum = (v: any) => (v ?? '').toString().trim()
      const convSrc = normNum(conv?.src_number)
      const convDst = normNum(conv?.dst_number)
      const timedLeg = filteredHistory
        .filter((leg: any) => {
          if (leg?.linkedid !== conv?.linkedid) {
            return false
          }
          const parties = [normNum(leg?.src), normNum(leg?.dst), normNum(leg?.cnum)]
          return convSrc && convDst && parties.includes(convSrc) && parties.includes(convDst)
        })
        .sort(
          (x: any, y: any) =>
            (y?.disposition === 'ANSWERED' ? 1 : 0) - (x?.disposition === 'ANSWERED' ? 1 : 0) ||
            (Number(y?.duration) || 0) - (Number(x?.duration) || 0),
        )[0]

      const syntheticRow = {
        uniqueid: conv?.uniqueid,
        linkedid: conv?.linkedid,
        id: conv?.id,
        src: conv?.src_number || '',
        dst: conv?.dst_number || '',
        cnum: conv?.src_number || '',
        cnam: '',
        ccompany: '',
        dst_cnam: '',
        dst_ccompany: '',
        clid: '',
        direction,
        disposition: timedLeg?.disposition || 'ANSWERED',
        time: timedLeg?.time ?? related?.time,
        // Prefer the satellite per-segment duration (authoritative for transfer
        // sub-legs that own no CDR row for this user); fall back to a CDR leg that
        // includes both parties, then 0.
        duration:
          Number(conv?.duration_seconds) > 0
            ? Number(conv?.duration_seconds)
            : Number(timedLeg?.duration) || 0,
        billsec:
          Number(conv?.duration_seconds) > 0
            ? Number(conv?.duration_seconds)
            : Number(timedLeg?.billsec) || 0,
        channel: timedLeg?.channel || '',
        dstchannel: timedLeg?.dstchannel || '',
        recordingfile: timedLeg?.recordingfile || '',
        has_voicemail_message: false,
        voicemail_message_id: '',
        // markers used by the cells to render this transcript-only conversation
        isConversationRow: true,
        summaryStatus: conv,
        transcriptId: conv?.id,
      }

      const insertAt = result.findIndex(
        (c: any) => c?.uniqueid === related?.uniqueid && c?.linkedid === related?.linkedid,
      )
      if (insertAt >= 0) {
        result.splice(insertAt + 1, 0, syntheticRow)
      } else {
        result.push(syntheticRow)
      }
    })

    // Collapse rows that resolve to the SAME transcript conversation. A transfer
    // produces several CDR legs for one conversation (e.g. 201's two legs both
    // map to the cell<->201 transcript): show that conversation once. Among
    // duplicates keep the row whose parties match the transcript. Rows without a
    // transcript (plain/untranscribed calls) are never collapsed.
    const txIndex = new Map<number, number>()
    const deduped: any[] = []
    result.forEach((row: any) => {
      const status = row?.summaryStatus ?? summaryStatusMap?.[row?.uniqueid]
      const txId = row?.transcriptId ?? status?.id
      if (!txId) {
        deduped.push(row)
        return
      }
      if (!txIndex.has(txId)) {
        txIndex.set(txId, deduped.length)
        deduped.push(row)
        return
      }
      const existingIdx = txIndex.get(txId) as number
      const existing = deduped[existingIdx]
      const existingStatus = existing?.summaryStatus ?? summaryStatusMap?.[existing?.uniqueid]
      const rowMatches = status && row?.src === status?.src_number && row?.dst === status?.dst_number
      const existingMatches =
        existingStatus &&
        existing?.src === existingStatus?.src_number &&
        existing?.dst === existingStatus?.dst_number
      if (rowMatches && !existingMatches) {
        deduped[existingIdx] = row
      }
    })

    return deduped
  }, [filteredHistory, extraConversations, mainextension, summaryStatusMap, callType])

  const rowsWithInteractions = useMemo(() => {
    if (!expandedRows.size) {
      return displayRows
    }
    const out: any[] = []
    displayRows.forEach((row: any) => {
      out.push(row)
      if (
        row?.interactionsCount > 1 &&
        expandedRows.has(row?.linkedid) &&
        Array.isArray(row?.interactions)
      ) {
        row.interactions.forEach((leg: any, i: number) => {
          out.push({
            ...leg,
            isInteractionRow: true,
            isLastInteraction: i === row.interactions.length - 1,
            parentLinkedid: row.linkedid,
            _interactionIndex: i,
            // The marker belongs to the whole call: a member leg carries no queue or
            // group name of its own, so it inherits the parent's.
            queueName: leg?.queueName ?? row?.queueName,
            queueNum: leg?.queueNum ?? row?.queueNum,
            ringGroupName: leg?.ringGroupName ?? row?.ringGroupName,
          })
        })
      }
    })
    return out
  }, [displayRows, expandedRows])

  // Definition of the columns of the table
  const columns = [
    {
      header: '',
      cell: (call: any) => {
        if (call?.isInteractionRow || !(call?.interactionsCount > 1)) {
          return null
        }
        const isOpen = expandedRows.has(call?.linkedid)
        return (
          <button
            type='button'
            // The `?? ''` is for typing, not truthiness: t() is declared as possibly
            // undefined here, and aria-label takes a string.
            aria-label={
              (isOpen
                ? t('History.Collapse interactions')
                : t('History.Expand interactions')) ?? ''
            }
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(call?.linkedid)
            }}
            className='flex h-5 w-5 items-center justify-center text-iconTertiaryNeutral dark:text-iconTertiaryNeutralDark hover:text-primaryNeutral dark:hover:text-primaryNeutralDark'
          >
            <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} className='h-3.5 w-3.5' />
          </button>
        )
      },
      className: 'px-4 py-3.5 w-0',
    },
    {
      header: t('History.Date'),
      cell: (call: any) => <CallsDate call={call} />,
      width: '15%',
    },
    {
      header: t('History.Source'),
      // Interaction rows show their source too: a leg carries both parties, and
      // without the caller a transferred call reads as a bare list of names with
      // no way to follow who called whom.
      cell: (call: any) => (
        <CallSource
          call={call}
          callType={callType}
          operators={operators}
          mainextension={mainextension}
          name={name}
          openDrawerHistory={openDrawerHistory}
        />
      ),
      width: '15%',
      className:
        'px-6 py-3.5 text-left text-sm font-semibold text-primaryNeutral dark:text-primaryNeutralDark w-0',
    },
    {
      header: '',
      cell: () => (
        <FontAwesomeIcon
          icon={faArrowRight}
          className='ml-0 h-4 w-4 flex-shrink-0 text-textPlaceholder dark:text-textPlaceholderDark'
          aria-hidden='true'
        />
      ),
      width: '5%',
      className:
        'px-6 py-3.5 text-left text-sm font-semibold text-primaryNeutral dark:text-primaryNeutralDark w-0',
    },
    {
      header: t('History.Destination'),
      cell: (call: any) => {
        // Mark ONLY calls that actually went through a queue or a ring group — not
        // every grouped call. A ring group is flagged by the middleware; a queue is
        // recognised from its queue name or from the queue-entry leg (lastapp=
        // "Queue"), which after collapsing lives either on the parent (nobody
        // answered) or among its interactions (an agent answered).
        // In the personal view the queue-entry leg is not among the user's own
        // legs: there the queue shows on the member's leg itself, as its queue
        // fields or its "from-queue" channel (already there while the call is on).
        const isRingGroupCall = !!call?.ringGroupName
        const queueName = call?.queueName || call?.queue_name
        const isQueueLeg = (leg: any) =>
          leg?.lastapp === 'Queue' ||
          (typeof leg?.channel === 'string' && leg.channel.includes('@from-queue-'))
        const isQueueCall =
          !isRingGroupCall &&
          (!!queueName ||
            !!call?.queue ||
            isQueueLeg(call) ||
            (call?.interactions || []).some(isQueueLeg))
        const showGroupMarker = isRingGroupCall || isQueueCall

        // Built from an interpolated key, not concatenated, so a translation can
        // put the name where its language needs it.
        let markerLabel = ''
        if (isRingGroupCall) {
          markerLabel = call?.ringGroupName
            ? t('History.Named group call', { name: call.ringGroupName })
            : t('History.Group')
        } else if (isQueueCall) {
          markerLabel = queueName
            ? t('History.Named queue call', { name: queueName })
            : t('History.Queue')
        }

        const marker = showGroupMarker ? (
          <>
            <FontAwesomeIcon
              icon={isRingGroupCall ? faUserGroup : faUsers}
              data-tooltip-id={`tooltip-group-marker-${call?.uniqueid}${
                call?.isInteractionRow ? `-int-${call?._interactionIndex}` : ''
              }`}
              data-tooltip-content={markerLabel}
              className='h-3.5 w-3.5 shrink-0 text-iconTertiaryNeutral dark:text-iconTertiaryNeutralDark'
              role='img'
              aria-label={markerLabel}
            />
            <CustomThemedTooltip
              id={`tooltip-group-marker-${call?.uniqueid}${
                call?.isInteractionRow ? `-int-${call?._interactionIndex}` : ''
              }`}
              place='top'
            />
          </>
        ) : null

        return (
          <CallDestination
            call={call}
            callType={callType}
            operators={operators}
            mainextension={mainextension}
            name={name}
            openDrawerHistory={openDrawerHistory}
            marker={marker}
          />
        )
      },
      width: '15%',
    },
    {
      header: t('History.Duration'),
      cell: (call: any) => <CallDuration duration={call?.duration} monoTimer />,
      width: '15%',
    },
    {
      header: t('History.Outcome'),
      cell: (call: any) => <CallStatus call={call} callType={callType} />,
      width: '15%',
    },
    {
      header: '',
      cell: (call: any) => {
        if (call?.isInteractionRow) {
          return null
        }
        const summaryStatus = call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid] ?? summaryStatusMap?.[call?.linkedid]
        const isVoicemail = hasVoicemailMessage(call)

        if (!summaryStatus && !isVoicemail) {
          return <div className='flex' />
        }

        if (isVoicemail) {
          return (
            <div className='flex justify-center'>
              <button
                type='button'
                className='h-8 w-8 flex items-center justify-center'
                onClick={(event) => {
                  event.stopPropagation()
                  openVoicemailInboxByMessageId(call?.voicemail_message_id)
                }}
                data-tooltip-id={`tooltip-voicemail-${call?.uniqueid}`}
                data-tooltip-content={t('History.Voicemail available') || ''}
              >
                <FontAwesomeIcon
                  icon={faVoicemail}
                  className='h-4 w-4 text-iconIndigo dark:text-iconIndigoDark'
                />
                <CustomThemedTooltip id={`tooltip-voicemail-${call?.uniqueid}`} place='top' />
              </button>
            </div>
          )
        }

        const { state, has_summary, has_transcription } = summaryStatus

        // Show animated icon if state is 'summarizing' or 'progress'
        if (state === 'summarizing' || state === 'progress') {
          return (
            <div className='flex justify-center'>
              <div
                className='h-8 w-8 flex items-center justify-center'
                data-tooltip-id={`tooltip-ai-generating-${call?.uniqueid}`}
                data-tooltip-content={t('Common.Call summary is being generated') || ''}
              >
                <FontAwesomeIcon
                  icon={faFileLines}
                  className='h-4 w-4 animate-pulse text-iconIndigo dark:text-iconIndigoDark'
                />
                <CustomThemedTooltip id={`tooltip-ai-generating-${call?.uniqueid}`} place='top' />
              </div>
            </div>
          )
        }

        // Show clickable icon if state is 'done' or 'failed' (the AI summary step can
        // fail after the transcription is stored) and (has_summary or has_transcription)
        if ((state === 'done' || state === 'failed') && (has_summary || has_transcription)) {
          const tooltipTitle = has_summary
            ? t('Common.View summary') || 'View summary'
            : t('Common.View transcription') || 'View transcription'

          return (
            <div className='flex justify-center'>
              <button
                type='button'
                className='h-8 w-8 flex items-center justify-center'
                onClick={(event) => {
                  event.stopPropagation()
                  openTranscriptionDrawer(call)
                }}
                data-tooltip-id={`tooltip-ai-${call?.uniqueid}`}
                data-tooltip-content={tooltipTitle}
              >
                <FontAwesomeIcon
                  icon={faFileLines}
                  className='h-4 w-4 text-iconIndigo dark:text-iconIndigoDark'
                />
                <CustomThemedTooltip id={`tooltip-ai-${call?.uniqueid}`} place='top' />
              </button>
            </div>
          )
        }

        // No content or other states - don't show anything
        return <div className='flex' />
      },
      width: '5%',
      className: 'px-6 py-3.5 text-center w-0',
    },
    {
      header: '',
      cell: (call: any) =>
        call?.isInteractionRow ? null : (
          <CallRecording
            call={call}
            playSelectedAudioFile={playSelectedAudioFile}
            getRecordingActions={getRecordingActions}
            getCallActions={getCallActions}
            summaryStatus={call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid] ?? summaryStatusMap?.[call?.linkedid]}
          />
        ),
      width: '20%',
      className: 'px-6 py-3.5 w-0',
    },
  ]

  // Generate a unique key for each call with more stability
  const generateUniqueKey = (call: any, index: number) => {
    const suffix = call?.isInteractionRow ? `-int-${call?._interactionIndex}` : ''
    return `call-${call?.uniqueid}-${call?.time}-${index}${suffix}`
  }

  return (
    <>
      <div>
        {isProfileLoading ? (
          <div>
            <div className='flex justify-between gap-4'>
              <div className='flex-1'>
                <Skeleton height={44} className='rounded-lg' />
              </div>
              <Skeleton width={180} height={44} className='rounded-lg shrink-0' />
            </div>

            <div className='mx-auto mt-6'>
              <div className='flex flex-col'>
                <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                  <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
                    <TableSkeleton columns={8} rows={8} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : profile?.macro_permissions?.cdr?.value ? (
          <div>
            <div className='flex justify-between'>
              <Filter
                className='min-w-0 flex-1'
                resetTrigger={resetFiltersTrigger}
                updateFilterText={debouncedUpdateFilterText}
                updateCallTypeFilter={updateCallTypeFilter}
                updateSortFilter={updateSortFilter}
                updateCallDirectionFilter={updateCallDirectionFilter}
                updateDateBeginFilter={updateDateBeginFilter}
                updateDateEndFilter={updateDateEndFilter}
                updateContentFilter={(value: string) => setContentFilter(value)}
                updateQueueFilter={updateQueueFilter}
                availableQueues={availableQueues}
              />
              <div className='text-primaryNeutral dark:text-primaryNeutralDark flex shrink-0 items-start lg:whitespace-nowrap ml-4'>
                <Link
                  href={pbxReportUrl}
                  target='_blank'
                  rel='noreferrer'
                  data-tooltip-id={`tooltip-button-pbx-report`}
                  data-tooltip-content={t('Applications.Open PBX Report')}
                >
                  <Button variant='white' className='gap-2'>
                    <CustomThemedTooltip
                      id={`tooltip-button-pbx-report`}
                      place='top'
                      className='block lg:hidden'
                    />
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='w-4 h-4' />
                    <p className='hidden lg:block'>{t('Applications.Open PBX Report')}</p>
                  </Button>
                </Link>
              </div>
            </div>

            {historyError && (
              <InlineNotification type='error' title={historyError}></InlineNotification>
            )}

            <div className='mx-auto'>
              <div className='flex flex-col'>
                <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                  <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
                    <Table
                      columns={columns}
                      data={!historyError && isHistoryLoaded ? rowsWithInteractions : []}
                      isLoading={!isHistoryLoaded || isLoadingPagination}
                      emptyState={{
                        // always filtered by a date range: "no items found" pattern
                        title: t('History.No calls found'),
                        description: t('Common.Try changing your search filters') || '',
                        icon: <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden='true' />,
                        action: (
                          <Button variant='ghost' size='large'
                            onClick={() => setResetFiltersTrigger((n) => n + 1)}
                          >
                            {t('Common.Reset filters')}
                          </Button>
                        ),
                      }}
                      rowKey={(record, index) => generateUniqueKey(record, index)}
                      trClassName='h-[84px]'
                      scrollable={true}
                      footer={
                        totalPages > 1 ? (
                          <Pagination
                            currentPage={pageNum}
                            totalPages={totalPages}
                            totalItems={history?.count || 0}
                            pageSize={pageSize}
                            onPreviousPage={goToPreviousPage}
                            onNextPage={goToNextPage}
                            onSelectPage={(page) => setPageNum(page)}
                            onSelectPageSize={(size) => {
                              setPageSize(size)
                              setPageNum(1)
                            }}
                            isLoading={!isHistoryLoaded || isLoadingPagination}
                            itemsName={t('History.calls') || ''}
                            className='!mb-0 !px-6'
                          />
                        ) : undefined
                      }
                      getRowClassName={(row: any) =>
                        row?.isInteractionRow
                          ? `!h-auto !border-t-0 [&>td]:!py-2${
                              row?.isLastInteraction ? ' [&>td]:!pb-4' : ''
                            }`
                          : ''
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <MissingPermission />
        )}
      </div>
    </>
  )
}

Calls.displayName = 'Calls'
