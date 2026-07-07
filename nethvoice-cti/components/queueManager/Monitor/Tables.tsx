// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useEffect, useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { faChevronDown, faCheck, faMinus, faPlus, faUsers } from '@fortawesome/free-solid-svg-icons'
import { savePreference } from '../../../lib/storage'
import { CallDuration } from '../../operators/CallDuration'
import { getMonitorValue } from '../../../lib/queueManager'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import { Button, EmptyState } from '../../common'

export interface MonitorTablesProps extends ComponentProps<'div'> {
  isFullscreen: any
  selectedRow: number
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const MonitorTables: FC<MonitorTablesProps> = ({
  className,
  isFullscreen,
  selectedRow,
}): JSX.Element => {
  const { t } = useTranslation()

  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  const authStore = useSelector((state: RootState) => state.authentication)

  const [addQueueCard, setAddQueueCard] = useState(true)
  const [showSecondCard, setShowSecondCard] = useState(false)

  const [selectedQueueFirstTable, setSelectedQueueFirstTable] = useState<any>(
    Object.keys(queueManagerStore.queues)[0] || '',
  )

  const [selectedQueueSecondTable, setSelectedQueueSecondTable] = useState<any>(
    Object.keys(queueManagerStore.queues)[1] || '',
  )

  // on change of selected row numbers
  const handleSelectedFirstQueues = (newFirstQueueSelected: any) => {
    setSelectedQueueFirstTable(newFirstQueueSelected)
    let currentSelectedFirstQueue = newFirstQueueSelected
    savePreference('monitorFirstQueueSelected', currentSelectedFirstQueue, authStore.username)
  }

  // on change of selected row numbers
  const handleSelectedSecondQueues = (newSecondQueueSelected: any) => {
    setSelectedQueueSecondTable(newSecondQueueSelected)
    let currentSelectedSecondQueue = newSecondQueueSelected
    savePreference('monitorSecondQueueSelected', currentSelectedSecondQueue, authStore.username)
  }

  //Load expanded chevron values from local storage
  useEffect(() => {
    const monitorLocalStorageValue = getMonitorValue(authStore.username)
    setSelectedQueueFirstTable(monitorLocalStorageValue.selectedFirstQueue)
    setSelectedQueueSecondTable(monitorLocalStorageValue.selectedSecondQueue)
    setShowSecondCard(monitorLocalStorageValue.isSecondCardVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add or remove secondo queue card
  function toggleAddQueueCard() {
    setAddQueueCard(!addQueueCard)
    if (addQueueCard && !showSecondCard) {
      setShowSecondCard(!showSecondCard)
      savePreference('monitorSecondCardIsVisible', !showSecondCard, authStore.username)
    } else {
      setShowSecondCard(!showSecondCard)
      savePreference('monitorSecondCardIsVisible', !showSecondCard, authStore.username)
    }
  }

  // get total number of call in queues
  function getWaitingCallsCount(queueId: any) {
    const selectedQueue = queueManagerStore.queues[queueId]
    if (selectedQueue && selectedQueue.waitingCallers) {
      const waitingCallers = selectedQueue.waitingCallers
      return Object.keys(waitingCallers).length
    }
    return 0
  }

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'>
        <div
          className={`${!isFullscreen ? 'pt-8' : 'pt-1'} ${
            !showSecondCard ? 'col-span-2' : 'col-span-1'
          }`}
        >
          {/* First Queue card  */}
          <div className='border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-4 sm:mt-1 relative'>
            {/* Header section */}
            <div className='flex items-center space-x-2'>
              {/* left side */}
              <div className='flex-grow'>
                <div className='flex items-center space-x-2'>
                  {/* Queue list */}
                  <Listbox value={selectedQueueFirstTable} onChange={handleSelectedFirstQueues}>
                    {({ open }) => (
                      <>
                        <div className='flex items-center'>
                          <div className='relative'>
                            <ListboxButton
                              className={`relative  cursor-default rounded-md py-1.5 pr-10 text-left text-gray-950 dark:text-gray-300 focus:outline-none sm:text-sm sm:leading-6 ${
                                isFullscreen ? 'w-96' : 'w-48'
                              }  `}
                            >
                              <span
                                className={`block truncate mr-1 font-semibold ${
                                  isFullscreen ? 'text-2xl' : 'text-base'
                                }  `}
                              >
                                {selectedQueueFirstTable.name
                                  ? selectedQueueFirstTable.name +
                                    ' ' +
                                    selectedQueueFirstTable.queue
                                  : t('QueueManager.Select queue')}
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
                              <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-900 ring-black ring-opacity-5 focus:outline-none sm:text-sm h-auto'>
                                {Object.entries<any>(queueManagerStore.queues).map(
                                  ([queueId, queueInfo]) => (
                                    <ListboxOption
                                      key={queueId}
                                      className={() =>
                                        classNames(
                                          'relative cursor-default select-none py-2 pl-8 pr-4 data-[focus]:text-white data-[focus]:bg-primary text-gray-900 dark:text-gray-100',
                                          `${isFullscreen ? 'text-2xl' : 'text-base'}`,
                                        )
                                      }
                                      value={queueInfo}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span
                                            className={classNames(
                                              selected ? 'font-semibold' : 'font-normal',
                                              'block truncate',
                                            )}
                                          >
                                            {queueInfo.name} ({queueInfo.queue})
                                          </span>

                                          {selected || selectedQueueFirstTable.queue === queueId ? (
                                            <span className='data-[focus]:text-white text-primary absolute inset-y-0 left-0 flex items-center pl-1.5'>
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
                </div>
              </div>

              {/* right side */}
              <div className='flex items-center ml-auto space-x-5'>
                {/* Number of waiting calls */}
                <div className='text-sm text-gray-500'>
                  <span
                    className={`text-amber-700 dark:text-amber-500 font-semibold mr-2 ${
                      isFullscreen ? 'text-2xl' : 'text-base'
                    }  `}
                  >
                    {getWaitingCallsCount(selectedQueueFirstTable.queue)}
                  </span>
                  <span
                    className={`text-amber-700 dark:text-amber-500 ${
                      isFullscreen ? 'text-2xl' : 'text-base'
                    }  `}
                  >
                    {t('QueueManager.Waiting calls')}
                  </span>
                </div>

                {/* Remove or add queue card */}
                {!showSecondCard && !isFullscreen && (
                  <Button
                    variant='white'
                    className='ml-2'
                    onClick={toggleAddQueueCard}
                    size={isFullscreen ? 'large' : 'base'}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span className='ml-2'>{t('QueueManager.Add queue')} </span>
                  </Button>
                )}
              </div>
            </div>

            {/* Body section */}
            {selectedQueueFirstTable === '' && (
              <>
                {/* empty state */}

                <EmptyState
                  title={t('QueueManager.No queue selected') || ''}
                  description='Please select a queue'
                  icon={
                    <FontAwesomeIcon
                      icon={faUsers}
                      className='mx-auto h-12 w-12'
                      aria-hidden='true'
                    />
                  }
                ></EmptyState>
              </>
            )}

            {selectedQueueFirstTable !== '' && (
              <div className=''>
                <div className='mt- flow-root'>
                  <div className='-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                    <div className='inline-block min-w-full py-4 align-middle sm:px-6 lg:px-8'>
                      <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-600'>
                        <thead>
                          <tr>
                            <th
                              scope='col'
                              className={`py-3.5 pl-4 pr-3 text-left font-semibold text-gray-700 dark:text-gray-200 sm:pl-0 ${
                                !isFullscreen ? 'text-sm ' : 'text-2xl'
                              }`}
                            >
                              {t('QueueManager.Position')}
                            </th>
                            <th
                              scope='col'
                              className={`py-3.5 pl-4 pr-3 text-left font-semibold text-gray-700 dark:text-gray-200 sm:pl-0 ${
                                !isFullscreen ? 'text-sm ' : 'text-2xl'
                              }`}
                            >
                              {t('QueueManager.Calls')}
                            </th>
                            <th
                              scope='col'
                              className={`py-3.5 pl-4 pr-3 text-left font-semibold text-gray-700 dark:text-gray-200 sm:pl-0 ${
                                !isFullscreen ? 'text-sm ' : 'text-2xl'
                              }`}
                            >
                              {t('QueueManager.Waiting')}
                            </th>
                          </tr>
                        </thead>

                        <tbody className='divide-y divide-gray-200 dark:divide-gray-600'>
                          {Array.from({ length: selectedRow }, (_, index) => {
                            const waitingCallers =
                              queueManagerStore?.queues[selectedQueueFirstTable?.queue]
                                ?.waitingCallers
                            const callerArray = waitingCallers ? Object.values(waitingCallers) : []
                            const caller: any = callerArray[index]
                            const isDataPresent = !!caller && !!caller.name

                            return (
                              <tr key={index}>
                                <td
                                  className={`whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-${
                                    isDataPresent ? 'gray-900' : 'primary'
                                  } sm:pl-0`}
                                >
                                  <div className='flex items-center ml-2'>
                                    <div
                                      className={`${
                                        isFullscreen ? 'w-12 h-12' : 'w-6 h-6'
                                      } rounded-full bg-${
                                        isDataPresent
                                          ? 'amber-50 dark:bg-amber-700'
                                          : 'emerald-50 dark:bg-emerald-700'
                                      } flex items-center justify-center`}
                                    >
                                      <span
                                        className={`text-${
                                          isDataPresent
                                            ? 'amber-600 dark:text-amber-50'
                                            : 'primary dark:text-green-50'
                                        } ${isFullscreen ? 'text-2xl' : 'text-sm'}`}
                                      >
                                        {index + 1}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td
                                  className={`whitespace-nowrap  py-4 text-gray-500 dark:text-gray-300 leading-5 font-norma ${
                                    isFullscreen ? 'text-2xl' : 'text-sm'
                                  }`}
                                >
                                  {isDataPresent ? caller.name : '-'}
                                </td>
                                <td
                                  className={`whitespace-nowrap  py-4 text-gray-500 dark:text-gray-300 leading-5 font-normatext-gray-500 ${
                                    isFullscreen ? 'text-2xl' : 'text-sm'
                                  }`}
                                >
                                  <CallDuration startTime={caller?.waitingTime} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Second Queue card  */}
        {showSecondCard && (
          <div className={`${!isFullscreen ? 'pt-8' : 'pt-1'}`}>
            <div className='border-b rounded-lg shadow-md border-gray-200 dark:border-gray-700 bg-cardBackgroud dark:bg-cardBackgroudDark px-5 py-4 sm:mt-1 relative'>
              {/* Header section */}
              <div className='flex items-center space-x-2'>
                {/* left side */}
                <div className='flex-grow'>
                  <div className='flex items-center space-x-2'>
                    <Listbox value={selectedQueueSecondTable} onChange={handleSelectedSecondQueues}>
                      {({ open }) => (
                        <>
                          <div className='flex items-center'>
                            {/* <Listbox.Label className='block text-sm font-medium leading-6 text-gray-500 mr-8'>
                                {t('QueueManager.Calls to show')}
                              </Listbox.Label> */}
                            <div className='relative'>
                              <ListboxButton
                                className={`relative  cursor-default rounded-md py-1.5 pr-10 text-left text-gray-950 dark:text-gray-300 focus:outline-none sm:text-sm sm:leading-6 ${
                                  isFullscreen ? 'w-96' : 'w-48'
                                }  `}
                              >
                                <span
                                  className={`block truncate mr-1 font-semibold ${
                                    isFullscreen ? 'text-2xl' : 'text-base'
                                  }  `}
                                >
                                  {selectedQueueSecondTable.name
                                    ? selectedQueueSecondTable.name +
                                      ' ' +
                                      selectedQueueSecondTable.queue
                                    : t('QueueManager.Select queue')}
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
                                <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-900 ring-black ring-opacity-5 focus:outline-none sm:text-sm h-auto'>
                                  {Object.entries<any>(queueManagerStore.queues).map(
                                    ([queueId, queueInfo]) => (
                                      <ListboxOption
                                        key={queueId}
                                        className={() =>
                                          classNames(
                                            'relative cursor-default select-none py-2 pl-8 pr-4 data-[focus]:text-white data-[focus]:bg-primary text-gray-900 dark:text-gray-100',
                                            `${isFullscreen ? 'text-2xl' : 'text-base'}  `,
                                          )
                                        }
                                        value={queueInfo}
                                      >
                                        {({ selected, active }) => (
                                          <>
                                            <span
                                              className={classNames(
                                                selected ? 'font-semibold' : 'font-normal',
                                                'block truncate',
                                              )}
                                            >
                                              {queueInfo.name} ({queueInfo.queue})
                                            </span>

                                            {selected ||
                                            selectedQueueSecondTable.queue === queueId ? (
                                              <span className='data-[focus]:text-white text-primary absolute inset-y-0 left-0 flex items-center pl-1.5'>
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
                  </div>
                </div>
                {/* right side */}
                <div className='flex items-center ml-auto space-x-5'>
                  {/* Number of waiting calls */}
                  <div className='text-sm text-gray-500'>
                    <span
                      className={`text-amber-700 dark:text-amber-500 font-semibold mr-2 ${
                        isFullscreen ? 'text-2xl' : 'text-base'
                      }  `}
                    >
                      {getWaitingCallsCount(selectedQueueSecondTable.queue)}
                    </span>
                    <span
                      className={`text-amber-700 dark:text-amber-500 ${
                        isFullscreen ? 'text-2xl' : 'text-base'
                      }  `}
                    >
                      {t('QueueManager.Waiting calls')}
                    </span>
                  </div>
                  {!isFullscreen && (
                    <Button
                      variant='white'
                      className='ml-2'
                      onClick={toggleAddQueueCard}
                      size={isFullscreen ? 'large' : 'base'}
                    >
                      <FontAwesomeIcon icon={faMinus} />
                      <span className='ml-2'>{t('QueueManager.Remove')}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Body section */}
              {selectedQueueSecondTable === '' && (
                <>
                  {/* empty state */}
                  <EmptyState
                    title={t('QueueManager.No queue selected') || ''}
                    description='Please select a queue'
                    icon={
                      <FontAwesomeIcon
                        icon={faUsers}
                        className='mx-auto h-12 w-12'
                        aria-hidden='true'
                      />
                    }
                  ></EmptyState>
                </>
              )}
              {selectedQueueSecondTable !== '' && (
                <div className=''>
                  <div className='mt- flow-root'>
                    <div className='-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                      <div className='inline-block min-w-full py-4 align-middle sm:px-6 lg:px-8'>
                        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-600'>
                          <thead>
                            <tr>
                              <th
                                scope='col'
                                className={`py-3.5 pl-4 pr-3 text-left font-semibold text-gray-700 dark:text-gray-200 sm:pl-0 ${
                                  !isFullscreen ? 'text-sm ' : 'text-2xl'
                                }`}
                              >
                                {t('QueueManager.Position')}
                              </th>
                              <th
                                scope='col'
                                className={`py-3.5 pl-4 pr-3 text-left font-semibold text-gray-700 dark:text-gray-200 sm:pl-0 ${
                                  !isFullscreen ? 'text-sm ' : 'text-2xl'
                                }`}
                              >
                                {t('QueueManager.Calls')}
                              </th>
                              <th
                                scope='col'
                                className={`py-3.5 pr-3 pl-4 text-left font-semibold text-gray-700 dark:text-gray-200 sm:pl-0 ${
                                  !isFullscreen ? 'text-sm ' : 'text-2xl'
                                }`}
                              >
                                {t('QueueManager.Waiting')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className='divide-y divide-gray-200 dark:divide-gray-600'>
                            {Array.from({ length: selectedRow }, (_, index) => {
                              const waitingCallers =
                                queueManagerStore?.queues[selectedQueueSecondTable?.queue]
                                  ?.waitingCallers
                              const callerArray = waitingCallers
                                ? Object.values(waitingCallers)
                                : []
                              const caller: any = callerArray[index]
                              const isDataPresent = !!caller && !!caller.name

                              return (
                                <tr key={index}>
                                  <td
                                    className={`whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-${
                                      isDataPresent ? 'gray-900' : 'primary'
                                    } sm:pl-0`}
                                  >
                                    <div className='flex items-center ml-2'>
                                      <div
                                        className={`${
                                          isFullscreen ? 'w-12 h-12' : 'w-6 h-6'
                                        } rounded-full bg-${
                                          isDataPresent
                                            ? 'amber-50 dark:bg-amber-700'
                                            : 'emerald-50 dark:bg-emerald-700'
                                        } flex items-center justify-center`}
                                      >
                                        <span
                                          className={`text-${
                                            isDataPresent
                                              ? 'amber-600 dark:text-amber-50'
                                              : 'primary dark:text-green-50'
                                          } ${isFullscreen ? 'text-2xl' : 'text-sm'}`}
                                        >
                                          {index + 1}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td
                                    className={`whitespace-nowrap py-4 text-gray-500 dark:text-gray-300 leading-5 font-normal ${
                                      isFullscreen ? 'text-2xl' : 'text-sm'
                                    }`}
                                  >
                                    {isDataPresent ? caller.name : '-'}
                                  </td>
                                  <td
                                    className={`whitespace-nowrap py-4 text-gray-500 dark:text-gray-300 leading-5 font-normal ${
                                      isFullscreen ? 'text-2xl' : 'text-sm'
                                    }`}
                                  >
                                    <CallDuration startTime={caller?.waitingTime} />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

MonitorTables.displayName = 'MonitorTables'
