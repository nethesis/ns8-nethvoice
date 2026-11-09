import React, { FC, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { cloneDeep, isEmpty } from 'lodash'
import { setQueueUserPreferences } from '../../lib/queuesLib'
import { loadPreference, savePreference } from '../../lib/storage'

interface CheckboxPreferencesQueuesProps {
  className?: string
}

const normalizeSelectedStatus = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    try {
      const parsedValue = JSON.parse(value)
      return Array.isArray(parsedValue) ? parsedValue : []
    } catch {
      return []
    }
  }

  return []
}

export const CheckboxPreferencesQueues: FC<CheckboxPreferencesQueuesProps> = ({
  className,
}): JSX.Element => {
  const { t } = useTranslation()
  const userSettingsInformation = useSelector((state: RootState) => state.user.settings)
  const auth = useSelector((state: RootState) => state.authentication)
  const dispatch = useDispatch()

  async function changeQueueUserPreferences(value: any, type: any) {
    let informationObject: any = {}
    if (type === 'logout') {
      informationObject.queue_auto_logout = value
    } else if (type === 'login') {
      informationObject.queue_auto_login = value
    } else if (type === 'pause') {
      informationObject.queue_auto_pause_onpresence = value
    } else if (type === 'callForward/dnd') {
      informationObject.queue_autopause_presencelist = value
    }
    try {
      if (!isEmpty(informationObject)) {
        await setQueueUserPreferences(informationObject)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function updateLogoutStatus(event: any) {
    const isChecked = event.target.checked
    dispatch.user.updateLogoutQueue(isChecked)
    changeQueueUserPreferences(isChecked, 'logout')
  }

  function updateLoginStatus(event: any) {
    const isChecked = event.target.checked
    dispatch.user.updateLoginQueue(isChecked)
    changeQueueUserPreferences(isChecked, 'login')
  }

  function updatePauseStatus(event: any) {
    const isChecked = event.target.checked
    dispatch.user.updatePauseQueue(isChecked)
    changeQueueUserPreferences(isChecked, 'pause')
  }

  const [selectedStatus, setSelectedStatus]: any = useState([])

  const qPauseAvailPresence = {
    id: 'pauseAvailPresence',
    name: t('Settings.Available presence'),
    options: [
      { value: 'callforward', label: t('Settings.Callforward') },
      { value: 'dnd', label: t('Settings.Do not disturb') },
    ],
  }
  function changePauseStatus(event: any) {
    const isChecked = event.target.checked
    const newSelectedPauseStatus = cloneDeep(selectedStatus)
    if (isChecked) {
      newSelectedPauseStatus.push(event.target.value)
      setSelectedStatus(newSelectedPauseStatus)
    } else {
      let index = newSelectedPauseStatus.indexOf(event.target.value)
      newSelectedPauseStatus.splice(index, 1)
      setSelectedStatus(newSelectedPauseStatus)
    }

    savePreference('pauseSelectedPreference', newSelectedPauseStatus, auth.username)

    const updatePresenceStringify = JSON.stringify(newSelectedPauseStatus)

    changeQueueUserPreferences(updatePresenceStringify, 'callForward/dnd')

    dispatch.user.updateQueueAutopausePresencelist(newSelectedPauseStatus)
  }

  useEffect(() => {
    const queueAutopausePresenceList = normalizeSelectedStatus(
      userSettingsInformation?.queue_autopause_presencelist,
    )

    if (!isEmpty(queueAutopausePresenceList)) {
      setSelectedStatus(queueAutopausePresenceList)
      return
    }

    const selectedStatusPause = normalizeSelectedStatus(
      loadPreference('pauseSelectedPreference', auth.username) || [],
    )

    if (!isEmpty(selectedStatusPause)) {
      setSelectedStatus(selectedStatusPause)
    }
  }, [auth?.username, userSettingsInformation?.queue_autopause_presencelist])

  return (
    <fieldset>
      <legend className='sr-only'>Notifications</legend>
      <div className='space-y-5'>
        {/* logout  */}
        <div className='relative flex items-start'>
          <div className='flex h-6 items-center'>
            <input
              id='comments'
              aria-describedby='comments-description'
              name='comments'
              type='checkbox'
              checked={Boolean(userSettingsInformation?.queue_auto_logout)}
              onChange={updateLogoutStatus}
              className='h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600'
            />
          </div>
          <div className='ml-3 text-sm'>
            <label
              htmlFor='comments'
              className='font-medium leading-6 text-gray-900 dark:text-gray-100 mt-4 text-sm'
            >
              {t('Settings.Logout from queue automatically')}
            </label>
            <p id='comments-description' className='text-gray-500 dark:text-gray-200'>
              {t('Settings.When you exit the app')}
            </p>
          </div>
        </div>

        {/* login  */}
        <div className='relative flex items-start'>
          <div className='flex h-6 items-center'>
            <input
              id='candidates'
              aria-describedby='candidates-description'
              name='candidates'
              type='checkbox'
              checked={Boolean(userSettingsInformation?.queue_auto_login)}
              onChange={updateLoginStatus}
              className='h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600'
            />
          </div>
          <div className='ml-3 text-sm leading-6'>
            <label htmlFor='candidates' className='font-medium text-gray-900 dark:text-gray-300'>
              {t('Settings.Login from queue automatically')}
            </label>
            <p id='candidates-description' className='text-gray-500 dark:text-gray-200'>
              {t('Settings.When you enter the app')}
            </p>
          </div>
        </div>

        {/* pause  */}
        <div className='relative flex items-start'>
          <div className='flex h-6 items-center'>
            <input
              id='offers'
              aria-describedby='offers-description'
              name='offers'
              type='checkbox'
              checked={Boolean(userSettingsInformation?.queue_auto_pause_onpresence)}
              onChange={updatePauseStatus}
              className='h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 '
            />
          </div>
          <div className='ml-3 text-sm leading-6'>
            <label htmlFor='offers' className='font-medium text-gray-900 dark:text-gray-300'>
              {t('Settings.Pause from queue automatically')}
            </label>
            <p id='offers-description' className='text-gray-500 dark:text-gray-200'>
              {t('Settings.For the following states')}:
            </p>
          </div>
        </div>
        {userSettingsInformation?.queue_auto_pause_onpresence && (
          <>
            <div className='ml-7 grid grid-cols-[8rem,8rem] gap-2 whitespace-nowrap'>
              {qPauseAvailPresence.options.map((option: any) => (
                <div key={option.value} className='flex items-center'>
                  <input
                    id={`settings-${option?.value}`}
                    name={`pauseStatus-${qPauseAvailPresence?.id}`}
                    type='checkbox'
                    checked={selectedStatus?.includes(option?.value)}
                    value={option?.value}
                    onChange={changePauseStatus}
                    className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                  />
                  <label
                    htmlFor={`queues-${option?.value}`}
                    className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </fieldset>
  )
}

CheckboxPreferencesQueues.displayName = 'CheckboxPreferencesQueues'
