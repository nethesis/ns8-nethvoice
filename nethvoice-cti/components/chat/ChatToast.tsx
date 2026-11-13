// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useEffect, useRef, useState } from 'react'
import { Transition } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMessage,
  faPaperclip,
  faReply,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar, Button } from '../common'
import { groupLook } from './icons'

export interface ChatNotice {
  peer: string
  name: string
  kind: 'chat' | 'group'
  author: string
  text: string
  attachment: boolean
  avatar?: string
  ts: number
  count: number
}

const TIMEOUT = 8000

/** A new message not in view: who, where, when and what; Reply opens the conversation. */
export function ChatToast({
  notice,
  onOpen,
  onClose,
}: {
  notice: ChatNotice | null
  onOpen: (peer: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState(false)
  const timer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    clearTimeout(timer.current)
    if (notice && !hover) timer.current = setTimeout(onClose, TIMEOUT)
    return () => clearTimeout(timer.current)
  }, [notice, hover, onClose])

  const open = () => notice && (onOpen(notice.peer), onClose())
  const time = notice
    ? new Date(notice.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <Transition
      show={!!notice}
      as={React.Fragment}
      enter='transform ease-out duration-300 transition'
      enterFrom='translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2'
      enterTo='translate-y-0 opacity-100 sm:translate-x-0'
      leave='transition ease-in duration-100'
      leaveFrom='opacity-100'
      leaveTo='opacity-0'
    >
      <div
        role='alert'
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={open}
        className='pointer-events-auto relative w-96 max-w-sm cursor-pointer overflow-hidden rounded-lg bg-elevationL2Invert dark:bg-elevationL2InvertDark shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200/5 dark:border-gray-700/60 p-4'
      >
        {notice && (
          <div className='flex items-start gap-4'>
            <div className='relative shrink-0'>
              {notice.kind === 'group' && !notice.avatar ? (
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${groupLook(notice.peer, notice.name).className}`}>
                  <FontAwesomeIcon icon={groupLook(notice.peer, notice.name).icon} className='h-4 w-4' aria-hidden='true' />
                </span>
              ) : (
                <Avatar src={notice.avatar} size='base' placeholderType='operator' />
              )}
              {/* Chat badge: tells it apart from the other toasts. */}
              <span className='absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary dark:bg-primaryDark text-white dark:text-gray-900 ring-2 ring-elevationL2Invert dark:ring-elevationL2InvertDark'>
                <FontAwesomeIcon icon={faMessage} className='h-2.5 w-2.5' aria-hidden='true' />
              </span>
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-baseline justify-between gap-2 pr-6'>
                <p className='truncate text-sm font-medium leading-5 text-primaryNeutral dark:text-primaryNeutralDark'>
                  {notice.name}
                </p>
                <span className='shrink-0 text-xs leading-4 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                  {time}
                </span>
              </div>
              <p className='text-xs leading-4 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                {notice.kind === 'group' && notice.author}
                {notice.kind === 'group' && notice.count > 1 && ' · '}
                {notice.count > 1
                  ? t('Chat.Messages count', { count: notice.count })
                  : notice.kind !== 'group' && t('Chat.New message')}
              </p>
              <p className='mt-2 line-clamp-2 break-words text-sm leading-5 text-primaryNeutral dark:text-primaryNeutralDark'>
                {notice.attachment ? (
                  <>
                    <FontAwesomeIcon
                      icon={faPaperclip}
                      className='mr-1.5 h-3.5 w-3.5'
                      aria-hidden='true'
                    />
                    {t('Chat.Attachment')}
                  </>
                ) : (
                  notice.text
                )}
              </p>
              <div className='mt-3'>
                <Button
                  variant='primary'
                  size='small'
                  onClick={(e: React.MouseEvent) => (e.stopPropagation(), open())}
                >
                  <FontAwesomeIcon icon={faReply} className='mr-2 h-4 w-4' aria-hidden='true' />
                  {t('Chat.Reply')}
                </Button>
              </div>
            </div>
            <button
              className='absolute right-4 top-4 border-0 bg-transparent p-0 cursor-pointer'
              onClick={(e) => (e.stopPropagation(), onClose())}
              aria-label={t('Common.Close') || 'Close'}
            >
              <FontAwesomeIcon
                icon={faXmark}
                className='h-4 w-4 text-primaryNeutral dark:text-primaryNeutralDark'
                aria-hidden='true'
              />
            </button>
          </div>
        )}
      </div>
    </Transition>
  )
}
