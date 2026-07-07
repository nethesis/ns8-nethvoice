// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { formatDurationLoc } from '../../lib/dateTime'
import {
  DEFAULT_CALLS_LOAD_ALL_DAY,
  DEFAULT_CALLS_LOAD_PERIOD,
  DEFAULT_CALLS_REFRESH_INTERVAL,
} from '../../lib/queuesLib'
import { loadPreference, savePreference } from '../../lib/storage'
import { RootState } from '../../store'
import { Button, RangeSlider } from '../common'
import { CheckboxPreferencesQueues } from '../queues'

export const Queues = () => {
  const { t } = useTranslation()
  const [firstRender, setFirstRender]: any = useState(true)
  const [callsRefreshInterval, setCallsRefreshInterval]: any = useState(
    DEFAULT_CALLS_REFRESH_INTERVAL,
  )
  const [callsLoadPeriod, setCallsLoadPeriod]: any = useState(DEFAULT_CALLS_LOAD_PERIOD)
  const [callsLoadAllDay, setCallsLoadAllDay] = useState(DEFAULT_CALLS_LOAD_ALL_DAY)
  const authStore = useSelector((state: RootState) => state.authentication)

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    const refreshInterval =
      loadPreference('queuesCallsRefreshInterval', authStore.username) ||
      DEFAULT_CALLS_REFRESH_INTERVAL
    setCallsRefreshInterval(refreshInterval)

    const loadPeriod =
      loadPreference('queuesCallsLoadPeriod', authStore.username) || DEFAULT_CALLS_LOAD_PERIOD
    setCallsLoadPeriod(loadPeriod)

    const loadAllDay =
      loadPreference('queuesCallsLoadAllDay', authStore.username) ?? DEFAULT_CALLS_LOAD_ALL_DAY
    setCallsLoadAllDay(loadAllDay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRender])

  const onChangeCallsRefreshInterval = (value: any) => {
    setCallsRefreshInterval(value)
  }

  const onAfterChangeCallsRefreshInterval = (value: any) => {
    savePreference('queuesCallsRefreshInterval', value, authStore.username)
  }

  const onChangeCallsLoadPeriod = (value: any) => {
    setCallsLoadPeriod(value)
  }

  const onAfterChangeCallsLoadPeriod = (value: any) => {
    savePreference('queuesCallsLoadPeriod', value, authStore.username)
  }

  const onChangeCallsLoadMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    const shouldLoadAllDay = event.target.value === 'all-day'
    setCallsLoadAllDay(shouldLoadAllDay)
    savePreference('queuesCallsLoadAllDay', shouldLoadAllDay, authStore.username)
  }

  const resetToDefaults = () => {
    setCallsRefreshInterval(DEFAULT_CALLS_REFRESH_INTERVAL)
    savePreference('queuesCallsRefreshInterval', DEFAULT_CALLS_REFRESH_INTERVAL, authStore.username)

    setCallsLoadPeriod(DEFAULT_CALLS_LOAD_PERIOD)
    savePreference('queuesCallsLoadPeriod', DEFAULT_CALLS_LOAD_PERIOD, authStore.username)

    setCallsLoadAllDay(DEFAULT_CALLS_LOAD_ALL_DAY)
    savePreference('queuesCallsLoadAllDay', DEFAULT_CALLS_LOAD_ALL_DAY, authStore.username)
  }

  return (
    <>
      <section aria-labelledby='clear-cache-heading'>
        <div className='sm:overflow-hidden w-full dark:bg-gray-900'>
          <div className='bg-cardBackgroud dark:bg-cardBackgroudDark py-6 px-4 sm:p-6 w-full '>
            <div>
              <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
                {t('Settings.Queues')}
              </h2>
              <div className='space-y-10'>
                <div className='max-w-md'>
                  <h4
                    id='clear-cache-heading'
                    className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'
                  >
                    {t('Settings.Time preferences')}
                  </h4>
                  {/* calls refresh interval */}
                  <p className='mt-3 text-sm text-gray-500 dark:text-gray-400'>
                    {t('Settings.Refresh calls every')}:{' '}
                    <span className='font-semibold'>{formatDurationLoc(callsRefreshInterval)}</span>
                  </p>
                  <div className='mt-2'>
                    <RangeSlider
                      orientation='horizontal'
                      value={callsRefreshInterval}
                      min={20}
                      max={60}
                      step={5}
                      onChange={onChangeCallsRefreshInterval}
                      onAfterChange={onAfterChangeCallsRefreshInterval}
                      className='w-48 h-5'
                    />
                  </div>
                  <fieldset className='mt-6'>
                    <legend className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'>
                      {t('Settings.Call history range')}
                    </legend>
                    <div className='mt-3 space-y-3'>
                      <div className='flex items-center'>
                        <input
                          id='queues-load-custom-range'
                          name='queues-load-mode'
                          type='radio'
                          value='custom-range'
                          checked={!callsLoadAllDay}
                          onChange={onChangeCallsLoadMode}
                          className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                        />
                        <label
                          htmlFor='queues-load-custom-range'
                          className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                        >
                          {t('Settings.Custom range')}
                        </label>
                      </div>
                      <div className='flex items-center'>
                        <input
                          id='queues-load-all-day'
                          name='queues-load-mode'
                          type='radio'
                          value='all-day'
                          checked={callsLoadAllDay}
                          onChange={onChangeCallsLoadMode}
                          className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                        />
                        <label
                          htmlFor='queues-load-all-day'
                          className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                        >
                          {t('Settings.All day')}
                        </label>
                      </div>
                    </div>
                  </fieldset>
                  {/* calls load period */}
                  <p
                    className={`mt-6 text-sm ${
                      callsLoadAllDay
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {callsLoadAllDay ? (
                      <>
                        {t('Settings.Load calls for')}:{' '}
                        <span className='font-semibold'>{t('Settings.All day')}</span>
                      </>
                    ) : (
                      <>
                        {t('Settings.Load calls of last')}:{' '}
                        <span className='font-semibold'>
                          {formatDurationLoc(callsLoadPeriod * 60 * 60)}
                        </span>
                      </>
                    )}
                  </p>
                  <div className='mt-2'>
                    <RangeSlider
                      orientation='horizontal'
                      value={callsLoadPeriod}
                      min={1}
                      max={12}
                      step={1}
                      disabled={callsLoadAllDay}
                      onChange={onChangeCallsLoadPeriod}
                      onAfterChange={onAfterChangeCallsLoadPeriod}
                      className={`w-48 h-5 ${callsLoadAllDay ? 'opacity-60' : ''}`}
                    />
                  </div>
                  {/* reset to defaults */}
                  <Button variant='white' className='mt-5' onClick={resetToDefaults}>
                    {t('Common.Reset to defaults')}
                  </Button>
                </div>
                <div className='max-w-xl pt-2'>
                  <div>
                    <p className='text-sm font-regular text-gray-900 dark:text-gray-200'>
                      {t('Settings.Login/logout preferences')}
                    </p>
                  </div>
                  <div className='mt-3'>
                    <CheckboxPreferencesQueues />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
