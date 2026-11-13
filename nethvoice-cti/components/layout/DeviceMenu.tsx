import React, { Fragment, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Popover, PopoverPanel, Transition } from '@headlessui/react'
import { faAngleRight, faCheck, faDesktop, faHeadset } from '@fortawesome/free-solid-svg-icons'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Dropdown } from '../common'
import classNames from 'classnames'
import { filterDevicesForMenu } from '../../utils/devices'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

interface DeviceMenuProps {
  mainDeviceType: string
  noMobileListDevice: any[]
  profile: any
  phoneLinkData: any[]
  operatorsStore: any
  setMainDeviceId: (device: any) => void
}

export const DeviceMenu: React.FC<DeviceMenuProps> = ({
  mainDeviceType,
  noMobileListDevice,
  profile,
  phoneLinkData,
  operatorsStore,
  setMainDeviceId,
}) => {
  const { t } = useTranslation()
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false)

  const getDeviceIcon = (type: string) => {
    if (type === 'webrtc') return faHeadset
    if (type === 'physical') return faOfficePhone as IconProp
    return faDesktop
  }

  const filteredDevices = filterDevicesForMenu(
    noMobileListDevice,
    profile?.default_device,
    phoneLinkData,
    operatorsStore,
  )

  return (
    <Popover className='md:relative hover:bg-gray-200 dark:hover:bg-gray-700'>
      {() => (
        <>
          <div
            className={classNames(
              'relative text-left cursor-pointer px-5 py-2 text-sm flex items-center gap-3 w-full text-dropdownText dark:text-dropdownTextDark',
            )}
            onMouseEnter={() => setDeviceMenuOpen(true)}
            onMouseLeave={() => setDeviceMenuOpen(false)}
          >
            <FontAwesomeIcon
              icon={getDeviceIcon(mainDeviceType)}
              className='ml-[-0.2rem] h-4 w-4 flex justify-center'
            />
            <span className='text-sm font-normal'>{t('TopBar.Main device')}</span>
            <FontAwesomeIcon icon={faAngleRight} className='ml-auto h-4 w-4 flex justify-center' />
          </div>
          <Transition
            as={Fragment}
            show={deviceMenuOpen}
            enter='transition ease-out duration-200'
            enterFrom='opacity-0 translate-y-1'
            enterTo='opacity-100 translate-y-0'
            leave='transition ease-in duration-150'
            leaveFrom='opacity-100 translate-y-0'
            leaveTo='opacity-0 translate-y-1'
          >
            <PopoverPanel
              className='absolute sm:mr-[4.788rem] sm:-mt-10 right-0 z-10 w-screen max-w-xs sm:-translate-x-1/2 transform px-0.5 sm:px-1 xs:mr-[6rem]'
              onMouseEnter={() => setDeviceMenuOpen(true)}
              onMouseLeave={() => setDeviceMenuOpen(false)}
            >
              <div className='overflow-hidden shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 ring-opacity-1 rounded-md'>
                <div className='relative bg-white dark:border-gray-700 dark:bg-gray-900 py-2'>
                  {filteredDevices.map((device: any) => (
                    <Dropdown.Item key={device?.id} onClick={() => setMainDeviceId(device)}>
                      <div className='min-w-0'>
                        <div className='flex items-center space-x-2 min-w-0'>
                          {device?.id === profile?.default_device?.id ? (
                            <FontAwesomeIcon
                              icon={faCheck}
                              className='ml-auto mr-2 h-4 w-4 flex justify-center text-primary dark:text-dropdownTextDark'
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={faCheck}
                              className='ml-auto mr-2 h-4 w-4 flex justify-center text-primary dark:text-dropdownTextDark invisible select-none'
                            />
                          )}

                          <FontAwesomeIcon
                            icon={getDeviceIcon(device?.type)}
                            className='ml-auto h-4 w-4 flex justify-center text-dropdownText dark:text-dropdownTextDark'
                          />

                          {device?.type === 'webrtc' && (
                            <p className='flex-1 min-w-0 text-sm truncate'>{t('Devices.Web phone')}</p>
                          )}
                          {device?.type === 'nethlink' && (
                            <p className='flex-1 min-w-0 text-sm font-medium truncate'>
                              {t('Devices.PhoneLink')}
                            </p>
                          )}
                          {device?.type === 'physical' && (
                            <p className='flex-1 min-w-0 text-sm font-medium truncate'>
                              {device?.description || t('Devices.IP phone')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Dropdown.Item>
                  ))}
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
