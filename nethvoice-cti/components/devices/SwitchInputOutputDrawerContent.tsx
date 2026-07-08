// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useEffect, useState, Fragment } from 'react'
import { Button, InlineNotification } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { t } from 'i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faCircleInfo } from '@fortawesome/free-solid-svg-icons'

import { Tooltip } from 'react-tooltip'
import { closeSideDrawer } from '../../lib/utils'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import { RootState } from '../../store'
import { useSelector } from 'react-redux'
import { getInputOutputLocalStorageValue } from '../../lib/devices'
import { eventDispatch } from '../../lib/hooks/eventDispatch'
import { isEmpty } from 'lodash'
import { setJSONItem } from '../../lib/storage'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

export interface SwitchInputOutputDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const SwitchInputOutputDrawerContent = forwardRef<
  HTMLButtonElement,
  SwitchInputOutputDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const [selectedAudioInput, setSelectedAudioInput] = useState<any>('')
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<any>('')
  const [selectedVideoInput, setSelectedVideoInput] = useState<any>('')

  const [audioInputs, setAudioInputs] = useState<any[]>([])
  const [audioOutputs, setAudioOutputs] = useState<any[]>([])
  const [videoInputs, setVideoInputs] = useState<any[]>([])
  const auth = useSelector((state: RootState) => state.authentication)
  const profile = useSelector((state: RootState) => state.user)

  useEffect(() => {
    const checkInputOutputDevices = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((deviceInfos) => {
          const audioInputs = deviceInfos.filter((device) => device.kind === 'audioinput')
          const audioOutputs = deviceInfos.filter((device) => device.kind === 'audiooutput')
          const videoInputs = deviceInfos.filter((device) => device.kind === 'videoinput')
          setAudioInputs(audioInputs)
          setAudioOutputs(audioOutputs)
          setVideoInputs(videoInputs)
        })
        .catch((error) => {
          console.error('error', error)
        })
    }

    checkInputOutputDevices()

    navigator.mediaDevices.addEventListener('devicechange', checkInputOutputDevices)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', checkInputOutputDevices)
    }
  }, [])

  const handleSelectedAudioInput = (newAudioInputSelected: any) => {
    setSelectedAudioInput(newAudioInputSelected)
  }

  const handleSelectedAudioOutput = (newAudioOutputSelected: any) => {
    setSelectedAudioOutput(newAudioOutputSelected)
  }

  const handleSelectedVideoInput = (newVideoInputSelected: any) => {
    setSelectedVideoInput(newVideoInputSelected)
  }

  const [audioInputValueStore, setAudioInputValueStore] = useState<any>('')
  const [audioOutputValueStore, setAudioOutputValueStore] = useState<any>('')
  const [videoInputValueStore, setVideoInputValueStore] = useState<any>('')

  const handleUpdateDevices = () => {
    eventDispatch('phone-island-audio-input-change', { deviceId: selectedAudioInput?.deviceId })
    setJSONItem('phone-island-audio-input-device', { deviceId: selectedAudioInput?.deviceId })
    eventDispatch('phone-island-audio-output-change', { deviceId: selectedAudioOutput?.deviceId })
    setJSONItem('phone-island-audio-output-device', { deviceId: selectedAudioOutput?.deviceId })
    eventDispatch('phone-island-video-input-change', { deviceId: selectedVideoInput?.deviceId })
    setJSONItem('phone-island-video-input-device', { deviceId: selectedVideoInput?.deviceId })
    closeSideDrawer()
  }

  //Get input/output value from local storage
  useEffect(() => {
    const inputOutputValues = getInputOutputLocalStorageValue(auth?.username)
    setAudioInputValueStore(inputOutputValues?.audioInputType)
    setAudioOutputValueStore(inputOutputValues?.audioOutputType)
    setVideoInputValueStore(inputOutputValues?.videoInputType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isEmpty(audioInputValueStore) && !isEmpty(audioInputs)) {
      const selectedInput = audioInputs.find(
        (input: any) => input.deviceId === audioInputValueStore?.deviceId,
      )
      setSelectedAudioInput(selectedInput)
    }
  }, [audioInputValueStore, audioInputs])

  useEffect(() => {
    if (!isEmpty(audioOutputValueStore) && !isEmpty(audioOutputs)) {
      const selectedOutput = audioOutputs.find(
        (output: any) => output.deviceId === audioOutputValueStore?.deviceId,
      )
      setSelectedAudioOutput(selectedOutput)
    }
  }, [audioOutputValueStore, audioOutputs])

  useEffect(() => {
    if (!isEmpty(videoInputValueStore) && !isEmpty(videoInputs)) {
      const selectedInput = videoInputs.find(
        (input: any) => input.deviceId === videoInputValueStore?.deviceId,
      )
      setSelectedVideoInput(selectedInput)
    }
  }, [videoInputValueStore, videoInputs])

  const isDeviceUnavailable =
    profile?.default_device?.type == 'nethlink' || profile?.mainPresence !== 'online'

  return (
    <>
      <DrawerHeader title={`${t('Devices.Audio and video settings')}`} />
      <div className='px-5'>
        <Divider />
        <>
          {/* Audio input section */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <span className='dark:text-gray-200 leading-5 text-sm font-medium'>
                {t('Devices.Microphone')}
              </span>
              <FontAwesomeIcon
                icon={faCircleInfo}
                className='h-4 w-4 pl-2 py-2 text-primaryIndigo dark:text-primaryIndigoDark flex items-center'
                aria-hidden='true'
                data-tooltip-id='tooltip-input-information'
                data-tooltip-content={t('Devices.Audio input information tooltip') || ''}
              />
              {/* Audio input information tooltip */}
              <CustomThemedTooltip id='tooltip-input-information' place='right' />
            </div>
          </div>

          {/* Audio input select */}
          <Listbox value={selectedAudioInput} onChange={handleSelectedAudioInput}>
            {({ open }) => (
              <>
                <div className='flex items-center mt-2'>
                  <div className='relative w-full'>
                    <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pr-10 text-left focus:outline-none sm:text-sm sm:leading-6 border dark:border-gray-700'>
                      <span
                        className={`${
                          selectedAudioInput?.label
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-300'
                        } block truncate mr-1 ml-4 font-medium`}
                      >
                        {selectedAudioInput?.label
                          ? selectedAudioInput?.label
                          : t('Devices.Select audio input')}
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
                      <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-950 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none sm:text-sm h-auto'>
                        {Object.entries<any>(audioInputs)?.map(([audioInputId, audioInputInfo]) => (
                          <ListboxOption
                            key={audioInputId}
                            className='data-[focus]:bg-gray-100 data-[focus]:dark:bg-gray-800 data-[focus]:text-gray-950 data-[focus]:dark:text-gray-100 text-gray-900 dark:text-gray-200 relative cursor-default select-none py-2 pl-8 pr-4'
                            value={audioInputInfo}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? 'font-medium' : 'font-normal',
                                    'block truncate',
                                  )}
                                >
                                  {audioInputInfo?.label}
                                </span>

                                {selected || selectedAudioInput?.label === audioInputInfo?.label ? (
                                  <span className='text-primary dark:text-primaryDark absolute inset-y-0 left-0 flex items-center pl-1.5'>
                                    <FontAwesomeIcon
                                      icon={faCheck}
                                      className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
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
                </div>
              </>
            )}
          </Listbox>

          {/* Audio output section */}
          <div className='flex items-center justify-between pt-6'>
            <div className='flex items-center'>
              <span className='dark:text-gray-200 leading-5 text-sm font-medium'>
                {t('Devices.Speaker')}
              </span>
              <FontAwesomeIcon
                icon={faCircleInfo}
                className='h-4 w-4 pl-2 py-2 text-primaryIndigo dark:text-primaryIndigoDark flex items-center tooltip-output-information'
                aria-hidden='true'
                data-tooltip-id='tooltip-output-information'
                data-tooltip-content={t('Devices.Audio output information tooltip') || ''}
              />
              {/* Audio output information tooltip */}
              <CustomThemedTooltip id='tooltip-output-information' place='right' />
            </div>
          </div>

          {/* Audio output select */}
          <Listbox value={selectedAudioOutput} onChange={handleSelectedAudioOutput}>
            {({ open }) => (
              <>
                <div className='flex items-center mt-2'>
                  <div className='relative w-full'>
                    <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pr-10 text-left text-gray-700 dark:text-gray-300 focus:outline-none sm:text-sm sm:leading-6 border dark:border-gray-700'>
                      <span
                        className={`${
                          selectedAudioOutput?.label
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-300'
                        } block truncate mr-1 ml-4 font-medium`}
                      >
                        {selectedAudioOutput?.label
                          ? selectedAudioOutput?.label
                          : t('Devices.Select audio output')}
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
                      <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-950 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none sm:text-sm h-auto'>
                        {Object.entries<any>(audioOutputs)?.map(
                          ([audioOutputId, audioOutputInfo]) => (
                            <ListboxOption
                              key={audioOutputId}
                              className='data-[focus]:bg-gray-100 data-[focus]:dark:bg-gray-800 data-[focus]:text-gray-950 data-[focus]:dark:text-gray-100 text-gray-900 dark:text-gray-100 relative cursor-default select-none py-2 pl-8 pr-4'
                              value={audioOutputInfo}
                            >
                              {({ selected }) => (
                                <>
                                  <span
                                    className={classNames(
                                      selected ? 'font-semibold' : 'font-normal',
                                      'block truncate',
                                    )}
                                  >
                                    {audioOutputInfo?.label}
                                  </span>

                                  {selected ||
                                  selectedAudioOutput?.label === audioOutputInfo?.label ? (
                                    <span className='data-[focus]:text-white text-primary dark:text-primaryDark absolute inset-y-0 left-0 flex items-center pl-1.5'>
                                      <FontAwesomeIcon
                                        icon={faCheck}
                                        className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
                                        aria-hidden='true'
                                      />
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </ListboxOption>
                          ),
                        )}
                      </ListboxOptions>
                    </Transition>
                  </div>
                </div>
              </>
            )}
          </Listbox>

          {/* Video input section */}
          <div className='flex items-center justify-between pt-6'>
            <div className='flex items-center'>
              <span className='dark:text-gray-200 leading-5 text-sm font-medium'>
                {t('Devices.Camera')}
              </span>
              <FontAwesomeIcon
                icon={faCircleInfo}
                className='h-4 w-4 pl-2 py-2 text-primaryIndigo dark:text-primaryIndigoDark flex items-center'
                aria-hidden='true'
                data-tooltip-id='tooltip-video-input-information'
                data-tooltip-content={t('Devices.Video input information tooltip') || ''}
              />
              {/* Video input information tooltip */}
              <CustomThemedTooltip id='tooltip-video-input-information' place='right' />
            </div>
          </div>

          {/* Video input select */}
          <Listbox value={selectedVideoInput} onChange={handleSelectedVideoInput}>
            {({ open }) => (
              <>
                <div className='flex items-center mt-2'>
                  <div className='relative w-full'>
                    <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pr-10 text-left focus:outline-none sm:text-sm sm:leading-6 border dark:border-gray-700'>
                      <span
                        className={`${
                          selectedVideoInput?.label
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-300'
                        } block truncate mr-1 ml-4 font-medium`}
                      >
                        {selectedVideoInput?.label
                          ? selectedVideoInput?.label
                          : t('Devices.Select video input')}
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
                      <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-950 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none sm:text-sm h-auto'>
                        {videoInputs?.map((videoInputInfo, videoInputId) => (
                          <ListboxOption
                            key={videoInputId}
                            className='data-[focus]:bg-gray-100 data-[focus]:dark:bg-gray-800 data-[focus]:text-gray-950 data-[focus]:dark:text-gray-100 text-gray-900 dark:text-gray-200 relative cursor-default select-none py-2 pl-8 pr-4'
                            value={videoInputInfo}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? 'font-medium' : 'font-normal',
                                    'block truncate',
                                  )}
                                >
                                  {videoInputInfo?.label}
                                </span>

                                {selected || selectedVideoInput?.label === videoInputInfo?.label ? (
                                  <span className='text-primary dark:text-primaryDark absolute inset-y-0 left-0 flex items-center pl-1.5'>
                                    <FontAwesomeIcon
                                      icon={faCheck}
                                      className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
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
                </div>
              </>
            )}
          </Listbox>
        </>

        {/* Inline notification */}
        {isDeviceUnavailable && (
          <InlineNotification title={t('Common.Warning')} type='warning' className='mt-6'>
            <p>{t('Devices.Inline warning message devices')}</p>
          </InlineNotification>
        )}

        {/* Divider */}
        <Divider paddingY='pb-10 pt-6' />

        {/* Footer section */}
        <div className='flex justify-end'>
          <Button variant='ghost' type='submit' onClick={closeSideDrawer} className='mb-4'>
            {t('Common.Cancel')}
          </Button>
          <Button
            variant='primary'
            type='submit'
            className='mb-4 ml-4'
            disabled={isDeviceUnavailable}
            onClick={handleUpdateDevices}
          >
            {t('Common.Save')}
          </Button>
        </div>
      </div>
    </>
  )
})

SwitchInputOutputDrawerContent.displayName = 'SwitchInputOutputDrawerContent'
