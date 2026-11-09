// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import { Popover, PopoverButton } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCaretDown,
  faPause,
  faPlay,
  faUserClock,
  faUserXmark,
} from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { t } from 'i18next'
import { Button, Dropdown } from '../../common'
import { loginToQueue, logoutFromQueue, pauseQueue, unpauseQueue } from '../../../lib/queuesLib'

interface UserActionInQueueProps {
  queue: any
}

export const UserActionInQueue: React.FC<UserActionInQueueProps> = ({ queue }) => {
  // Unpause user queue
  const unpauseUserQueue = (queue: any) => {
    //member is user extension
    unpauseQueue(queue.member, queue.queue)
  }

  const loginUserQueue = (queue: any) => {
    loginToQueue(queue.member, queue.queue)
  }

  const logoutUserQueue = (queue: any) => {
    logoutFromQueue(queue.member, queue.queue)
  }

  const pauseUserQueue = (queue: any, reason: string) => {
    //member is user extension
    pauseQueue(queue.member, queue.queue, reason)
  }

  const dropdownItems = (queue: any) => (
    <>
      {/* If user is not logged in */}
      {!queue?.loggedIn ? (
        <Popover className='md:relative hover:bg-gray-200 dark:hover:bg-gray-700'>
          {({ open }) => (
            <>
              <PopoverButton
                className={classNames(
                  open ? '' : '',
                  'relative text-left cursor-pointer px-5 py-3 text-sm flex items-center gap-3 w-full',
                )}
                onClick={() => loginUserQueue(queue)}
                disabled={queue?.type !== 'dynamic'}
              >
                <FontAwesomeIcon
                  icon={faPlay}
                  className='h-4 w-4 flex justify-start text-gray-400 dark:text-gray-500'
                />
                <span>{t('QueueManager.Login')}</span>
              </PopoverButton>
            </>
          )}
        </Popover>
      ) : (
        // If user is loggedIn
        <>
          <Popover className='md:relative hover:bg-gray-200 dark:hover:bg-gray-700'>
            {({ open }) => (
              <>
                <PopoverButton
                  className={classNames(
                    open ? '' : '',
                    'relative text-left cursor-pointer px-5 py-3 text-sm flex items-center gap-3 w-full ',
                  )}
                  onClick={() => logoutUserQueue(queue)}
                  disabled={queue?.type !== 'dynamic'}
                >
                  <FontAwesomeIcon
                    icon={faUserXmark}
                    className='h-4 w-4 flex justify-start text-red-400 dark:text-red-500'
                  />
                  <span>{t('QueueManager.Logout')}</span>
                </PopoverButton>
              </>
            )}
          </Popover>
          {/* User is in pause */}
          {queue.paused ? (
            <Popover className='md:relative hover:bg-gray-200 dark:hover:bg-gray-700'>
              {({ open }) => (
                <>
                  <PopoverButton
                    className={classNames(
                      open ? '' : '',
                      'relative text-left cursor-pointer px-5 py-3 text-sm flex items-center gap-3 w-full ',
                    )}
                    onClick={() => unpauseUserQueue(queue)}
                  >
                    <FontAwesomeIcon
                      icon={faUserClock}
                      className='h-4 w-4 flex justify-start text-gray-400 dark:text-gray-500'
                    />
                    <span>{t('QueueManager.End pause')}</span>
                  </PopoverButton>
                </>
              )}
            </Popover>
          ) : (
            // User is not in pause
            <Popover className='md:relative hover:bg-gray-200 dark:hover:bg-gray-700'>
              {({ open }) => (
                <>
                  <PopoverButton
                    className={classNames(
                      open ? '' : '',
                      'relative text-left cursor-pointer px-5 py-3 text-sm flex items-center gap-3 w-full ',
                    )}
                    onClick={() => pauseUserQueue(queue, '')}
                  >
                    <FontAwesomeIcon
                      icon={faPause}
                      className='h-4 w-4 flex justify-start text-gray-400 dark:text-gray-500 -ml-0.5'
                    />
                    <span>{t('QueueManager.Pause')}</span>
                  </PopoverButton>
                </>
              )}
            </Popover>
          )}
        </>
      )}
    </>
  )

  return (
    <>
      <Dropdown items={dropdownItems(queue)} position='left' divider={true} className='pl-3'>
        <span className='sr-only'>{t('TopBar.Open user menu')}</span>
        <Button variant='white'>
          <span>{t('QueueManager.Actions')}</span>
          <FontAwesomeIcon icon={faCaretDown} className='h-4 w-4 ml-2' aria-hidden='true' />
        </Button>
      </Dropdown>
    </>
  )
}

UserActionInQueue.displayName = 'UserActionInQueue'
