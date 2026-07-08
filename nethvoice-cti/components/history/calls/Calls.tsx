// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  faArrowUpRightFromSquare,
  faPhone,
  faArrowRight,
  faDownload,
  faTrash,
  faFileLines,
  faVoicemail,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { t } from 'i18next'
import { FC, ComponentProps, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  DEFAULT_CONTENT_FILTER,
  DEFAULT_CALL_DIRECTION_FILTER,
  DEFAULT_CALL_TYPE_FILTER,
  DEFAULT_SORT_BY,
  deleteRec,
  downloadCallRec,
  getFilterValues,
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
import { Tooltip } from 'react-tooltip'
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

export const Calls: FC<CallsProps> = ({ className }): JSX.Element => {
  const dispatch = useDispatch<Dispatch>()
  const router = useRouter()
  const { operators } = useSelector((state: RootState) => state.operators)
  const { profile } = useSelector((state: RootState) => state.user)
  const { name, mainextension, feature_codes } = useSelector((state: RootState) => state.user)
  const authenticationStore = useSelector((state: RootState) => state.authentication)
  const lastCallsUpdate = useSelector((state: RootState) => state.lastCalls)
  const { username } = authenticationStore

  const [historyError, setHistoryError] = useState('')
  const [isHistoryLoaded, setHistoryLoaded] = useState(false)
  const [isLoadingPagination, setIsLoadingPagination] = useState(false)
  const [history, setHistory]: any = useState({})
  const [pageNum, setPageNum]: any = useState(1)
  const [filterText, setFilterText]: any = useState('')
  const [callType, setCallType]: any = useState('user')
  const [sortBy, setSortBy]: any = useState('time%20desc')
  const [contentFilter, setContentFilter]: any = useState(DEFAULT_CONTENT_FILTER)
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
    setAreFiltersInitialized(true)
  }, [username])

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
            PAGE_SIZE,
            contentFilter,
          )
          setHistory(res)
          setHistoryLoaded(true)
        } catch (e) {
          setHistoryError('Cannot retrieve history')
          setHistoryLoaded(true)
        } finally {
          setIsLoadingPagination(false)
        }
      }
    }

    // Reset loading state when dependencies change
    if (areFiltersInitialized && !isLoadingPagination) {
      setHistoryLoaded(false)
      fetchHistory()
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
    sortBy,
    callDirection,
    contentFilter,
    historyRefreshToken,
  ])

  // Function to load summary status for current page calls
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

      const response = await checkSummaryList(lookups, callType === 'switchboard')

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
  }, [history?.rows, callType])

  // Load summary status when history is loaded or page changes
  useEffect(() => {
    if (isHistoryLoaded) {
      loadSummaryStatus()
    }
  }, [isHistoryLoaded, pageNum, loadSummaryStatus])

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
      setTotalPages(Math?.ceil(history?.count / PAGE_SIZE))
    }
  }, [history?.count])

  async function playSelectedAudioFile(callId: any) {
    if (callId) {
      playFileAudio(callId, 'call_recording')
    }
  }

  function openTranscriptionDrawer(call: any) {
    const summaryStatus = call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid]
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
      } catch (err) {
        console.log(err)
      }
    }
  }

  const deleteRecordingAudioFile = async (callIdInformation: string) => {
    if (callIdInformation !== '') {
      try {
        await deleteRec(callIdInformation)
        // reload the history by resetting the loading state
        setHistoryLoaded(false)
      } catch (err) {
        console.log(err)
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
    const summaryStatus = summaryStatusMap?.[linkedId]
    const hasRecording = call?.recordingfile
    const hasSummary = summaryStatus?.has_summary
    const hasTranscription = summaryStatus?.has_transcription
    const showSummaryActions = summaryStatus?.state === 'done' && (hasSummary || hasTranscription)

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

  // Filter out calls to/from audio_test feature code (similar to UserLastCallsContent)
  const filteredHistory = useMemo(() => {
    if (!history?.rows) return []

    const audioTestCode = feature_codes?.audio_test || '*41'

    return history.rows.filter((call: any) => {
      const numberToCheck = call?.direction === 'in' ? call?.src : call?.dst
      return !numberToCheck?.includes(audioTestCode)
    })
  }, [history?.rows, feature_codes?.audio_test])

  // Merge in the extra conversations the user took part in (e.g. the transfer
  // consultation leg) as their own rows, placed next to the related call.
  const displayRows = useMemo(() => {
    // Switchboard (supervisor) view: render one clean row per real conversation
    // of each call (taken from the transcript), replacing the raw CDR legs —
    // which for transfers include technical/duplicated rows with wrong parties.
    // Calls with no transcript keep their original CDR row so nothing vanishes.
    if (callType === 'switchboard') {
      const convs = (extraConversations || []).filter((c: any) => c?.linkedid)
      if (convs.length === 0) {
        return filteredHistory
      }

      const norm = (v: any) => (v ?? '').toString().trim()
      // Without a single "me" extension, infer direction from the parties:
      // an external (long) number as src means inbound, as dst means outbound.
      const isExternal = (n: any) => norm(n).replace(/\D/g, '').length > 5
      const convDirection = (conv: any) => {
        if (isExternal(conv?.src_number)) return 'in'
        if (isExternal(conv?.dst_number)) return 'out'
        return 'internal'
      }
      // The switchboard CDR feed (histcallswitch) returns direction=null and
      // carries the outbound trunk number in cnum on transferred legs, so we must
      // NOT display the leg's own src/dst/cnum. Instead use the transcript's clean
      // parties (src_number/dst_number) and only borrow timing/recording from the
      // one CDR leg that actually connects BOTH parties of this conversation.
      const partyName = (legs: any[], num: string) => {
        const n = norm(num)
        if (!n) return { cnam: '', company: '' }
        for (const leg of legs) {
          if (norm(leg?.cnum) === n && norm(leg?.cnam))
            return { cnam: norm(leg.cnam), company: norm(leg?.ccompany) }
          if (norm(leg?.src) === n && norm(leg?.cnam))
            return { cnam: norm(leg.cnam), company: norm(leg?.ccompany) }
          if (norm(leg?.dst) === n && norm(leg?.dst_cnam))
            return { cnam: norm(leg.dst_cnam), company: norm(leg?.dst_ccompany) }
        }
        return { cnam: '', company: '' }
      }

      const convsByLinked = new Map<string, any[]>()
      convs.forEach((conv: any) => {
        const arr = convsByLinked.get(conv.linkedid) || []
        arr.push(conv)
        convsByLinked.set(conv.linkedid, arr)
      })

      // Walk the page in backend order. At the first CDR leg of a transcribed
      // call, emit one row per real conversation (built from the transcript's
      // clean parties) and drop that call's raw/technical legs.
      const emitted = new Set<string>()
      const result: any[] = []
      filteredHistory.forEach((row: any) => {
        const lid = row?.linkedid
        if (lid && convsByLinked.has(lid)) {
          if (!emitted.has(lid)) {
            emitted.add(lid)
            const legs = filteredHistory.filter((r: any) => r?.linkedid === lid)
            ;(convsByLinked.get(lid) || []).forEach((conv: any) => {
              const a = norm(conv?.src_number)
              const b = norm(conv?.dst_number)
              // The CDR leg whose parties include BOTH conversation parties is the
              // authoritative source for duration/disposition/recording. Prefer
              // ANSWERED + longest. If none (e.g. a consultation leg the switchboard
              // feed dropped), leave duration empty rather than borrow a wrong one.
              const timed = legs
                .filter((leg: any) => {
                  const p = [norm(leg?.src), norm(leg?.dst), norm(leg?.cnum)]
                  return a && b && p.includes(a) && p.includes(b)
                })
                .sort(
                  (x: any, y: any) =>
                    (y?.disposition === 'ANSWERED' ? 1 : 0) -
                      (x?.disposition === 'ANSWERED' ? 1 : 0) ||
                    (Number(y?.duration) || 0) - (Number(x?.duration) || 0),
                )[0]
              const srcName = partyName(legs, conv?.src_number)
              const dstName = partyName(legs, conv?.dst_number)

              result.push({
                uniqueid: conv?.uniqueid,
                linkedid: conv?.linkedid,
                id: conv?.id,
                // Clean parties from the transcript (no trunk number).
                src: conv?.src_number || '',
                dst: conv?.dst_number || '',
                cnum: conv?.src_number || '',
                cnam: srcName.cnam,
                ccompany: srcName.company,
                dst_cnam: dstName.cnam,
                dst_ccompany: dstName.company,
                clid: '',
                direction: convDirection(conv),
                disposition: timed?.disposition || 'ANSWERED',
                time: timed?.time ?? row?.time,
                duration:
                  Number(conv?.duration_seconds) > 0
                    ? Number(conv?.duration_seconds)
                    : Number(timed?.duration) || 0,
                billsec:
                  Number(conv?.duration_seconds) > 0
                    ? Number(conv?.duration_seconds)
                    : Number(timed?.billsec) || 0,
                channel: timed?.channel || '',
                dstchannel: timed?.dstchannel || '',
                recordingfile: timed?.recordingfile || '',
                has_voicemail_message: false,
                voicemail_message_id: '',
                isConversationRow: true,
                summaryStatus: conv,
                transcriptId: conv?.id,
              })
            })
          }
          return
        }
        result.push(row)
      })

      return result
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

  // Definition of the columns of the table
  const columns = [
    {
      header: t('History.Date'),
      cell: (call: any) => <CallsDate call={call} />,
      width: '15%',
    },
    {
      header: t('History.Source'),
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
      cell: (call: any) => (
        <CallDestination
          call={call}
          callType={callType}
          operators={operators}
          mainextension={mainextension}
          name={name}
          openDrawerHistory={openDrawerHistory}
        />
      ),
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
        const summaryStatus = call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid]
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

        // Show clickable icon if state is 'done' and (has_summary or has_transcription)
        if (state === 'done' && (has_summary || has_transcription)) {
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

        // State is 'failed' or other states - don't show anything
        return <div className='flex' />
      },
      width: '5%',
      className: 'px-6 py-3.5 text-center w-0',
    },
    {
      header: '',
      cell: (call: any) => (
        <CallRecording
          call={call}
          playSelectedAudioFile={playSelectedAudioFile}
          getRecordingActions={getRecordingActions}
          getCallActions={getCallActions}
          summaryStatus={call?.summaryStatus ?? summaryStatusMap?.[call?.uniqueid]}
        />
      ),
      width: '20%',
      className: 'px-6 py-3.5 w-0',
    },
  ]

  // Generate a unique key for each call with more stability
  const generateUniqueKey = (call: any, index: number) => {
    return `call-${call?.uniqueid}-${call?.time}-${index}`
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
                updateFilterText={debouncedUpdateFilterText}
                updateCallTypeFilter={updateCallTypeFilter}
                updateSortFilter={updateSortFilter}
                updateCallDirectionFilter={updateCallDirectionFilter}
                updateDateBeginFilter={updateDateBeginFilter}
                updateDateEndFilter={updateDateEndFilter}
                updateContentFilter={(value: string) => setContentFilter(value)}
              />
              <div className='text-primaryNeutral dark:text-primaryNeutralDark flex items-start lg:whitespace-nowrap ml-4'>
                <Link
                  href={pbxReportUrl}
                  target='_blank'
                  rel='noreferrer'
                  data-tooltip-id={`tooltip-button-pbx-report`}
                  data-tooltip-content={t('Applications.Open PBX Report')}
                >
                  <Button variant='white' className='gap-2'>
                    <Tooltip
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
                      data={!historyError && isHistoryLoaded ? displayRows : []}
                      isLoading={!isHistoryLoaded || isLoadingPagination}
                      emptyState={{
                        title: t('History.No calls'),
                        description: t('History.There are no calls in your history') || '',
                        icon: (
                          <FontAwesomeIcon
                            icon={faPhone}
                            className='mx-auto h-12 w-12'
                            aria-hidden='true'
                          />
                        ),
                      }}
                      rowKey={(record, index) => generateUniqueKey(record, index)}
                      trClassName='h-[84px]'
                      scrollable={true}
                      maxHeight='calc(100vh - 480px)'
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={pageNum}
                totalPages={totalPages}
                totalItems={history?.count || 0}
                pageSize={PAGE_SIZE}
                onPreviousPage={goToPreviousPage}
                onNextPage={goToNextPage}
                isLoading={!isHistoryLoaded || isLoadingPagination}
                itemsName={t('History.calls') || ''}
              />
            )}
          </div>
        ) : (
          <MissingPermission />
        )}
      </div>
    </>
  )
}

Calls.displayName = 'Calls'
