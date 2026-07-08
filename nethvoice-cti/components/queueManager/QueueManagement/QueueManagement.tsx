// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { savePreference } from '../../../lib/storage'
import { QueueManagementHeader } from './QueueManagementHeader'
import { QueueManagementOperators } from './QueueManagementOperators'

import {
  faChevronDown,
  faChevronUp,
  faCheck,
  faPause,
  faDownLeftAndUpRightToCenter,
} from '@fortawesome/free-solid-svg-icons'

import { openShowOperatorDrawer } from '../../../lib/operators'

import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import {
  getExpandedQueueManagamentValue,
  retrieveSelectedNotManaged,
} from '../../../lib/queueManager'

import { getQueues, getQueueStats } from '../../../lib/queueManager'
import { isEmpty } from 'lodash'
import { Avatar } from '../../common'
import { CallDuration } from '../../operators/CallDuration'
import { QueueManagementChart } from '../Chart/QueueManagementChart'

export interface QueueManagementProps extends ComponentProps<'div'> {}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const QueueManagement: FC<QueueManagementProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()

  const auth = useSelector((state: RootState) => state.authentication)

  const [expandedDashboard, setExpandedDashboard] = useState(true)

  const [expandedWaitingCall, setExpandedWaitingCall] = useState(false)

  const [expandedConnectedCall, setExpandedConnectedCall] = useState(false)

  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  const toggleExpandDashboard = () => {
    setExpandedDashboard(!expandedDashboard)
    let correctExpandedDashboard = !expandedDashboard
    savePreference(
      'queueManagementDashboardExpandedPreference',
      correctExpandedDashboard,
      auth.username,
    )
  }

  const toggleWaitingCall = () => {
    setExpandedWaitingCall(!expandedWaitingCall)
    let correctExpandedWaitingCall = !expandedWaitingCall
    savePreference(
      'queueManagementQueueWaitingCallsExpandedPreference',
      correctExpandedWaitingCall,
      auth.username,
    )
  }

  const toggleConnectedCall = () => {
    setExpandedConnectedCall(!expandedConnectedCall)
    let correctExpandedConnectedCall = !expandedConnectedCall
    savePreference(
      'queueManagementQueueConnectedCallsExpandedPreference',
      correctExpandedConnectedCall,
      auth.username,
    )
  }

  //Load expanded chevron values from local storage
  useEffect(() => {
    const expandedValues = getExpandedQueueManagamentValue(auth.username)
    setExpandedDashboard(expandedValues.expandedQueueDashboard)
    setExpandedConnectedCall(expandedValues.expandedConnectedCalls)
    setExpandedWaitingCall(expandedValues.expandedWaitingCalls)
    setSelectedValue(expandedValues.selectedQueue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // const [updateDashboardInterval, SetUpdateDashboardInterval] = useState(3000)

  const [firstRenderQueuesList, setFirstRenderQueuesList]: any = useState(true)
  const [isLoadedQueues, setLoadedQueues] = useState(false)
  const [queuesList, setQueuesList] = useState<any>({})

  // Get queues list
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderQueuesList) {
      setFirstRenderQueuesList(false)
      return
    }
    async function getQueuesInformation() {
      setLoadedQueues(false)
      try {
        const res = await getQueues()
        setQueuesList(res)
      } catch (err) {
        console.error(err)
      }
      setLoadedQueues(true)
    }
    if (!isLoadedQueues) {
      getQueuesInformation()
    }
  }, [firstRenderQueuesList, isLoadedQueues])

  // Call api interval update ( every 2 minutes)
  const [updateDashboardInterval, SetUpdateDashboardInterval] = useState(120000)

  useEffect(() => {
    //every tot seconds set loaded queues to false to call api
    const interval = setInterval(() => {
      setLoadedQueues(false)
    }, updateDashboardInterval)

    // After unmount clean interval
    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [allQueuesStats, setAllQueuesStats] = useState(false)
  const [firstRenderQueuesStats, setFirstRenderQueuesStats]: any = useState(true)
  const [isLoadedQueuesStats, setLoadedQueuesStats] = useState(false)
  const [selectedValue, setSelectedValue] = useState<any>(
    Object.keys(queueManagerStore.queues)?.[0] || '',
  )

  // //get queues status information
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderQueuesStats) {
      setFirstRenderQueuesStats(false)
      return
    }
    async function getQueuesStats() {
      setLoadedQueuesStats(false)
      try {
        setAllQueuesStats(false)
        //get list of queues from queuesList
        const queuesName = Object.keys(queuesList)
        //get number of queues
        const queuesLength = queuesName.length

        // Get statuses for each queue from api/astproxy/qmanager_qstats/name queue
        for (let i = 0; i < queuesLength; i++) {
          const key = queuesName[i]
          const res = await getQueueStats(key)

          if (queuesList[key]) {
            queuesList[key].qstats = res
          }
        }

        setAllQueuesStats(true)
      } catch (err) {
        console.error(err)
      }
    }
    if (!isLoadedQueuesStats) {
      getQueuesStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadedQueues, isLoadedQueuesStats, firstRenderQueuesStats])

  // load extensions information from the store
  const operatorsStore = useSelector((state: RootState) => state.operators) as Record<string, any>

  const [agentCounters, setAgentCounters] = useState<any>({})

  //get agent values from queues list ( for the header counters )
  useEffect(() => {
    //check if all queues
    if (allQueuesStats) {
      for (const q in queueManagerStore.queues) {
        if (!agentCounters[q]) {
          agentCounters[q] = {}
        }
        // Initialize all counters to 0
        agentCounters[q].online = 0
        agentCounters[q].offline = 0
        agentCounters[q].paused = 0
        agentCounters[q].connected = 0
        agentCounters[q].free = 0
        agentCounters[q].busy = 0

        for (const m in queueManagerStore.queues[q].members) {
          let shortNameUser = queueManagerStore.queues[q].members[m].shortname
          if (queueManagerStore.queues[q].members[m].loggedIn) {
            agentCounters[q].online += 1
          } else {
            agentCounters[q].offline += 1
          }
          if (queueManagerStore.queues[q].members[m].paused) {
            agentCounters[q].paused += 1
          }

          if (
            operatorsStore &&
            operatorsStore.operators &&
            operatorsStore.operators[shortNameUser] &&
            Object.keys(operatorsStore.operators[shortNameUser]).length > 0
          ) {
            for (const c in operatorsStore.operators[shortNameUser].conversations) {
              if (
                operatorsStore.operators[shortNameUser].conversations &&
                operatorsStore.operators[shortNameUser].conversations[c].queueId === q &&
                operatorsStore.operators[shortNameUser].conversations[c].connected
              ) {
                agentCounters[q].connected += 1
              } else if (
                operatorsStore.operators[shortNameUser].conversations[c].queueId !== q &&
                operatorsStore.operators[shortNameUser].conversations[c].connected
              ) {
                agentCounters[q].busy += 1
              }
            }
          }

          if (
            operatorsStore &&
            operatorsStore.extensions &&
            operatorsStore.extensions[m] &&
            operatorsStore.extensions[m].status === 'online' &&
            operatorsStore.extensions[m].cf === '' &&
            operatorsStore.extensions[m].dnd === false &&
            queueManagerStore.queues[q].members[m].loggedIn === true &&
            queueManagerStore.queues[q].members[m].paused === false
          ) {
            agentCounters[q].free += 1
          }
        }
      }
      setAgentCounters({ ...agentCounters })
    }
  }, [queueManagerStore.isLoaded, allQueuesStats, operatorsStore])

  const [agentCountersSelectedQueue, setAgentCountersSelectedQueue] = useState<any>({})

  // const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)
  const [calls, setCalls]: any = useState({})
  const [firstRenderNotManaged, setFirstRenderNotManaged]: any = useState(true)
  const [isLoadedQueuesNotManaged, setLoadedQueuesNotManaged] = useState(false)

  //get not managed information for selected queue
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderNotManaged) {
      setFirstRenderNotManaged(false)
      return
    }
    if (isEmpty(selectedValue)) {
      return
    }
    async function getQueuesNotManaged() {
      setLoadedQueuesNotManaged(false)
      try {
        let selectedQueue = selectedValue.queue
        const res = await retrieveSelectedNotManaged(selectedQueue)
        setCalls(res)
      } catch (err) {
        console.error(err)
      }
      setLoadedQueuesNotManaged(true)
    }
    if (!isLoadedQueuesNotManaged) {
      getQueuesNotManaged()
    }
  }, [firstRenderNotManaged, isLoadedQueuesNotManaged, queueManagerStore.isLoaded, selectedValue])

  // on change of selected queue
  const handleSelectedValue = (newValueQueue: any) => {
    setSelectedValue(newValueQueue)
    let currentSelectedQueue = newValueQueue
    savePreference('queueManagementSelectedQueue', currentSelectedQueue, auth.username)
    setLoadedQueuesNotManaged(false)
  }

  const { operators } = useSelector((state: RootState) => state.operators)

  //set agent for selected queue
  useEffect(() => {
    if (selectedValue && !isEmpty(agentCounters)) {
      const selectedQueue = selectedValue.queue
      const selectedQueueAgents = agentCounters[selectedQueue]
      setAgentCountersSelectedQueue(selectedQueueAgents)

      // setAgentMembers(Object.values(queuesList[selectedQueue]?.members ?? {}))
    }
  }, [selectedValue, agentCounters])

  return (
    <>
      <Listbox value={selectedValue} onChange={handleSelectedValue}>
        {({ open }) => (
          <>
            <div className='flex items-center'>
              <Label className='block text-sm font-medium leading-6 dark:text-gray-200 text-gray- mr-8'>
                {t('QueueManager.Select queue')}
              </Label>
              <div className='relative'>
                <ListboxButton className='relative cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pl-3 pr-10 text-left w-60 text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6 inline-block'>
                  <span className='block truncate'>
                    {selectedValue.name ? selectedValue.name : t('QueueManager.Select queue')}
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
                  <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-900 ring-black ring-opacity-5 focus:outline-none sm:text-sm h-auto'>
                    {Object.entries<any>(queueManagerStore.queues).map(([queueId, queueInfo]) => (
                      <ListboxOption
                        key={queueId}
                        className='relative cursor-default select-none py-2 pl-8 pr-4 data-[focus]:bg-primary data-[focus]:text-white text-gray-900 dark:text-gray-100'
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

                            {selected || selectedValue.queue === queueId ? (
                              <span className='data-[focus]:text-white data-[focus]:dark:text-gray-200 text-primary dark:text-primaryDark absolute inset-y-0 left-0 flex items-center pl-1.5'>
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

      {/* Queue Dashboard*/}
      <div className='py-2 relative mt-4'>
        <div className='flex items-center space-x-1'>
          <div className='flex-grow'>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              {t('QueueManager.Queue Dashboard')}
            </h2>
          </div>
          <div className='flex items-center justify-end h-6 w-6'>
            <FontAwesomeIcon
              icon={expandedDashboard ? faChevronUp : faChevronDown}
              className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
              aria-hidden='true'
              onClick={toggleExpandDashboard}
            />
          </div>
        </div>

        {/* divider */}
        <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1 mb-6'></div>

        {/* Dashboard queue active section */}
        {expandedDashboard && (
          <div>
            {/* Counter section */}
            <QueueManagementHeader
              agentCountersSelectedQueue={agentCountersSelectedQueue}
            ></QueueManagementHeader>

            {/* Chart section  */}
            <QueueManagementChart
              queuesList={queuesList}
              selectedValue={selectedValue}
              allQueuesStats={allQueuesStats}
              isLoadedQueuesNotManaged={isLoadedQueuesNotManaged}
              calls={calls}
            ></QueueManagementChart>
          </div>
        )}
      </div>

      {/* Footer section */}

      <div className='py-2 relative mt-8'>
        <div className='flex'>
          {/* Footer left  */}
          <div className='w-1/3'>
            {/* Waiting calls */}
            <div className='flex items-center'>
              <div className='flex items-center'>
                <FontAwesomeIcon
                  icon={faPause}
                  className='h-4 w-4 mr-2 py-2 cursor-pointer flex items-center'
                  aria-hidden='true'
                />
                <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100 mr-4'>
                  {t('QueueManager.Waiting calls')}
                </h2>
              </div>
              <div className='flex-grow'></div>
              <div className='flex items-center justify-end h-6 w-6'>
                <FontAwesomeIcon
                  icon={expandedWaitingCall ? faChevronUp : faChevronDown}
                  className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
                  aria-hidden='true'
                  onClick={toggleWaitingCall}
                />
              </div>
            </div>

            {/* divider */}
            <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>
            {expandedWaitingCall && (
              <>
                <div className='text-sm'>
                  <div className='border rounded-md border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'>
                    {queueManagerStore &&
                    queueManagerStore?.isLoaded &&
                    queueManagerStore?.queues[selectedValue?.queue] &&
                    isEmpty(queueManagerStore?.queues[selectedValue.queue]?.waitingCallersList) &&
                    selectedValue ? (
                      <div className='p-4'>{t('Queues.No calls')}</div>
                    ) : (
                      <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                        <div className='inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8'>
                          <div className='sm:rounded-md max-h-[12.7rem] overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                            <table className='min-w-full divide-y divide-gray-300 dark:divide-gray-600'>
                              <thead className='bg-body dark:bg-bodyDark'>
                                <tr>
                                  <th
                                    scope='col'
                                    className='py-3 pl-4 pr-2 text-left font-semibold'
                                  >
                                    {t('Queues.Caller')}
                                  </th>
                                  <th scope='col' className='px-2 py-3 text-left font-semibold'>
                                    {t('Queues.Position')}
                                  </th>
                                  <th
                                    scope='col'
                                    className='pl-2 pr-4 py-3 text-left font-semibold'
                                  >
                                    {t('Queues.Wait')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className='divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900'>
                                {queueManagerStore?.queues[selectedValue.queue]
                                  ?.waitingCallersList &&
                                  Object.values(
                                    queueManagerStore?.queues[selectedValue.queue]
                                      ?.waitingCallersList,
                                  )?.map((call: any, index: number) => (
                                    <tr key={index}>
                                      <td className='py-3 pl-4 pr-2'>
                                        <div className='flex flex-col'>
                                          <div className='font-medium'>{call.name}</div>
                                          {call.name !== call.num && <div>{call.num}</div>}
                                        </div>
                                      </td>
                                      <td className='px-2 py-3'>{call.position}</td>
                                      <td className='pl-2 pr-4 py-3'>
                                        <CallDuration startTime={call.waitingTime} />
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Connected calls */}
            <div className='flex items-center mt-6'>
              <div className='flex items-center'>
                <FontAwesomeIcon
                  icon={faDownLeftAndUpRightToCenter}
                  className='h-4 w-4 mr-2 py-2 cursor-pointer flex items-center'
                  aria-hidden='true'
                />
                <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100 mr-4'>
                  {t('QueueManager.Connected calls')}
                </h2>
              </div>
              <div className='flex-grow'></div>
              <div className='flex items-center justify-end h-6 w-6'>
                <FontAwesomeIcon
                  icon={expandedConnectedCall ? faChevronUp : faChevronDown}
                  className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
                  aria-hidden='true'
                  onClick={toggleConnectedCall}
                />
              </div>
            </div>

            {/* divider */}
            <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>

            {expandedConnectedCall && (
              <div className='text-sm'>
                <div className='border rounded-md border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'>
                  {queueManagerStore &&
                  queueManagerStore?.isLoaded &&
                  queueManagerStore?.queues[selectedValue?.queue] &&
                  isEmpty(queueManagerStore?.queues[selectedValue.queue]?.connectedCalls) &&
                  selectedValue ? (
                    <div className='p-4'>{t('Queues.No calls')}</div>
                  ) : (
                    <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                      <div className='inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8'>
                        <div className='sm:rounded-md max-h-[17rem] overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                          <table className='min-w-full divide-y divide-gray-300 dark:divide-gray-600'>
                            <thead className='bg-body dark:bg-bodyDark'>
                              <tr>
                                <th scope='col' className='py-3 pl-4 pr-2 text-left font-semibold'>
                                  {t('Queues.Caller')}
                                </th>
                                <th scope='col' className='px-2 py-3 text-left font-semibold'>
                                  {t('Queues.Operator')}
                                </th>
                                <th scope='col' className='pl-2 pr-4 py-3 text-left font-semibold'>
                                  {t('Queues.Duration')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className='divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900'>
                              {queueManagerStore?.queues[selectedValue.queue]?.connectedCalls &&
                                Object.values(
                                  queueManagerStore?.queues[selectedValue.queue]?.connectedCalls,
                                )?.map((call: any, index: number) => (
                                  <tr key={index}>
                                    <td className='py-3 pl-4 pr-2'>
                                      <div className='flex flex-col'>
                                        <div className='font-medium'>
                                          {call.conversation.counterpartName}
                                        </div>
                                        {call.conversation.counterpartName !==
                                          call.conversation.counterpartNum && (
                                          <div>{call.conversation.counterpartNum}</div>
                                        )}
                                      </div>
                                    </td>
                                    <td className='px-2 py-3'>
                                      <div className='flex items-center gap-3 overflow-hidden'>
                                        <Avatar
                                          rounded='full'
                                          src={operators[call.operatorUsername].avatarBase64}
                                          placeholderType='operator'
                                          size='small'
                                          status={operators[call.operatorUsername].mainPresence}
                                          onClick={() =>
                                            openShowOperatorDrawer(operators[call.operatorUsername])
                                          }
                                          className='cursor-pointer'
                                          star={operators?.[call?.operatorUsername]?.favorite}
                                        />
                                        <div className='flex flex-col overflow-hidden'>
                                          <div>{operators[call.operatorUsername].name}</div>
                                          <div className='text-gray-500 dark:text-gray-400'>
                                            {
                                              operators[call.operatorUsername].endpoints
                                                .mainextension?.[0].id
                                            }
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className='pl-2 pr-4 py-3'>
                                      <CallDuration
                                        key={`callDuration-${call.conversation.id}`}
                                        startTime={call.conversation.startTime}
                                      />
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer right ( Operators ) */}
          <QueueManagementOperators
            selectedValue={selectedValue}
            agentCounters={agentCounters}
            allQueuesStats={allQueuesStats}
          ></QueueManagementOperators>
        </div>
      </div>
    </>
  )
}

QueueManagement.displayName = 'QueueManagement'
