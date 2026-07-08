// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../store'
import { callPhoneNumber, transferCallToExtension } from '../../lib/utils'
import { formatInTimeZoneLoc } from '../../lib/dateTime'
import { Badge, EmptyState, IconSwitch } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import {
  faBell,
  faCommentDots,
  faCircleCheck,
  faPhone,
  faXmark,
  faCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { utcToZonedTime } from 'date-fns-tz'
import { humanDistanceToNowLoc } from '../../lib/dateTime'
import { Tooltip } from 'react-tooltip'
import { useTranslation } from 'react-i18next'

export interface NotificationsDrawerContentProps extends ComponentPropsWithRef<'div'> {}

export const NotificationsDrawerContent = forwardRef<
  HTMLButtonElement,
  NotificationsDrawerContentProps
>(({ className, ...props }, ref) => {
  const { t } = useTranslation()
  const authStore = useSelector((state: RootState) => state.authentication)
  const notificationsStore = useSelector((state: RootState) => state.notifications)
  const operatorsStore = useSelector((state: RootState) => state.operators)

  const toggleNotificationRead = (notification: any) => {
    store.dispatch.notifications.setNotificationRead({
      notificationId: notification.id,
      isRead: !notification.isRead,
      currentUsername: authStore.username,
    })
  }

  const markAsRead = (notification: any) => {
    store.dispatch.notifications.setNotificationRead({
      notificationId: notification.id,
      isRead: true,
      currentUsername: authStore.username,
    })
  }

  const markAllAsRead = () => {
    store.dispatch.notifications.markAllAsRead(authStore.username)
  }

  const openNotification = (notification: any) => {
    markAsRead(notification)

    //// TODO open notification (only for chat and voicemail)
  }

  const getNotificationIcon = (notification: any) => {
    return (
      <div>
        {/* missed call */}
        {notification.type === 'missedCall' && (
          <>
            <FontAwesomeIcon
              icon={faXmark}
              className={classNames(
                'h-5 w-3.5 text-red-400 dark:text-red-500',
                `tooltip-${notification.id}`,
              )}
              aria-hidden='true'
            />
            <Tooltip anchorSelect={`.tooltip-${notification.id}`} place='bottom'>
              {t('Notifications.Missed call')}
            </Tooltip>
          </>
        )}
        {/* chat */}
        {notification.type === 'chat' && (
          <>
            <FontAwesomeIcon
              icon={faCommentDots}
              className={classNames(
                'h-5 w-5 text-gray-400',
                notification.isRead ? 'dark:text-gray-500' : 'dark:text-gray-100',
                `tooltip-chat-${notification.id}`,
              )}
              aria-hidden='true'
            />
            <Tooltip anchorSelect={`.tooltip-chat-${notification.id}`} place='bottom'>
              {t('Notifications.Chat')}
            </Tooltip>
          </>
        )}
        {/* //// TODO */}
      </div>
    )
  }

  const getNotificationTitle = (notification: any) => {
    {
      /* //// TODO */
    }
    return (
      <div className='flex items-center mb-1 overflow-hidden'>
        <span className='shrink-0 truncate text-sm text-gray-900 dark:text-gray-100 overflow-hidden'>
          {notification.type === 'missedCall' && notification.name}
          {notification.type === 'chat' && notification.name}
        </span>
        {notification.queue && (
          <Badge size='small' variant='offline' rounded='full' className='ml-2 overflow-hidden'>
            <div className='truncate'>{notification.queue}</div>
          </Badge>
        )}
      </div>
    )
  }

  const getNotificationDetails = (notification: any) => {
    {
      /* //// TODO */
    }
    return (
      <div>
        {/* missedCall */}
        {notification.type === 'missedCall' && (
          <div
            className={classNames(
              'truncate text-sm text-primary',
              notification.isRead ? 'dark:text-primaryDark' : 'dark:text-primaryLight',
            )}
          >
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faPhone}
                className={classNames(
                  'mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400',
                  notification.isRead ? 'dark:text-gray-500' : 'dark:text-gray-400',
                )}
                aria-hidden='true'
              />
              <span
                className='cursor-pointer hover:underline'
                onClick={() =>
                  operatorsStore?.operators[authStore.username]?.mainPresence === 'busy'
                    ? transferCallToExtension(notification?.number)
                    : callPhoneNumber(notification?.number)
                }
              >
                {notification.number}
              </span>
            </div>
          </div>
        )}
        {/* chat */}
        {notification.type === 'chat' && (
          <div
            className={classNames(
              'truncate text-sm cursor-pointer hover:underline',
              notification.isRead
                ? 'text-gray-500 dark:text-gray-400'
                : 'text-gray-900 dark:text-gray-100',
            )}
          >
            {notification.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <DrawerHeader 
        title={t('Notifications.Notifications')} 
        rightContent={
          <div
            className='text-sm cursor-pointer hover:underline mr-5 text-gray-700 dark:text-gray-200'
            onClick={markAllAsRead}
          >
            {t('Notifications.Mark all as read')}
          </div>
        }
      />
      {/* drawer content */}
      <div className={classNames(className)} {...props}>
        <div className='bg-white dark:bg-gray-900 pt-6 px-6'>
          <div className='flex items-stretch xl:items-center justify-between'>
            <div className='flex justify-between grow flex-col xl:flex-row xl:items-center'>
              <div className='text-lg font-medium dark:text-gray-200 text-gray-700 mr-4'>
                {t('Notifications.Notifications')}
              </div>
              <div
                className='text-sm cursor-pointer hover:underline mt-2 xl:mt-0 text-gray-700 dark:text-gray-200 mr-5'
                onClick={markAllAsRead}
              >
                {t('Notifications.Mark all as read')}
              </div>
            </div>

          </div>
        </div>
        {/* skeleton */}
        {!notificationsStore.isLoaded && (
          <ul role='list' className='divide-y divide-gray-200 dark:divide-gray-700'>
            {Array.from(Array(9)).map((e, index) => (
              <li key={index} className='py-4 px-5'>
                <div className='animate-pulse h-3 rounded mb-4 bg-gray-300 dark:bg-gray-600'></div>
                <div className='animate-pulse h-3 max-w-[40%] rounded mb-4 bg-gray-300 dark:bg-gray-600'></div>
                <div className='animate-pulse h-3 max-w-[60%] rounded bg-gray-300 dark:bg-gray-600'></div>
              </li>
            ))}
          </ul>
        )}
        {/* empty state */}
        {notificationsStore.isLoaded && !notificationsStore.notifications?.length && (
          <EmptyState
            title={t('Notifications.No notifications') || ""}
            icon={
              <FontAwesomeIcon icon={faBell} className='mx-auto h-12 w-12' aria-hidden='true' />
            }
          />
        )}
        {/* notifications list */}
        {notificationsStore.isLoaded && !!notificationsStore.notifications?.length && (
          <>
            <ul role='list' className='divide-y divide-gray-200 dark:divide-gray-700'>
              {notificationsStore.notifications?.map((notification: any, index: number) => (
                <li
                  key={index}
                  className={classNames(
                    'flex py-4 px-5',
                    !notification.isRead &&
                      'bg-primaryLighter dark:bg-primaryDarker cursor-pointer',
                  )}
                  onClick={() => openNotification(notification)}
                >
                  <div>{getNotificationIcon(notification)}</div>
                  <div className='flex justify-between grow items-center overflow-hidden'>
                    <div className='ml-5 overflow-hidden'>
                      <div className={!notification.isRead ? 'font-semibold' : ''}>
                        <div>{getNotificationTitle(notification)}</div>
                        <div>{getNotificationDetails(notification)}</div>
                      </div>
                      <div
                        className={classNames(
                          'mt-3 text-sm inline-block text-gray-500 dark:text-gray-400 cursor-default',
                          `tooltip-timestamp-${notification.id}`,
                        )}
                      >
                        {humanDistanceToNowLoc(
                          utcToZonedTime(new Date(notification.timestamp), 'UTC'),
                          {
                            addSuffix: true,
                          },
                        )}
                      </div>
                      <Tooltip
                        anchorSelect={`.tooltip-timestamp-${notification.id}`}
                        place='bottom'
                      >
                        {formatInTimeZoneLoc(new Date(notification.timestamp), 'PPpp', 'UTC')}
                      </Tooltip>
                    </div>
                    <div>
                      <IconSwitch
                        on={!notification.isRead}
                        onIcon={<FontAwesomeIcon icon={faCircleCheck} />}
                        offIcon={<FontAwesomeIcon icon={faCircle} />}
                        lighterOnDark
                        changed={() => toggleNotificationRead(notification)}
                        onClick={(event) => event.stopPropagation()}
                        className={classNames('mr-1', `tooltip-mark-as-${notification.id}`)}
                      >
                        <span className='sr-only'>Toggle notification read</span>
                      </IconSwitch>
                      <Tooltip anchorSelect={`.tooltip-mark-as-${notification.id}`} place='bottom'>
                        {notification.isRead
                          ? t('Notifications.Mark as unread')
                          : t('Notifications.Mark as read')}
                      </Tooltip>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className='border-b border-gray-200 dark:border-gray-700'></div>
      </div>
    </>
  )
})

NotificationsDrawerContent.displayName = 'NotificationsDrawerContent'
