// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState } from '../../common'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { faChevronDown, faCheck, faExpand, faXmark } from '@fortawesome/free-solid-svg-icons'

import { getMonitorValue } from '../../../lib/queueManager'

import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'

import { savePreference } from '../../../lib/storage'

import { MonitorTables } from './Tables'

export interface MonitorProps extends ComponentProps<'div'> {}

const numbers = Array.from({ length: 20 }, (_, index) => index + 1)

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const Monitor: FC<MonitorProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number>(0)

  const authStore = useSelector((state: RootState) => state.authentication)

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Activate or deactivate fullscreen mode
  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen)
  }

  // on change of selected row numbers
  const handleSelectedRowNumbers = (newRowNumbers: any) => {
    setSelected(newRowNumbers)
    let currentSelectedRowNumbers = newRowNumbers
    savePreference('monitorRowNumbers', currentSelectedRowNumbers, authStore.username)
  }

  //Load selected row numbers from local storage
  useEffect(() => {
    const monitorLocalStorageValue = getMonitorValue(authStore.username)
    setSelected(monitorLocalStorageValue.rowNumbers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  //Use escape button to close fullscreen
  useEffect(() => {
    const handleEscKey = (event: any) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleEscKey)

    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className='flex space-x-8'>
        <Listbox value={selected} onChange={handleSelectedRowNumbers}>
          {({ open }) => (
            <>
              <div className='flex items-center'>
                <Label className='block text-sm font-medium leading-6 dark:text-gray-200 text-gray-700 mr-8'>
                  {t('QueueManager.Calls to show')}
                </Label>
                <div className='relative'>
                  <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pl-3 pr-10 text-left text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6'>
                    <span className='block truncate mr-1'>{selected}</span>
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
                    <ListboxOptions className='absolute z-10 mt-1 max-h-60 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white dark:bg-gray-900 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm'>
                      {numbers.map((number: any) => (
                        <ListboxOption
                          key={number}
                          className='data-[focus]:bg-primary data-[focus]:text-white data-[focus]:dark:text-gray-900 text-gray-900 dark:text-gray-100 relative cursor-default select-none py-2 pl-6'
                          value={number}
                        >
                          {({ selected }) => (
                            <>
                              <span
                                className={classNames(
                                  selected ? 'font-semibold' : 'font-normal',
                                  'block truncate',
                                )}
                              >
                                {number}
                              </span>

                              {selected ? (
                                <span className='data-[focus]:text-white text-primary absolute inset-y-0 left-0 flex items-center'>
                                  <FontAwesomeIcon
                                    icon={faCheck}
                                    className='h-3.5 w-3.5 pl-1 py-2 cursor-pointer flex items-center'
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
        <Button variant='primary' onClick={toggleFullscreen}>
          <FontAwesomeIcon
            icon={faExpand}
            className='h-5 w-5 mr-2 cursor-pointer flex items-center'
            aria-hidden='true'
          />
          <span>{t('QueueManager.Fullscreen')}</span>
        </Button>
      </div>

      {/* Queue Dashboard*/}
      <div
        className={`transition-all duration-300 ${
          isFullscreen
            ? 'fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-50 bg-white dark:bg-gray-800 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'
            : ''
        }`}
      >
        <div>
          {/* Card section */}
          <div className='flex flex-col'>
            {isFullscreen && (
              <div className='flex justify-end'>
                <Button variant='ghost' className='w-8 h-8' onClick={() => setIsFullscreen(false)}>
                  <FontAwesomeIcon
                    className='h-5 w-5 cursor-pointer dark:text-gray-200 text-gray-700'
                    icon={faXmark}
                  />
                </Button>
              </div>
            )}
            <MonitorTables isFullscreen={isFullscreen} selectedRow={selected}></MonitorTables>
          </div>
        </div>
      </div>
    </>
  )
}

Monitor.displayName = 'Monitor'
