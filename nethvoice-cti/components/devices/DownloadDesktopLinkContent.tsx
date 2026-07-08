// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState } from 'react'
import { Button } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { t } from 'i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'

import { closeSideDrawer } from '../../lib/utils'
import { faApple, faLinux, faWindows } from '@fortawesome/free-brands-svg-icons'
import { isEmpty } from 'lodash'

export interface DownloadDesktopLinkContentProps extends ComponentPropsWithRef<'div'> {
  config: {
    urlStatus: any[]
    selectedOS: string
    macArchitecture?: string
  }
}

export const DownloadDesktopLinkContent = forwardRef<
  HTMLButtonElement,
  DownloadDesktopLinkContentProps
>(({ config, className, ...props }, ref) => {
  const [selectedOS, setSelectedOS] = useState(config?.selectedOS || '')
  const macArchitecture = config?.macArchitecture || 'x64'

  const handleSelectedOS = (os: string) => {
    setSelectedOS(os)
  }

  const handleDownloadStart = () => {
    if (!isEmpty(config) && selectedOS !== '') {
      let url
      switch (selectedOS) {
        case 'apple':
          const macArmUrl = config?.urlStatus?.find((item: any) => item.macArmUrl)?.macArmUrl
          const macX64Url = config?.urlStatus?.find((item: any) => item.macX64Url)?.macX64Url
          const macDefaultUrl = config?.urlStatus?.find((item: any) => item.macUrl)?.macUrl

          if (macArchitecture === 'arm64' && macArmUrl) {
            url = macArmUrl
          } else if (macX64Url) {
            url = macX64Url
          } else {
            url = macDefaultUrl
          }
          break
        case 'windows':
          url = config?.urlStatus?.find((item: any) => item.windowsUrl)?.windowsUrl
          break
        default:
          break
      }
      if (url) {
        window.open(url, '_blank')
      }
    }
    closeSideDrawer()
  }

  return (
    <>
      <DrawerHeader title={t('Devices.Download Desktop app')}  onClose={closeSideDrawer}/>
      {/* Divider */}
      <div className='px-6'>
        <Divider />
        {/* Desktop app OS selection */}
        {/* title  */}
        <div>
          <span className='dark:text-gray-200 leading-5 text-sm font-medium'>
            {t('Devices.Operating system')}
          </span>
        </div>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 hover:cursor-pointer'>
          {/* Apple */}
          <div
            className={`${
              selectedOS === 'apple'
                ? 'border-primary dark:border-primaryDark border-2'
                : 'border-gray-200 dark:border-gray-500 border-[1px]'
            } rounded-md bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm: mt-1 relative flex items-center `}
            onClick={() => handleSelectedOS('apple')}
          >
            <div className='flex items-center space-x-4'>
              <FontAwesomeIcon icon={faApple} className='h-6 w-6' aria-hidden='true' />
              <span className='text-sm flex justify-center font-medium leading-6 text-center text-gray-700 dark:text-gray-100'>
                MacOS
              </span>
            </div>
            {selectedOS === 'apple' && (
              <div className='absolute bottom-0 right-0 mb-3 mr-3'>
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className='h-3 w-3 text-primary dark:text-primaryDark'
                />
              </div>
            )}
          </div>
          {/* Windows */}
          <div
            className={`${
              selectedOS === 'windows'
                ? 'border-primary dark:border-primaryDark border-2'
                : 'border-gray-200 dark:border-gray-500 border-[1px]'
            } rounded-md bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-3 sm: mt-1 relative flex items-center `}
            onClick={() => handleSelectedOS('windows')}
          >
            <div className='flex items-center space-x-4'>
              <FontAwesomeIcon icon={faWindows} className='h-6 w-6' aria-hidden='true' />
              <span className='text-sm flex justify-center font-medium leading-6 text-center text-gray-700 dark:text-gray-100'>
                Windows
              </span>
              {selectedOS === 'windows' && (
                <div className='absolute bottom-0 right-[0.75rem] mb-3 mr-3'>
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className='h-3 w-3 text-primary dark:text-primaryDark'
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Divider */}
        <Divider paddingY='pb-8 pt-6' />
        {/* Footer section */}
        <div className='flex justify-end'>
          <Button variant='ghost' type='submit' onClick={closeSideDrawer} className='mb-4'>
            {t('Common.Cancel')}
          </Button>
          <Button
            variant='primary'
            type='submit'
            className='mb-4 ml-4'
            onClick={() => handleDownloadStart()}
          >
            {t('Common.Download')}
          </Button>
        </div>
      </div>
    </>
  )
})

DownloadDesktopLinkContent.displayName = 'DownloadDesktopLinkContent'
