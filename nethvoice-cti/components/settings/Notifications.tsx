// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { InlineNotification, Switch } from '../common'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { Skeleton } from '../common/Skeleton'
import { RootState, Dispatch } from '../../store'
import { setNotificationSettings } from '../../lib/notifications'
import { getUserInfo } from '../../services/user'

type NotificationSettingsItem = {
  id: 'call-summary'
  titleKey: string
  tooltipKey: string
  switchLabelKey: string
}

export function getAvailableNotificationSettings(callSummaryEnabled: boolean): NotificationSettingsItem[] {
  const items: NotificationSettingsItem[] = []

  if (callSummaryEnabled) {
    items.push({
      id: 'call-summary',
      titleKey: 'Settings.Call summary ready',
      tooltipKey: 'Settings.Call summary ready tooltip',
      switchLabelKey: 'Settings.Enabled',
    })
  }

  return items
}

export const Notifications = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch<Dispatch>()
  const userStore = useSelector((state: RootState) => state.user)
  const isCallSummaryEnabled = userStore?.call_summary_enabled === true
  const userStoreCallSummaryNotifications = userStore.settings?.call_summary_notifications
  const availableNotificationSettings = getAvailableNotificationSettings(isCallSummaryEnabled)
  const [callSummaryNotifications, setCallSummaryNotifications] = useState<boolean | null>(
    typeof userStoreCallSummaryNotifications === 'undefined'
      ? null
      : userStoreCallSummaryNotifications !== false,
  )
  const [saveError, setSaveError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const refreshUserSettings = async () => {
      if (availableNotificationSettings.length === 0) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const userInfo = await getUserInfo()

        if (!isMounted || !userInfo?.data) {
          return
        }

        dispatch.user.update({
          default_device: userInfo?.data?.default_device,
          name: userInfo?.data?.name,
          username: userInfo?.data?.username,
          mainextension: userInfo?.data?.endpoints?.mainextension?.[0]?.id || '',
          mainPresence: userInfo?.data?.mainPresence,
          endpoints: userInfo?.data?.endpoints,
          profile: userInfo?.data?.profile,
          avatar: userInfo?.data?.settings?.avatar,
          settings: userInfo?.data?.settings,
          recallOnBusy: userInfo?.data?.recallOnBusy,
          lkhash: userInfo?.data?.lkhash,
          call_summary_enabled: userInfo?.data?.call_summary_enabled === true,
          urlOpened: false,
          feature_codes: userStore.feature_codes,
        })

        setCallSummaryNotifications(userInfo.data.settings?.call_summary_notifications !== false)
      } catch (error) {
        // Keep the current local value to avoid unnecessary UI flicker on fetch failures.
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    refreshUserSettings()

    return () => {
      isMounted = false
    }
  }, [
    availableNotificationSettings.length,
    dispatch,
    userStore.feature_codes,
  ])

  const onToggleSummaryNotifications = async (enabled: boolean) => {
    setCallSummaryNotifications(enabled)
    setSaveError('')

    try {
      await setNotificationSettings({
        call_summary_notifications: enabled,
      })

      dispatch.user.updateSettings({
        call_summary_notifications: enabled,
      })
    } catch (error) {
      setCallSummaryNotifications(userStoreCallSummaryNotifications !== false)
      setSaveError(String(t('Settings.Notifications save failed') || ''))
    }
  }

  return (
    <div className='px-6 py-6 sm:p-6 lg:pb-8'>
      <div className='flex flex-col gap-8'>
        <div className='flex max-w-[672px] flex-col gap-2'>
          <h2 className='text-lg font-medium leading-7 text-secondaryNeutral dark:text-secondaryNeutralDark'>
            {t('Settings.Notifications')}
          </h2>
          <div className='text-sm leading-5 text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
            <p>{t('Settings.Notifications description')}</p>
            <p>{t('Settings.Notifications description 2')}</p>
          </div>
        </div>

        {saveError ? (
          <div className='max-w-[672px]'>
            <InlineNotification type='error' title={saveError} />
          </div>
        ) : null}

        {availableNotificationSettings.length > 0 ? (
          <div className='flex w-full flex-col gap-2'>
            <h3 className='text-base font-medium leading-6 text-secondaryNeutral dark:text-secondaryNeutralDark'>
              {t('Settings.Ai features')}
            </h3>

            {availableNotificationSettings.map((notificationItem) => {
              const tooltipId = `notification-setting-${notificationItem.id}`

              return (
                <div key={notificationItem.id} className='flex flex-col gap-4'>
                  <div className='flex items-center gap-2'>
                    <p className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                      {t(notificationItem.titleKey)}
                    </p>
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className='h-4 w-4 text-iconInfo dark:text-iconInfoDark'
                      data-tooltip-id={tooltipId}
                      data-tooltip-content={t(notificationItem.tooltipKey)}
                      aria-hidden='true'
                    />
                    <CustomThemedTooltip id={tooltipId} place='top' />
                  </div>

                  {notificationItem.id === 'call-summary' ? (
                    !isLoading && callSummaryNotifications !== null ? (
                      <Switch
                        on={callSummaryNotifications}
                        changed={onToggleSummaryNotifications}
                        label={String(t(notificationItem.switchLabelKey) || '')}
                        className='justify-end'
                      />
                    ) : (
                      <div className='flex items-center gap-4 pt-0.5'>
                        <Skeleton variant='rectangular' width={44} height={24} className='rounded-full' />
                        <Skeleton width={64} height={20} />
                      </div>
                    )
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
