// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, ReactNode, useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { savePreference } from '../../../lib/storage'
import { QueueManagementHeader } from './QueueManagementHeader'
import { QueueManagementOperators } from './QueueManagementOperators'
import { SectionToggleHeader } from '../Common/SectionToggleHeader'

import {
  faChevronDown,
  faChevronUp,
  faCheck,
  faPause,
  faDownLeftAndUpRightToCenter,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'

import { openShowOperatorDrawer } from '../../../lib/operators'

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import {
  DEFAULT_QUEUES_MANAGEMENT_SELECTED_QUEUE,
  getExpandedQueueManagamentValue,
  getQueues,
  getQueueStats,
  retrieveSelectedNotManaged,
} from '../../../lib/queueManager'
import { isEmpty } from 'lodash'
import { Avatar, EmptyState } from '../../common'
import { CallDuration } from '../../operators/CallDuration'
import { QueueManagementChart } from '../Chart/QueueManagementChart'

export interface QueueManagementProps extends ComponentProps<'div'> {}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

const CALLS_TABLE_HEADER_CLASS_NAMES = ['py-3 pl-4 pr-2', 'px-2 py-3', 'pl-2 pr-4 py-3']

interface CallsTableProps {
  isEmpty: boolean
  maxHeightClassName: string
  headers: string[]
  children: ReactNode
}

const CallsTable: FC<CallsTableProps> = ({ isEmpty, maxHeightClassName, headers, children }) => {
  const { t } = useTranslation()

  return (
    <div className='text-sm'>
      <div
        className={classNames(
          !isEmpty && 'border rounded-md border-gray-200 dark:border-gray-700',
          'text-gray-700 dark:text-gray-200',
        )}
      >
        {isEmpty ? (
          <EmptyState title={t('Queues.No calls')} />
        ) : (
          <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
            <div className='inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8'>
              <div
                className={`sm:rounded-md ${maxHeightClassName} overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25`}
              >
                <table className='min-w-full divide-y divide-gray-300 dark:divide-gray-600'>
                  <thead className='bg-body dark:bg-bodyDark'>
                    <tr>
                      {headers.map((header, index) => (
                        <th
                          key={index}
                          scope='col'
                          className={`${CALLS_TABLE_HEADER_CLASS_NAMES[index]} text-left font-semibold`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-200 bg-cardBackgroud dark:divide-gray-700 dark:bg-cardBackgroudDark'>
                    {children}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
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
  const [updateDashboardInterval] = useState(120000)

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
      const newAgentCounters: Record<string, any> = {}

      for (const q in queueManagerStore.queues) {
        const counters = {
          online: 0,
          offline: 0,
          paused: 0,
          connected: 0,
          free: 0,
          busy: 0,
        }

        for (const m in queueManagerStore.queues[q].members) {
          const member = queueManagerStore.queues[q].members[m]
          const operator = operatorsStore?.operators?.[member.shortname]

          if (member.loggedIn) {
            counters.online += 1
          } else {
            counters.offline += 1
          }
          if (member.paused) {
            counters.paused += 1
          }

          if (operator && Object.keys(operator).length > 0) {
            for (const c in operator.conversations) {
              const conversation = operator.conversations[c]
              if (conversation.queueId === q && conversation.connected) {
                counters.connected += 1
              } else if (conversation.queueId !== q && conversation.connected) {
                counters.busy += 1
              }
            }
          }

          const extension = operatorsStore?.extensions?.[m]
          if (
            extension &&
            extension.status === 'online' &&
            extension.cf === '' &&
            extension.dnd === false &&
            member.loggedIn === true &&
            member.paused === false
          ) {
            counters.free += 1
          }
        }

        newAgentCounters[q] = counters
      }
      setAgentCounters(newAgentCounters)
    }
  }, [queueManagerStore.isLoaded, allQueuesStats, operatorsStore])

  const [agentCountersSelectedQueue, setAgentCountersSelectedQueue] = useState<any>({})

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
    // clicking the selected queue again clears the selection
    if (newValueQueue?.queue && newValueQueue.queue === selectedValue?.queue) {
      newValueQueue = DEFAULT_QUEUES_MANAGEMENT_SELECTED_QUEUE
    }
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

    }
  }, [selectedValue, agentCounters])

  const selectedQueueData = queueManagerStore?.queues?.[selectedValue?.queue]
  const isWaitingCallsEmpty =
    queueManagerStore?.isLoaded && !!selectedQueueData && isEmpty(selectedQueueData.waitingCallersList)
  const isConnectedCallsEmpty =
    queueManagerStore?.isLoaded && !!selectedQueueData && isEmpty(selectedQueueData.connectedCalls)

  return (
    <>
      <Listbox value={selectedValue} onChange={handleSelectedValue}>
        {({ open }) => (
          <>
            <div className='flex items-center'>
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
                  <ListboxOptions className='absolute z-10 mt-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 rounded-md bg-white py-1 text-base shadow-lg ring-1 dark:bg-gray-900 ring-black ring-opacity-5 dark:ring-gray-700 dark:ring-opacity-100 focus:outline-none sm:text-sm h-auto'>
                    {Object.keys(queueManagerStore.queues).length === 0 && (
                      <div className='relative select-none px-4 py-2 text-sm text-gray-500 dark:text-gray-400'>
                        {t('Queues.No queues')}
                      </div>
                    )}
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

      {!selectedValue?.queue ? (
        <div className='pt-8'>
          <EmptyState
            title={t('QueueManager.No queue selected') || ''}
            description={t('QueueManager.Select queue') || ''}
            icon={
              <FontAwesomeIcon icon={faUsers} className='mx-auto h-12 w-12' aria-hidden='true' />
            }
          />
        </div>
      ) : (
        <>

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
            <SectionToggleHeader
              icon={faPause}
              title={t('QueueManager.Waiting calls')}
              expanded={expandedWaitingCall}
              onToggle={toggleWaitingCall}
            />

            {/* divider */}
            <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1 mb-6'></div>
            {expandedWaitingCall && (
              <CallsTable
                isEmpty={isWaitingCallsEmpty}
                maxHeightClassName='max-h-[12.7rem]'
                headers={[t('Queues.Caller'), t('Queues.Position'), t('Queues.Wait')]}
              >
                {selectedQueueData?.waitingCallersList &&
                  Object.values(selectedQueueData.waitingCallersList).map(
                    (call: any, index: number) => (
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
                    ),
                  )}
              </CallsTable>
            )}

            <SectionToggleHeader
              icon={faDownLeftAndUpRightToCenter}
              title={t('QueueManager.Connected calls')}
              expanded={expandedConnectedCall}
              onToggle={toggleConnectedCall}
              className='mt-6'
            />

            {/* divider */}
            <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1 mb-6'></div>

            {expandedConnectedCall && (
              <CallsTable
                isEmpty={isConnectedCallsEmpty}
                maxHeightClassName='max-h-[17rem]'
                headers={[t('Queues.Caller'), t('Queues.Operator'), t('Queues.Duration')]}
              >
                {selectedQueueData?.connectedCalls &&
                  Object.values(selectedQueueData.connectedCalls).map((call: any, index: number) => {
                    const operator = operators?.[call.operatorUsername]

                    return (
                      <tr key={index}>
                        <td className='py-3 pl-4 pr-2'>
                          <div className='flex flex-col'>
                            <div className='font-medium'>{call.conversation.counterpartName}</div>
                            {call.conversation.counterpartName !== call.conversation.counterpartNum && (
                              <div>{call.conversation.counterpartNum}</div>
                            )}
                          </div>
                        </td>
                        <td className='px-2 py-3'>
                          <div className='flex items-center gap-3 overflow-hidden'>
                            <Avatar
                              rounded='full'
                              src={operator?.avatarBase64}
                              placeholderType='operator'
                              size='small'
                              status={operator?.mainPresence}
                              onClick={() => operator && openShowOperatorDrawer(operator)}
                              className={operator ? 'cursor-pointer' : ''}
                              star={operator?.favorite}
                            />
                            <div className='flex flex-col overflow-hidden'>
                              <div>{operator?.name || call.operatorUsername}</div>
                              <div className='text-gray-500 dark:text-gray-400'>
                                {operator?.endpoints?.mainextension?.[0]?.id}
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
                    )
                  })}
              </CallsTable>
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
      )}
    </>
  )
}

QueueManagement.displayName = 'QueueManagement'
