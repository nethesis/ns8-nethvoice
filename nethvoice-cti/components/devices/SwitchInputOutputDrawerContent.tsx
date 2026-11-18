// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useEffect, useState, Fragment } from 'react'
import { InlineNotification } from '../common'
import { DrawerFooter } from '../common/DrawerFooter'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { t } from 'i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faCircleInfo } from '@fortawesome/free-solid-svg-icons'

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
import { useTheme } from '../../theme/Context'

export interface SwitchInputOutputDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

function pickCurrentOrDefaultDevice(devices: any[], storedDevice: any) {
  const storedDeviceInfo = devices.find((device: any) => device.deviceId === storedDevice?.deviceId)
  if (storedDeviceInfo) {
    return storedDeviceInfo
  }
  return (
    devices.find((device: any) => device.deviceId === 'default') ||
    devices.find((device: any) => device.deviceId === 'communications') ||
    devices[0]
  )
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
  const { input: inputTheme } = useTheme().theme

  const selectButtonClasses = classNames(
    inputTheme.base,
    inputTheme.rounded.base,
    inputTheme.colors.gray,
    'relative w-full cursor-default border px-3 py-1.5 pr-10 text-left text-sm leading-5 shadow-sm focus:outline-none data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
  )

  useEffect(() => {
    const checkInputOutputDevices = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((deviceInfos) => {
          // a device without a label cannot be shown nor selected: the browser hides
          // the labels until the user grants the permission for that kind of device
          const audioInputs = deviceInfos.filter(
            (device) => device.kind === 'audioinput' && device.label,
          )
          const audioOutputs = deviceInfos.filter(
            (device) => device.kind === 'audiooutput' && device.label,
          )
          const videoInputs = deviceInfos.filter(
            (device) => device.kind === 'videoinput' && device.label,
          )
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
    if (!isEmpty(audioInputs)) {
      setSelectedAudioInput(pickCurrentOrDefaultDevice(audioInputs, audioInputValueStore))
    }
  }, [audioInputValueStore, audioInputs])

  useEffect(() => {
    if (!isEmpty(audioOutputs)) {
      setSelectedAudioOutput(pickCurrentOrDefaultDevice(audioOutputs, audioOutputValueStore))
    }
  }, [audioOutputValueStore, audioOutputs])

  useEffect(() => {
    if (!isEmpty(videoInputs)) {
      setSelectedVideoInput(pickCurrentOrDefaultDevice(videoInputs, videoInputValueStore))
    }
  }, [videoInputValueStore, videoInputs])

  const isDeviceUnavailable =
    profile?.default_device?.type == 'nethlink' || profile?.mainPresence !== 'online'

  return (
    <>
      <DrawerHeader title={`${t('Devices.Web phone settings')}`} onClose={closeSideDrawer} />
      <div className='px-6 pb-6'>
        <Divider spaceAbove='pt-6' spaceBelow='pb-6' />
        <>
          {/* Audio input section */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <span className='text-secondaryNeutral dark:text-secondaryNeutralDark leading-5 text-sm font-medium'>
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
          <Listbox
            value={selectedAudioInput}
            onChange={handleSelectedAudioInput}
            disabled={!audioInputs?.length}
          >
            {({ open }) => (
              <>
                <div className='flex items-center mt-2'>
                  <div className='relative w-full'>
                    <ListboxButton className={selectButtonClasses}>
                      <span
                        className={`${
                          selectedAudioInput?.label
                            ? 'text-secondaryNeutral dark:text-secondaryNeutralDark'
                            : 'text-placeHolderInputText dark:text-placeHolderInputTextDark'
                        } block truncate font-normal`}
                      >
                        {selectedAudioInput?.label
                          ? selectedAudioInput?.label
                          : audioInputs?.length
                          ? t('Devices.Select audio input')
                          : t('Devices.No devices available')}
                      </span>
                      <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className='h-4 w-4'
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
                      <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-gray-500/5 dark:bg-gray-950 focus:outline-none sm:text-sm h-auto'>
                        {Object.entries<any>(audioInputs)?.map(([audioInputId, audioInputInfo]) => (
                          <ListboxOption
                            key={audioInputId}
                            className='relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 dark:text-gray-100 data-[focus]:cursor-pointer data-[focus]:bg-gray-100 data-[focus]:text-gray-950 data-[focus]:dark:bg-gray-800 data-[focus]:dark:text-gray-100'
                            value={audioInputInfo}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? 'font-semibold' : 'font-normal',
                                    'block truncate',
                                  )}
                                >
                                  {audioInputInfo?.label}
                                </span>

                                {selected || selectedAudioInput?.label === audioInputInfo?.label ? (
                                  <span className='absolute inset-y-0 right-0 flex items-center pr-4 text-primary dark:text-primaryDark'>
                                    <FontAwesomeIcon
                                      icon={faCheck}
                                      className='h-4 w-4 shrink-0'
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
          <div className='flex items-center justify-between pt-8'>
            <div className='flex items-center'>
              <span className='text-secondaryNeutral dark:text-secondaryNeutralDark leading-5 text-sm font-medium'>
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
          <Listbox
            value={selectedAudioOutput}
            onChange={handleSelectedAudioOutput}
            disabled={!audioOutputs?.length}
          >
            {({ open }) => (
              <>
                <div className='flex items-center mt-2'>
                  <div className='relative w-full'>
                    <ListboxButton className={selectButtonClasses}>
                      <span
                        className={`${
                          selectedAudioOutput?.label
                            ? 'text-secondaryNeutral dark:text-secondaryNeutralDark'
                            : 'text-placeHolderInputText dark:text-placeHolderInputTextDark'
                        } block truncate font-normal`}
                      >
                        {selectedAudioOutput?.label
                          ? selectedAudioOutput?.label
                          : audioOutputs?.length
                          ? t('Devices.Select audio output')
                          : t('Devices.No devices available')}
                      </span>

                      <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className='h-4 w-4'
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
                      <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-gray-500/5 dark:bg-gray-950 focus:outline-none sm:text-sm h-auto'>
                        {Object.entries<any>(audioOutputs)?.map(
                          ([audioOutputId, audioOutputInfo]) => (
                            <ListboxOption
                              key={audioOutputId}
                              className='relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 dark:text-gray-100 data-[focus]:cursor-pointer data-[focus]:bg-gray-100 data-[focus]:text-gray-950 data-[focus]:dark:bg-gray-800 data-[focus]:dark:text-gray-100'
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
                                    <span className='absolute inset-y-0 right-0 flex items-center pr-4 text-primary dark:text-primaryDark'>
                                      <FontAwesomeIcon
                                        icon={faCheck}
                                        className='h-4 w-4 shrink-0'
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
          <div className='flex items-center justify-between pt-8'>
            <div className='flex items-center'>
              <span className='text-secondaryNeutral dark:text-secondaryNeutralDark leading-5 text-sm font-medium'>
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
          <Listbox
            value={selectedVideoInput}
            onChange={handleSelectedVideoInput}
            disabled={!videoInputs?.length}
          >
            {({ open }) => (
              <>
                <div className='flex items-center mt-2'>
                  <div className='relative w-full'>
                    <ListboxButton className={selectButtonClasses}>
                      <span
                        className={`${
                          selectedVideoInput?.label
                            ? 'text-secondaryNeutral dark:text-secondaryNeutralDark'
                            : 'text-placeHolderInputText dark:text-placeHolderInputTextDark'
                        } block truncate font-normal`}
                      >
                        {selectedVideoInput?.label
                          ? selectedVideoInput?.label
                          : videoInputs?.length
                          ? t('Devices.Select video input')
                          : t('Devices.No devices available')}
                      </span>
                      <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className='h-4 w-4'
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
                      <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-gray-500/5 dark:bg-gray-950 focus:outline-none sm:text-sm h-auto'>
                        {videoInputs?.map((videoInputInfo, videoInputId) => (
                          <ListboxOption
                            key={videoInputId}
                            className='relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 dark:text-gray-100 data-[focus]:cursor-pointer data-[focus]:bg-gray-100 data-[focus]:text-gray-950 data-[focus]:dark:bg-gray-800 data-[focus]:dark:text-gray-100'
                            value={videoInputInfo}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={classNames(
                                    selected ? 'font-semibold' : 'font-normal',
                                    'block truncate',
                                  )}
                                >
                                  {videoInputInfo?.label}
                                </span>

                                {selected || selectedVideoInput?.label === videoInputInfo?.label ? (
                                  <span className='absolute inset-y-0 right-0 flex items-center pr-4 text-primary dark:text-primaryDark'>
                                    <FontAwesomeIcon
                                      icon={faCheck}
                                      className='h-4 w-4 shrink-0'
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
        <Divider spaceAbove='pt-8' spaceBelow='pb-6' />

        {/* Footer section */}
        <DrawerFooter
          confirmLabel={`${t('Common.Save')}`}
          onConfirm={handleUpdateDevices}
          confirmDisabled={isDeviceUnavailable}
        />
      </div>
    </>
  )
})

SwitchInputOutputDrawerContent.displayName = 'SwitchInputOutputDrawerContent'
