// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, MutableRefObject, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { deleteVoicemail, downloadVoicemail, getAllVoicemails } from '../../../services/voicemail'
import {
  faEllipsisVertical,
  faVoicemail,
  faSortAmountAsc,
  faCheck,
  faPhone,
  faPlay,
  faTrash,
  faCircleArrowDown,
  faCircle,
  faArrowRightLong,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar, Button, ConfirmationModal, Dropdown, EmptyState, InlineNotification } from '..'
import {
  callPhoneNumber,
  closeSideDrawer,
  formatPhoneNumber,
  playFileAudio,
  transferCallToExtension,
} from '../../../lib/utils'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { VoiceMailType } from '../../../services/types'
import { forEach, isEmpty } from 'lodash'
import { openShowOperatorDrawer } from '../../../lib/operators'
import Link from 'next/link'
import { useEventListener } from '../../../lib/hooks/useEventListener'
import { customScrollbarClass } from '../../../lib/utils'
import { Skeleton } from '../Skeleton'

export const VoiceMailContent = () => {
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const authStore = useSelector((state: RootState) => state.authentication)
  const reloadValue = useSelector((state: RootState) => state.voicemail.reloadVoicemailValue)

  const [isVoiceMailLoaded, setVoiceMailLoaded] = useState(false)
  const [getVoiceMailError, setGetVoiceMailError] = useState('')
  const [voicemails, setVoicemails] = useState<any[]>([])
  const [sortType, setSortType] = useState<SortTypes>('newest')
  const [firstRender, setFirstRender]: any = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [voicemailToDelete, setVoicemailToDelete] = useState<any>(null)
  const cancelDeleteButtonRef = useRef() as MutableRefObject<HTMLButtonElement>

  // Listen for audio player closed event
  useEventListener('phone-island-audio-player-closed', () => {
    setFirstRender(true)
  })

  useEffect(() => {
    if (!isEmpty(operatorsStore) && !operatorsStore.isOperatorsLoaded) {
      return
    }

    if (!firstRender && !reloadValue) {
      return
    }

    if (firstRender) {
      setFirstRender(false)
    }

    const fetchVoicemails = async () => {
      try {
        setVoiceMailLoaded(false)
        setGetVoiceMailError('')

        const response: any[] | undefined = await getAllVoicemails()

        // Filter voicemails by type = inbox or old
        const inboxVoicemails = response?.filter(
          (voicemail) => voicemail.type === 'inbox' || voicemail.type === 'old',
        )

        forEach(response, (voicemail) => {
          const callerIdMatch = (voicemail as VoiceMailType).callerid?.match(/<([^>]+)>/)
          const callerId = callerIdMatch ? callerIdMatch[1] : ''

          let operator: any = Object.values(operatorsStore.operators).find((operator: any) =>
            operator.endpoints?.mainextension?.some((vm: { id: string }) => vm.id === callerId),
          )

          if (!operator) {
            voicemail.caller_number = formatPhoneNumber(callerId)
          } else {
            voicemail.caller_number = callerId
          }

          if (operator == undefined) {
            operator = { name: t('VoiceMail.Unknown') }
          }

          voicemail.caller_operator = operator
        })

        if (inboxVoicemails) {
          // Sort voicemails by date (newest first) as default
          const sortedVoicemails = inboxVoicemails.sort((a, b) => {
            // Default sort: newest first (descending)
            return b.origtime - a.origtime
          })

          setVoicemails(sortedVoicemails)
        }

        setVoiceMailLoaded(true)
      } catch (error) {
        console.error(error)
        setGetVoiceMailError('Error fetching voicemails')
      }
    }

    fetchVoicemails()
  }, [operatorsStore, firstRender, reloadValue])

  useEffect(() => {
    // Apply sorting to voicemails
    if (voicemails && voicemails.length) {
      const sortedVoicemails = [...voicemails].sort((a, b) => {
        // Sort by date
        return sortType === 'oldest' ? a.origtime - b.origtime : b.origtime - a.origtime
      })
      setVoicemails(sortedVoicemails)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortType])

  const showDeleteVoicemailModal = (voicemail: any) => {
    setVoicemailToDelete(voicemail)
    setShowDeleteModal(true)
  }

  const prepareDeleteContact = async () => {
    if (voicemailToDelete?.id) {
      await deleteVoicemail(voicemailToDelete?.id)
      setShowDeleteModal(false)
      setVoicemailToDelete(null)
      closeSideDrawer()
      // Reload voicemails after deletion
      setFirstRender(true)
    }
  }

  const getVoiceMailOptionsTemplate = (voicemail: VoiceMailType) => (
    <>
      <div className='border-b border-layoutDivider dark:border-layoutDividerDark'>
        <Dropdown.Item icon={faPhone} onClick={() => quickCall(voicemail)}>
          <span>{t('VoiceMail.Call back')}</span>
        </Dropdown.Item>
        <Dropdown.Item icon={faCircleArrowDown} onClick={() => downloadVoicemail(voicemail?.id)}>
          <span>{t('VoiceMail.Download')}</span>
        </Dropdown.Item>
      </div>
      <Dropdown.Item icon={faTrash} isRed onClick={() => showDeleteVoicemailModal(voicemail)}>
        <span>{t('VoiceMail.Delete message')}</span>
      </Dropdown.Item>
    </>
  )

  const getVoiceMailSortTemplate = () => (
    <>
      <div className='cursor-default'>
        <Dropdown.Header>
          <span className='font-poppins font-light'>{t('VoiceMail.Sort by')}</span>
        </Dropdown.Header>
        <Dropdown.Item onClick={() => setSortType('newest')}>
          <span className='font-poppins font-light'>{t('VoiceMail.Newest')}</span>
          {sortType === 'newest' && (
            <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
          )}
        </Dropdown.Item>
        <Dropdown.Item onClick={() => setSortType('oldest')}>
          <span className='font-poppins font-light'>{t('VoiceMail.Oldest')}</span>
          {sortType === 'oldest' && (
            <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
          )}
        </Dropdown.Item>
      </div>
    </>
  )

  const getVoiceMailMenuTemplate = () => (
    <>
      <Link
        href={{ pathname: '/history', query: { section: 'Voicemail inbox' } }}
        className='w-full'
      >
        <Dropdown.Item icon={faArrowRightLong}>{t('VoiceMail.Go to history')}</Dropdown.Item>
      </Link>
      <Link href={{ pathname: '/settings', query: { section: 'Voicemail' } }} className='w-full'>
        <Dropdown.Item icon={faArrowRightLong}>{t('VoiceMail.Go to settings')}</Dropdown.Item>
      </Link>
    </>
  )

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
    const formattedDate = date.toLocaleDateString('en-GB', dateOptions)
    const formattedTime = date.toLocaleTimeString('en-GB', timeOptions)
    return `${formattedDate}, ${formattedTime}`
  }

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const quickCall = (voicemail: any) => {
    if (
      operatorsStore?.operators[authStore?.username]?.mainPresence &&
      operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
    ) {
      transferCallToExtension(voicemail?.caller_number)
    } else if (
      operatorsStore?.operators[authStore?.username]?.endpoints?.mainextension?.[0]?.id !==
      voicemail?.caller_number
    ) {
      callPhoneNumber(voicemail?.caller_number)
    }
  }

  const openDrawerOperator = (operator: any) => {
    if (operator) {
      openShowOperatorDrawer(operator)
    }
  }

  async function playSelectedVoicemail(voicemail: any) {
    if (voicemail) {
      playFileAudio(voicemail.id, 'voicemail')
    }
  }

  return (
    <>
      <ConfirmationModal
        show={showDeleteModal}
        focus={cancelDeleteButtonRef}
        onClose={() => setShowDeleteModal(false)}
        afterLeave={() => setVoicemailToDelete(null)}
        title={t('VoiceMail.Delete voicemail')}
        description={t('VoiceMail.voicemailDeletionMessage', {
          name: voicemailToDelete?.displayName || '-',
        })}
        confirmLabel={t('Common.Delete')}
        onConfirm={() => prepareDeleteContact()}
      />
      <div className='flex h-full flex-col bg-elevation0 dark:bg-elevation0Dark'>
        <div className='py-4 px-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-medium text-primaryNeutral dark:text-primaryNeutralDark'>
              {t('VoiceMail.Voicemail inbox')}
            </h2>
            <div className='flex gap-2 items-center'>
              <Dropdown items={getVoiceMailSortTemplate()} position='left'>
                <Button variant='white' className='py-2 px-2 gap-3 h-9 w-9'>
                  <FontAwesomeIcon icon={faSortAmountAsc} className='h-4 w-4' />
                  <span className='sr-only'>{t('VoiceMail.Open voicemail menu')}</span>
                </Button>
              </Dropdown>
              <Dropdown items={getVoiceMailMenuTemplate()} position='left'>
                <Button variant='ghost' className='py-2 px-2 h-9 w-9'>
                  <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                  <span className='sr-only'>{t('VoiceMail.Open voicemail menu')}</span>
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>
        <span className='border-b border-layoutDivider dark:border-layoutDividerDark'></span>
        <ul
          role='list'
          className={`flex-1 ${customScrollbarClass}`}
        >
          {/* get voicemails error */}
          {getVoiceMailError && (
            <InlineNotification type='error' title={getVoiceMailError} className='my-6' />
          )}
          {/* render voicemails */}
          {isVoiceMailLoaded &&
            voicemails?.map((voicemail, index) => (
              <li key={voicemail?.id} className=''>
                <div className='group relative flex items-center'>
                  <div
                    className='absolute inset-0 group-hover:bg-dropdownBgHover dark:group-hover:bg-dropdownBgHoverDark'
                    aria-hidden='true'
                  />
                  <div className='relative flex min-w-0 flex-1 items-center px-6'>
                    <div className='gap-4 py-4 px-0 w-full'>
                      <div className='flex justify-between gap-3'>
                        <div className='flex shrink-0 h-min items-center min-w-[48px]'>
                          <div className='h-2 w-2 flex justify-center items-center'>
                            {voicemail.type === 'inbox' ? (
                              <FontAwesomeIcon
                                icon={faCircle}
                                className='h-2 w-2 text-iconDanger dark:text-iconDangerDark'
                              />
                            ) : null}
                          </div>
                          <Avatar
                            src={voicemail?.caller_operator?.avatarBase64}
                            placeholderType='operator'
                            size='large'
                            bordered
                            onClick={
                              voicemail?.caller_operator?.name !== t('VoiceMail.Unknown') &&
                              voicemail?.caller_operator
                                ? () => openDrawerOperator(voicemail?.caller_operator)
                                : undefined
                            }
                            className={`mx-auto ${
                              voicemail?.caller_operator?.name !== t('VoiceMail.Unknown') &&
                              voicemail?.caller_operator
                                ? 'cursor-pointer'
                                : 'cursor-default'
                            } ml-0.5`}
                            status={voicemail?.caller_operator?.mainPresence}
                            star={voicemail?.caller_operator?.favorite}
                          />
                        </div>
                        <div className='flex flex-col gap-1.5 min-w-0 flex-1'>
                          <span
                            className='font-poppins text-sm leading-4 font-medium text-primaryNeutral dark:text-primaryNeutralDark truncate'
                            title={voicemail?.caller_operator?.name || t('VoiceMail.Unknown')}
                          >
                            {voicemail?.caller_operator?.name
                              ? voicemail.caller_operator.name
                              : t('VoiceMail.Unknown')}
                          </span>
                          <div className='flex items-center truncate text-sm text-textLink dark:text-textLinkDark'>
                            <FontAwesomeIcon
                              icon={faPhone}
                              className='mr-1.5 h-4 w-4 flex-shrink-0 text-tertiaryNeutral dark:text-tertiaryNeutralDark'
                              aria-hidden='true'
                            />
                            <span
                              className='cursor-pointer hover:underline font-poppins text-sm leading-4 font-normal truncate'
                              onClick={() => quickCall(voicemail)}
                              title={voicemail?.caller_number}
                            >
                              {voicemail?.caller_number}
                            </span>
                          </div>
                          <span
                            className='font-poppins text-sm leading-4 font-normal text-tertiaryNeutral dark:text-tertiaryNeutralDark truncate'
                            title={formatTimestamp(voicemail?.origtime)}
                          >
                            {formatTimestamp(voicemail?.origtime)}
                          </span>
                          <div className='flex text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                            <FontAwesomeIcon
                              icon={faVoicemail}
                              className='mr-1.5 h-4 w-4 flex-shrink-0'
                              aria-hidden='true'
                            />
                            {voicemail?.duration && (
                              <span className='font-poppins text-sm leading-4 font-normal'>
                                {formatDuration(voicemail?.duration)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className='flex gap-2 items-start shrink-0 pl-2.5'>
                          <Button
                            variant='white'
                            className='border border-gray-300 dark:border-gray-500 py-2 h-9 w-9 gap-3'
                            onClick={() => playSelectedVoicemail(voicemail)}
                          >
                            <FontAwesomeIcon icon={faPlay} className='h-4 w-4' />
                            <span className='sr-only'>{t('VoiceMail.Play voicemail')}</span>
                          </Button>
                          <Dropdown
                            items={getVoiceMailOptionsTemplate(voicemail)}
                            position={index === 0 ? 'bottomVoicemail' : 'topVoicemail'}
                          >
                            <Button variant='ghost' className='py-2 px-2 h-9 w-9'>
                              <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                              <span className='sr-only'>{t('VoiceMail.Open voicemail menu')}</span>
                            </Button>
                          </Dropdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Divider */}
                {index !== voicemails?.length - 1 && (
                  <div className='px-6 relative'>
                    <div className='border-b border-layoutDivider dark:border-layoutDividerDark'></div>
                  </div>
                )}
              </li>
            ))}
          {/* skeleton */}
          {!isVoiceMailLoaded &&
            !getVoiceMailError &&
            Array.from(Array(4)).map((_, index) => (
              <li key={index} className='px-6 py-4'>
                <div className='flex justify-between gap-3'>
                  <div className='flex shrink-0 h-min items-center min-w-[48px]'>
                    <div className='h-2 w-2 flex justify-center'></div>
                    <Skeleton variant='avatar' className='ml-0.5'/>
                  </div>
                  <div className='flex flex-col gap-1.5 min-w-0 flex-1'>
                    <Skeleton width='75%' />
                    <Skeleton width='50%' />
                    <Skeleton width='25%' />
                    <Skeleton width='25%' />
                  </div>
                  <div className='flex gap-2 items-start shrink-0'>
                    <Skeleton
                      width='36px'
                      height='36px'
                      variant='rectangular'
                      className='rounded-md'
                    />
                    <Skeleton
                      width='36px'
                      height='36px'
                      variant='rectangular'
                      className='rounded-md'
                    />
                  </div>
                </div>
                {index !== 3 && (
                  <div className='pt-4 relative'>
                    <div className='border-b border-layoutDivider dark:border-layoutDividerDark'></div>
                  </div>
                )}
              </li>
            ))}
          {/* empty state */}
          {isVoiceMailLoaded && !getVoiceMailError && voicemails?.length == 0 && (
            <div className='py-4 px-6'>
              <EmptyState
                title={t('VoiceMail.Voicemail empty')}
                description={t('VoiceMail.Voicemail empty description') || ''}
                icon={
                  <FontAwesomeIcon
                    icon={faVoicemail}
                    className='mx-auto h-12 w-12'
                    aria-hidden='true'
                  />
                }
              />
            </div>
          )}
        </ul>
      </div>
    </>
  )
}

export type SortTypes = 'newest' | 'oldest' | string
