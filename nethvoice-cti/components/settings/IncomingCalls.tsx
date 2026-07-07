// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store'
import { loadPreference, savePreference } from '../../lib/storage'
import CopyComponent from '../common/CopyComponent'
import { InlineNotification, TextInput, Button } from '../common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleInfo,
  faCheck,
  faChevronDown,
  faPlay,
  faStop,
} from '@fortawesome/free-solid-svg-icons'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { getParamUrl } from '../../services/user'
import { setIncomingCallsPreference } from '../../lib/incomingCall'
import { eventDispatch } from '../../lib/hooks/eventDispatch'
import { useEventListener } from '../../lib/hooks/useEventListener'
import type { Ringtone } from '../../models/ringtones'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'

// URL opening trigger options
const TRIGGER_RINGING = 'ringing'
const TRIGGER_ANSWERED = 'answered'
const TRIGGER_BUTTON = 'button'
const TRIGGER_NEVER = 'never'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const IncomingCalls = () => {
  const { t } = useTranslation()
  const authStore = useSelector((state: RootState) => state.authentication)
  const userStore = useSelector((state: RootState) => state.user)
  const incomingCallStore = useSelector((state: RootState) => state.incomingCall)
  const ringtonesStore = useSelector((state: RootState) => state.ringtones)
  const dispatch = useDispatch()

  const [callUrl, setCallUrl] = useState<string>('')
  const [urlTrigger, setUrlTrigger] = useState<string>(TRIGGER_NEVER)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [paramUrlError, setParamUrlError] = useState<string>('')

  // Ringtone settings state
  const [selectedRingtone, setSelectedRingtone] = useState<Ringtone | undefined>(undefined)
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<MediaDeviceInfo | undefined>(
    undefined,
  )
  const [playingRingtone, setPlayingRingtone] = useState<string | null>(null)

  // Default URL in case API fails
  const defaultExampleUrl = 'https://www.example.com/customers?phone={phone}'

  // Request ringtones when component mounts
  useEffect(() => {
    eventDispatch('phone-island-ringing-tone-list', {})

    // Retry after 1 second if not loaded
    const retryTimeout = setTimeout(() => {
      if (!ringtonesStore.isLoaded) {
        eventDispatch('phone-island-ringing-tone-list', {})
      }
    }, 1000)

    return () => clearTimeout(retryTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for ringtones response
  useEventListener('phone-island-ringing-tone-list-response', (data: any) => {
    if (data?.ringtones) {
      dispatch.ringtones.setRingtones(data.ringtones)
    }
  })

  // Debug: log ringtonesStore changes
  useEffect(() => {
    console.log('ringtonesStore:', ringtonesStore)
  }, [ringtonesStore])

  // Load audio output devices
  useEffect(() => {
    const initAudioOutputDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioOutput = devices.filter((device) => device.kind === 'audiooutput')
        setAudioOutputDevices(audioOutput)
      } catch (err) {
        console.error('Error reading audio output devices:', err)
      }
    }

    initAudioOutputDevices()
  }, [])

  // Load saved ringtone preferences
  useEffect(() => {
    const savedRingtone = loadPreference('incomingCallRingtone', authStore.username)
    if (savedRingtone && ringtonesStore.ringtones.length > 0) {
      const ringtone = ringtonesStore.ringtones.find((r) => r.name === savedRingtone)
      if (ringtone) {
        setSelectedRingtone(ringtone)
      }
    }
  }, [authStore.username, ringtonesStore.ringtones])

  // Load saved output device preferences
  useEffect(() => {
    const savedOutputDevice = loadPreference('incomingCallOutputDevice', authStore.username)
    if (savedOutputDevice && audioOutputDevices.length > 0) {
      const device = audioOutputDevices.find((d) => d.deviceId === savedOutputDevice)
      if (device) {
        setSelectedOutputDevice(device)
      }
    }
  }, [authStore.username, audioOutputDevices])

  // Listen for audio player close event
  useEventListener('phone-island-audio-player-close', () => {
    setPlayingRingtone(null)
  })

  // Listen for audio player closed event (when closing phone-island with X)
  useEventListener('phone-island-audio-player-closed', () => {
    setPlayingRingtone(null)
  })

  // Load URL from store or API if necessary
  useEffect(() => {
    const fetchParamUrl = async () => {
      setIsLoading(true)
      try {
        // Check if data is already in the store
        if (incomingCallStore.isLoaded && incomingCallStore.paramUrl) {
          // Use data from the store
          setCallUrl(incomingCallStore.paramUrl)
          setParamUrlError('')
        } else {
          // Load data from API only if not already in the store
          const response = await getParamUrl()
          const apiUrl = response?.data?.url || defaultExampleUrl
          const onlyQueues = response?.data?.only_queues || false

          // Save URL and onlyQueues to store
          dispatch.incomingCall.setParamUrl(apiUrl)
          dispatch.incomingCall.setOnlyQueues(onlyQueues)
          dispatch.incomingCall.setLoaded(true)

          setCallUrl(apiUrl)

          // Save URL and onlyQueues to localStorage
          savePreference('incomingCallUrl', apiUrl, authStore.username)
          savePreference('paramUrlOnlyQueues', onlyQueues, authStore.username)
          setParamUrlError('')
        }

        // Determine trigger value from user settings with fallback
        let triggerValue = TRIGGER_NEVER

        // Check if there's a value stored in user settings
        if (userStore.settings?.open_param_url) {
          triggerValue = userStore.settings.open_param_url
        } else {
          // Otherwise check localStorage
          const savedTrigger = loadPreference('incomingCallTrigger', authStore.username)
          if (savedTrigger) {
            triggerValue = savedTrigger
          }
        }

        setUrlTrigger(triggerValue)
        savePreference('incomingCallTrigger', triggerValue, authStore.username)
      } catch (error) {
        console.error('Error loading parameter URL:', error)
        setParamUrlError('Cannot retrieve URL configuration')

        // Use default example and saved preferences as fallback
        const savedUrl = loadPreference('incomingCallUrl', authStore.username) || defaultExampleUrl
        setCallUrl(savedUrl)

        // Fallback for trigger value
        let triggerValue = TRIGGER_NEVER
        if (userStore.settings?.open_param_url) {
          triggerValue = userStore.settings.open_param_url
        } else {
          const savedTrigger = loadPreference('incomingCallTrigger', authStore.username)
          if (savedTrigger) {
            triggerValue = savedTrigger
          }
        }

        setUrlTrigger(triggerValue)
        savePreference('incomingCallTrigger', triggerValue, authStore.username)
      } finally {
        setIsLoading(false)
      }
    }

    fetchParamUrl()
  }, [
    authStore.username,
    userStore.settings?.open_param_url,
    incomingCallStore.isLoaded,
    incomingCallStore.paramUrl,
    dispatch.incomingCall,
    incomingCallStore.isUrlAvailable,
  ])

  // Save URL when changed
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value
    setCallUrl(newUrl)
    savePreference('incomingCallUrl', newUrl, authStore.username)
  }

  // Save trigger option when changed
  const handleTriggerChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // If URL is not available, don't allow preference change
    if (!incomingCallStore.isUrlAvailable && event.target.id !== TRIGGER_NEVER) {
      return
    }

    const newTrigger = event.target.id
    setUrlTrigger(newTrigger)

    // Save to localStorage
    savePreference('incomingCallTrigger', newTrigger, authStore.username)

    try {
      // Set new vaure to /me
      await setIncomingCallsPreference({ open_param_url: newTrigger })

      // store
      dispatch.user.updateOpenParamUrl(newTrigger)
    } catch (error) {
      setParamUrlError(t('Settings.Error saving settings') || '')
    }
  }

  // Handle ringtone change
  const handleRingtoneChange = (ringtone: Ringtone) => {
    setSelectedRingtone(ringtone)

    // Save to localStorage
    savePreference('incomingCallRingtone', ringtone.name, authStore.username)

    // Dispatch phone-island event to select ringtone
    eventDispatch('phone-island-ringing-tone-select', {
      name: ringtone.name,
    })

    console.info('Ringtone changed:', ringtone.name)
  }

  // Handle output device change
  const handleOutputDeviceChange = (device: MediaDeviceInfo) => {
    setSelectedOutputDevice(device)

    // Save to localStorage
    savePreference('incomingCallOutputDevice', device.deviceId, authStore.username)

    // Dispatch phone-island event to set output device
    eventDispatch('phone-island-ringing-tone-output', {
      deviceId: device.deviceId,
    })

    console.info('Output device changed:', device.deviceId)
  }

  // Play ringtone preview
  const playRingtonePreview = (ringtone: Ringtone) => {
    setPlayingRingtone(ringtone.name)
    eventDispatch('phone-island-audio-player-start', {
      base64_audio_file: ringtone.base64Audio,
      description: ringtone.displayName,
      type: 'ringtone_preview',
    })
  }

  // Stop ringtone preview
  const stopRingtonePreview = () => {
    setPlayingRingtone(null)
    eventDispatch('phone-island-audio-player-pause', {})
    eventDispatch('phone-island-audio-player-close', {})
  }

  return (
    <>
      <div className='py-6 px-4 sm:p-6'>
        <div>
          <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
            {t('Settings.Incoming calls')}
          </h2>
        </div>

        {/* Ringtone Section */}
        <div className='mb-8'>
          <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4'>
            {t('Settings.Ringtone')}
          </h4>

          {/* Ringtone selection */}
          <div className='mb-4 max-w-3xl'>
            <label
              htmlFor='ringtone'
              className='block text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark mb-2'
            >
              {t('Settings.Select ringtone')}
            </label>
            <div className='flex gap-2'>
              <div className='flex-1'>
                <Listbox
                  value={selectedRingtone}
                  onChange={handleRingtoneChange}
                  disabled={!ringtonesStore.isLoaded}
                >
                  {({ open }) => (
                    <>
                      <div className='relative'>
                        <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pr-10 text-left focus:outline-none sm:text-sm sm:leading-6 border dark:border-gray-700'>
                          <span
                            className={`${
                              selectedRingtone?.name
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-500 dark:text-gray-300'
                            } block truncate mr-1 ml-4 font-medium`}
                          >
                            {selectedRingtone?.displayName
                              ? selectedRingtone.displayName
                              : !ringtonesStore.isLoaded
                              ? t('Common.Loading')
                              : t('Settings.Select an option')}
                          </span>
                          <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                            <FontAwesomeIcon
                              icon={faChevronDown}
                              className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
                              aria-hidden='true'
                            />
                          </span>
                        </ListboxButton>

                        <Transition
                          show={open}
                          as={Fragment}
                          leave='transition ease-in duration-100'
                          leaveFrom='opacity-100'
                          leaveTo='opacity-0'
                        >
                          <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-950 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none sm:text-sm max-h-60'>
                            {ringtonesStore.ringtones.length === 0 ? (
                              <div className='px-3 py-2 text-sm text-gray-500 dark:text-gray-400'>
                                {ringtonesStore.isLoaded
                                  ? t('Settings.No ringtones available')
                                  : t('Common.Loading')}
                              </div>
                            ) : (
                              ringtonesStore.ringtones.map((ringtone) => (
                                <ListboxOption
                                  key={ringtone.name}
                                  className={({ active }) =>
                                    classNames(
                                      active ? 'bg-primaryIndigo text-white' : '',
                                      !active ? 'text-gray-700 dark:text-gray-100' : '',
                                      'relative cursor-default select-none py-2 pl-3 pr-9',
                                    )
                                  }
                                  value={ringtone}
                                >
                                  {({ selected, active }) => (
                                    <>
                                      <span
                                        className={classNames(
                                          selected ? 'font-semibold' : 'font-normal',
                                          'block truncate',
                                        )}
                                      >
                                        {ringtone.displayName}
                                      </span>

                                      {selected ? (
                                        <span
                                          className={classNames(
                                            active ? 'text-white' : 'text-primaryIndigo',
                                            'absolute inset-y-0 right-0 flex items-center pr-4',
                                          )}
                                        >
                                          <FontAwesomeIcon
                                            icon={faCheck}
                                            className='h-3.5 w-3.5'
                                            aria-hidden='true'
                                          />
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </ListboxOption>
                              ))
                            )}
                          </ListboxOptions>
                        </Transition>
                      </div>
                    </>
                  )}
                </Listbox>
              </div>

              {/* Preview button */}
              <Button
                variant='primary'
                onClick={() =>
                  playingRingtone === selectedRingtone?.name
                    ? stopRingtonePreview()
                    : selectedRingtone && playRingtonePreview(selectedRingtone)
                }
                disabled={!selectedRingtone}
                className='h-[38px]'
              >
                <FontAwesomeIcon
                  icon={playingRingtone === selectedRingtone?.name ? faStop : faPlay}
                  className='h-4 w-4'
                />
              </Button>
            </div>
          </div>

          {/* Output device selection */}
          <div className='mb-4 max-w-3xl'>
            <label
              htmlFor='outputDevice'
              className='block text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark mb-2'
            >
              {t('Settings.Ringtone output device')}
            </label>
            <Listbox value={selectedOutputDevice} onChange={handleOutputDeviceChange}>
              {({ open }) => (
                <>
                  <div className='relative'>
                    <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pr-10 text-left focus:outline-none sm:text-sm sm:leading-6 border dark:border-gray-700'>
                      <span
                        className={`${
                          selectedOutputDevice?.label
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-300'
                        } block truncate mr-1 ml-4 font-medium`}
                      >
                        {selectedOutputDevice?.label
                          ? selectedOutputDevice.label
                          : t('Settings.Select an option')}
                      </span>
                      <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
                          aria-hidden='true'
                        />
                      </span>
                    </ListboxButton>

                    <Transition
                      show={open}
                      as={Fragment}
                      leave='transition ease-in duration-100'
                      leaveFrom='opacity-100'
                      leaveTo='opacity-0'
                    >
                      <ListboxOptions className='absolute z-30 mt-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-950 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none sm:text-sm max-h-60'>
                        {audioOutputDevices.map((device) => (
                          <ListboxOption
                            key={device.deviceId}
                            className={({ active }) =>
                              classNames(
                                active ? 'bg-primaryIndigo text-white' : '',
                                !active ? 'text-gray-700 dark:text-gray-100' : '',
                                'relative cursor-default select-none py-2 pl-3 pr-9',
                              )
                            }
                            value={device}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? 'font-semibold' : 'font-normal',
                                    'block truncate',
                                  )}
                                >
                                  {device.label ||
                                    `${t('Settings.Device')} ${device.deviceId.substring(0, 8)}`}
                                </span>

                                {selected ? (
                                  <span
                                    className={classNames(
                                      active ? 'text-white' : 'text-primaryIndigo',
                                      'absolute inset-y-0 right-0 flex items-center pr-4',
                                    )}
                                  >
                                    <FontAwesomeIcon
                                      icon={faCheck}
                                      className='h-3.5 w-3.5'
                                      aria-hidden='true'
                                    />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </ListboxOption>
                        ))}
                      </ListboxOptions>
                    </Transition>
                  </div>
                </>
              )}
            </Listbox>
          </div>
        </div>

        {/* Parameterized URL Section */}
        <div>
          <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4'>
            {t('Settings.Parameterized URL')}
          </h4>

          {/* URL input section */}
          <div className='mb-4 max-w-3xl'>
            <div className='flex items-center mb-2'>
              <label
                htmlFor='callUrl'
                className='block text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'
              >
                {t('Settings.URL opened on external incoming call')}
              </label>

              {/* Info icon with tooltip */}
              <FontAwesomeIcon
                icon={faCircleInfo}
                className='ml-2 h-4 w-4 text-iconTooltip dark:text-iconTooltipDark cursor-help'
                data-tooltip-id='url-info-tooltip'
                data-tooltip-content={t(
                  'Settings.This URL opens automatically for external incoming calls',
                )}
              />
              <CustomThemedTooltip id='url-info-tooltip' place='right' />
            </div>

            <div className='relative'>
              <div className='pointer-events-none'>
                <TextInput
                  id='callUrl'
                  name='callUrl'
                  value={isLoading ? t('Settings.Loading...') || 'Loading...' : callUrl}
                  onChange={handleUrlChange}
                  placeholder='https://www.example.com/customers?phone={phone}'
                  className='w-full'
                  disabled={true}
                  title={t('Settings.This field can only be modified by the administrator') || ''}
                />
              </div>

              {/* Overlay for the copy button that remains clickable */}
              <div className='absolute inset-y-0 right-0 flex items-center pr-3 z-20'>
                <CopyComponent
                  number={callUrl}
                  id='incoming-call-url'
                  isWhite={true}
                  notificationPosition='right'
                />
              </div>

              <div
                className='absolute inset-0 bg-transparent z-10 cursor-not-allowed'
                data-tooltip-id='disabled-field-tooltip'
                data-tooltip-content={t(
                  'Settings.This field can only be modified by the administrator',
                )}
              ></div>
              <CustomThemedTooltip id='disabled-field-tooltip' place='top' />
            </div>

            {/* Error message if API fails */}
            {paramUrlError && (
              <InlineNotification
                type='error'
                title={t('Settings.Error loading URL configuration')}
                className='mt-2 mb-2 max-w-3xl'
              >
                <p>{paramUrlError}</p>
              </InlineNotification>
            )}

            {/* Info message about popup*/}
            <InlineNotification
              type='info'
              title={t('Settings.Enable pop-ups in your browser')}
              className='my-8 max-w-3xl'
            >
              <p>
                {t(
                  'Settings.To correctly open the Call-activated URL, you need to enable pop-ups in your browser.',
                )}
              </p>
            </InlineNotification>
          </div>

          {/* URL opening trigger section */}
          <div className='mb-6 max-w-3xl'>
            <h4 className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark mb-4'>
              {t('Settings.URL opening trigger')}
            </h4>

            <div className='space-y-4'>
              {/* Ringing option */}
              <div className='flex items-start'>
                <div className='flex h-5 items-center'>
                  <input
                    id={TRIGGER_RINGING}
                    name='urlTrigger'
                    type='radio'
                    checked={urlTrigger === TRIGGER_RINGING}
                    onChange={handleTriggerChange}
                    className={`h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!incomingCallStore.isUrlAvailable}
                  />
                </div>
                <div className='ml-3 text-sm'>
                  <label
                    htmlFor={TRIGGER_RINGING}
                    className={`font-normal text-secondaryNeutral dark:text-secondaryNeutralDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {t('Settings.When the call is ringing')}
                  </label>
                </div>
              </div>

              {/* Answered option */}
              <div className='flex items-start'>
                <div className='flex h-5 items-center'>
                  <input
                    id={TRIGGER_ANSWERED}
                    name='urlTrigger'
                    type='radio'
                    checked={urlTrigger === TRIGGER_ANSWERED}
                    onChange={handleTriggerChange}
                    className={`h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!incomingCallStore.isUrlAvailable}
                  />
                </div>
                <div className='ml-3 text-sm'>
                  <label
                    htmlFor={TRIGGER_ANSWERED}
                    className={`font-normal text-secondaryNeutral dark:text-secondaryNeutralDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {t('Settings.When the call is answered')}
                  </label>
                </div>
              </div>

              {/* Button option */}
              <div className='flex items-start'>
                <div className='flex h-5 items-center'>
                  <input
                    id={TRIGGER_BUTTON}
                    name='urlTrigger'
                    type='radio'
                    checked={urlTrigger === TRIGGER_BUTTON}
                    onChange={handleTriggerChange}
                    className={`h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!incomingCallStore.isUrlAvailable}
                  />
                </div>
                <div className='ml-3 text-sm'>
                  <label
                    htmlFor={TRIGGER_BUTTON}
                    className={`font-normal text-secondaryNeutral dark:text-secondaryNeutralDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {t('Settings.When clicking the button on the Phone Island')}
                  </label>
                </div>
              </div>

              {/* Never option - also disabled when URL is not available */}
              <div className='flex items-start'>
                <div className='flex h-5 items-center'>
                  <input
                    id={TRIGGER_NEVER}
                    name='urlTrigger'
                    type='radio'
                    checked={urlTrigger === TRIGGER_NEVER}
                    onChange={handleTriggerChange}
                    className={`h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!incomingCallStore.isUrlAvailable}
                  />
                </div>
                <div className='ml-3 text-sm'>
                  <label
                    htmlFor={TRIGGER_NEVER}
                    className={`font-normal text-secondaryNeutral dark:text-secondaryNeutralDark ${
                      !incomingCallStore.isUrlAvailable ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {t('Settings.Never')}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
