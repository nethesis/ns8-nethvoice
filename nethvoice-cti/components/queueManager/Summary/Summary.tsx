// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Avatar } from '../../common'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Popover, PopoverButton, PopoverGroup, PopoverPanel } from '@headlessui/react'
import { cloneDeep } from 'lodash'
import { exactDistanceToNowLoc, formatDurationLoc } from '../../../lib/dateTime'
import { getCallTimeToDisplay } from '../../../lib/dateTime'

import {
  faChevronDown,
  faChevronUp,
  faHeadset,
  faCircleNotch,
  faAngleRight,
  faPause,
  faPhone,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { LoggedStatus } from '../../queues'
import { openShowOperatorDrawer } from '../../../lib/operators'

import { Transition } from '@headlessui/react'
import {
  getQueues,
  getQueueStats,
  getAgentsStats,
  getExpandedSummaryValue,
  searchOperatorsInQueuesMembers,
  getFilterValuesSummary,
} from '../../../lib/queueManager'
import { debounce, isEmpty } from 'lodash'
import InfiniteScroll from 'react-infinite-scroll-component'
import { getInfiniteScrollOperatorsPageSize } from '../../../lib/operators'
import { savePreference } from '../../../lib/storage'
import { SummaryChart } from '../Chart/SummaryChart'
import { RealTimeOperatorsFilter } from '../Realtime/RealTimeOperatorsFilter'

export interface SummaryProps extends ComponentProps<'div'> {}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const Summary: FC<SummaryProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()

  const { operators } = useSelector((state: RootState) => state.operators)

  // operator toggle status
  const [expanded, setExpanded] = useState(false)

  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  const auth = useSelector((state: RootState) => state.authentication)

  const [expandedQueuesSummary, setExpandedQueuesSummary] = useState(false)

  const toggleExpandQueue = () => {
    setExpanded(!expanded)
    let correctExpandedOperatorsSummary = !expanded
    savePreference(
      'operatorsSummaryExpandedPreference',
      correctExpandedOperatorsSummary,
      auth.username,
    )
    applyFiltersOperators()
  }

  const toggleQueuesSummary = () => {
    setExpandedQueuesSummary(!expandedQueuesSummary)
    let correctExpandedQueuesSummary = !expandedQueuesSummary
    savePreference('queuesSummaryExpandedPreference', correctExpandedQueuesSummary, auth.username)
  }

  //set expanded values at the beginning
  //set beginning value of selected queues
  useEffect(() => {
    const expandedValues = getExpandedSummaryValue(auth.username)
    const filterValues = getFilterValuesSummary(auth.username)

    setExpanded(expandedValues.expandedOperators)
    setExpandedQueuesSummary(expandedValues.expandedQueues)

    if (isEmpty(filterValues.selectedQueues)) {
      // select all queues
      const allQueueCodes = Object.values(queueManagerStore.queues).map((queue: any) => {
        return queue.queue
      })
      setSelectedQueues(allQueueCodes)
    } else {
      // select queues from preferences
      setSelectedQueues(filterValues.selectedQueues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load operators information from the store
  const operatorsStore = useSelector((state: RootState) => state.operators) as Record<string, any>

  const [infiniteScrollOperators, setInfiniteScrollOperators] = useState<any>([])
  const infiniteScrollOperatorsPageSize = getInfiniteScrollOperatorsPageSize()

  const [infiniteScrollLastIndex, setInfiniteScrollLastIndex] = useState(
    infiniteScrollOperatorsPageSize,
  )
  const [infiniteScrollHasMore, setInfiniteScrollHasMore] = useState(false)

  const [filteredAgentMembers, setFilteredAgentMembers]: any = useState([])

  const showMoreInfiniteScrollOperators = () => {
    const lastIndex = infiniteScrollLastIndex + infiniteScrollOperatorsPageSize
    setInfiniteScrollLastIndex(lastIndex)
    setInfiniteScrollOperators(filteredAgentMembers.slice(0, lastIndex))
    const hasMore = lastIndex < filteredAgentMembers.length
    setInfiniteScrollHasMore(hasMore)
  }

  // used to check if queue operator card is opened or closed
  const [openedCardIndexes, setOpenedCardIndexes] = useState<number[]>([])
  const toggleExpandAgentCard = (index: number) => {
    const isOpen = openedCardIndexes.includes(index)
    if (isOpen) {
      setOpenedCardIndexes(openedCardIndexes.filter((i) => i !== index))
    } else {
      setOpenedCardIndexes([...openedCardIndexes, index])
    }
  }

  const [openedQueueInformationIndexes, setOpenedQueueInformationIndexes] = useState<string[]>([])

  // Function to toggle queue information expansion
  const toggleExpandCardQueueInformations = (cardIndex: number, queueIndex: number) => {
    const queueInfoIndex = `${cardIndex}-${queueIndex}`
    const isOpen = openedQueueInformationIndexes.includes(queueInfoIndex)
    if (isOpen) {
      setOpenedQueueInformationIndexes(
        openedQueueInformationIndexes.filter((i) => i !== queueInfoIndex),
      )
    } else {
      setOpenedQueueInformationIndexes([...openedQueueInformationIndexes, queueInfoIndex])
    }
  }

  //Queues sections
  const queuesFilterQueues = {
    id: 'queues',
    name: t('QueueManager.Queues'),
    options: Object.values(queueManagerStore.queues).map((queue: any) => {
      return { value: queue.queue, label: `${queue.name} (${queue.queue})` }
    }),
  }

  const [selectedQueues, setSelectedQueues]: any = useState([])

  const [selectedTest, setSelectedTest] = useState<any>()

  function changeQueuesFilter(event: any) {
    const isChecked = event.target.checked
    const newSelectedQueues = cloneDeep(selectedQueues)

    if (isChecked) {
      newSelectedQueues.push(event.target.value)
      setSelectedQueues(newSelectedQueues)
    } else {
      let index = newSelectedQueues.indexOf(event.target.value)
      newSelectedQueues.splice(index, 1)
      setSelectedQueues(newSelectedQueues)
    }
    savePreference('summaryOperatorSelectedQueues', newSelectedQueues, auth.username)

    const selectedQueuesData = getSelectedQueuesData(queueManagerStore.queues, newSelectedQueues)
    setSelectedTest(selectedQueuesData)
  }

  // Get values of selected queues from queue manager store
  function getSelectedQueuesData(queuesData: Record<string, any>, selectedCodes: string[]) {
    const selectedQueues = selectedCodes.map((code) => queuesData[code])
    return selectedQueues
  }

  //Operators section

  const [textFilterOperators, setTextFilterOperators]: any = useState('')

  const updateTextFilterOperators = (newTextFilterOperators: string) => {
    setTextFilterOperators(newTextFilterOperators)
  }

  const debouncedUpdateTextFilterOperator = useMemo(
    () => debounce(updateTextFilterOperators, 400),
    [],
  )

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilterOperator.cancel()
    }
  }, [debouncedUpdateTextFilterOperator])

  const [queuesFilterOperators, setQueuesFilterOperators]: any = useState([])

  const updateQueuesFilterOperators = (newQueuesFilter: string[]) => {
    setQueuesFilterOperators(newQueuesFilter)
    // setCallsLoaded(false)
  }

  const [realTimeAgent, setRealTimeAgent] = useState<any>({})
  const [realTimeAgentConvertedArray, setRealTimeAgentConvertedArray] = useState<any>([])

  useEffect(() => {
    // Function to fetch real-time agent data
    const getRealTimeAgents = async () => {
      try {
        const newRealTimeAgents: any = {} // New object for agents

        // Iterate through each queue in queuesList
        for (const queueId in queueManagerStore?.queues) {
          const queue = queueManagerStore?.queues[queueId]

          // Iterate through each member in the queue
          for (const memberId in queue.members) {
            const member = queue.members[memberId]

            // If the agent doesn't exist in the new object, add them
            if (!newRealTimeAgents[memberId]) {
              newRealTimeAgents[memberId] = {
                queues: {},
                name: member.name,
                member: member.member,
              }
            }

            // Add the queue details to the agent in the new object
            newRealTimeAgents[memberId].queues[queueId] = {
              ...member,
              qname: queue.name,
            }
          }
        }

        // Update state with the new agent object
        setRealTimeAgent(newRealTimeAgents)

        // Convert object to an array
        const agentArray: any[] = Object.values(newRealTimeAgents)

        agentArray.forEach((member: any) => {
          Object.values(member.queues).some((queue: any) => {
            member.shortname = queue.shortname
            return
          })
        })
        setRealTimeAgentConvertedArray(agentArray)
      } catch (err) {
        console.error(err)
      }
    }
    getRealTimeAgents()
  }, [queueManagerStore])

  const [stats, setStats]: any = useState({})

  const fetchStats = async () => {
    try {
      // Fetch agent stats using getAgentsStats()
      const res = await getAgentsStats()
      // get operators stats
      const agentsRealTimeStats = res
      let updatedStats = {} as Record<string, any>

      if (realTimeAgent) {
        //cycle trough all the operators
        for (const agentId in realTimeAgent) {
          const agent = realTimeAgent[agentId]
          // Get external values
          let lastLogin = 0
          let lastLogout = 0
          let lastCall = 0
          let answeredCalls = 0
          let missedCalls = 0
          for (const agentName in agentsRealTimeStats) {
            if (agent.name === agentName) {
              agent.queues.allCalls = agentsRealTimeStats[agent.name].allCalls
              agent.queues.allQueues = agentsRealTimeStats[agent.name].allQueues
              agent.queues.incomingCalls = agentsRealTimeStats[agent.name].incomingCalls
              agent.queues.outgoingCalls = agentsRealTimeStats[agent.name].outgoingCalls
            }
          }
          for (const queueId in agent.queues) {
            const queue = agent.queues[queueId]
            // Check if the real-time stats exist for the agent and queue
            if (agentsRealTimeStats[agent.name] && agentsRealTimeStats[agent.name][queueId]) {
              queue.stats = agentsRealTimeStats[agent.name][queueId]
              // Last login
              if (queue?.stats?.last_login_time) {
                if (!lastLogin || lastLogin < queue?.stats?.last_login_time) {
                  lastLogin = queue?.stats?.last_login_time
                }
              }

              // Last logout
              if (queue?.stats?.last_logout_time) {
                if (!lastLogout || lastLogout < queue?.stats?.last_logout_time) {
                  lastLogout = queue?.stats?.last_logout_time
                }
              }

              // Last call
              if (queue?.stats?.last_call_time) {
                if (!lastCall || lastCall < queue?.stats?.last_call_time) {
                  lastCall = queue?.stats?.last_call_time
                }
              }

              // Answered calls
              if (queue?.stats?.calls_taken) {
                answeredCalls += queue?.stats?.calls_taken
              }

              // Missed calls
              if (queue?.stats?.no_answer_calls) {
                missedCalls += queue?.stats?.no_answer_calls
              }

              // Update answered calls count
              if (queue?.stats?.calls_taken) {
                queue.answeredcalls = queue.stats.calls_taken
              }

              // Update no answered calls count
              if (queue?.stats?.no_answer_calls) {
                queue.noAnswerCalls = queue.stats.no_answer_calls
              }

              // Update last call time
              if (queue?.stats?.last_call_time) {
                const lastCallTime = queue?.stats?.last_call_time
                if (lastCallTime > agent?.queues?.lastcall) {
                  queue.lastcall = new Date(lastCallTime * 1000).toLocaleTimeString()
                }
              }

              // Update last pause time
              if (queue?.stats?.last_paused_time) {
                queue.lastPause = new Date(
                  queue?.stats?.last_paused_time * 1000,
                ).toLocaleTimeString()
              }

              // Update since last pause time
              if (queue?.stats?.last_unpaused_time) {
                queue.lastEndPause = new Date(
                  queue.stats.last_unpaused_time * 1000,
                ).toLocaleTimeString()
                queue.sinceLastPause = exactDistanceToNowLoc(
                  new Date(queue.stats.last_unpaused_time * 1000),
                )
              }

              // Update from last call time
              if (queue?.stats?.last_call_time) {
                queue.lastCall = new Date(queue.stats.last_call_time * 1000).toLocaleTimeString()
                queue.sinceLastCall = exactDistanceToNowLoc(
                  new Date(queue.stats.last_call_time * 1000),
                )
              }

              //check time in queue
              if (queue?.stats?.time_in_logon) {
                queue.timeInLogon = formatDurationLoc(queue?.stats?.time_in_logon || 0)
              }

              //check time in pause ( TO DO )
              if (queue?.stats?.time_in_pause) {
                queue.timeInPause = formatDurationLoc(queue?.stats?.time_in_pause || 0)
              }

              //check pause on logon ( TO DO )
              if (queue?.stats?.pause_on_logon) {
                queue.pauseOnLogon = formatDurationLoc(queue?.stats?.pause_on_logon || 0)
              }

              //Time at phone
              if (queue?.stats?.conversation_percent) {
                queue.timeAtPhone = queue?.stats?.conversation_percent + '%'
              }

              //Average recall time
              if (queue?.stats?.avg_recall_time) {
                queue.timeRecall = formatDurationLoc(queue?.stats?.avg_recall_time || 0)
              }

              // Update and save queue inside updatedStat
              if (!updatedStats[agent.name]) {
                updatedStats[agent.name] = {}
              }
              updatedStats[agent.name][queueId] = queue
            }
          }
          // Update the agent's data with the calculated values
          //Last login
          if (lastLogin) {
            agent.queues.lastLogin = getCallTimeToDisplay(lastLogin * 1000)
          }

          //Last logout
          if (lastLogout) {
            agent.queues.lastLogout = getCallTimeToDisplay(lastLogin * 1000)
          }

          //Last calls
          if (lastCall) {
            agent.queues.fromLastCall = exactDistanceToNowLoc(new Date(lastCall * 1000))
          }

          //Answered calls
          agent.queues.answeredCalls = answeredCalls

          //Missed calls
          agent.queues.missedCalls = missedCalls

          // Time at phone
          agent.queues.timeAtPhone = formatDurationLoc(
            (agent?.queues?.outgoingCalls?.duration_outgoing || 0) +
              (agent?.queues?.incomingCalls?.duration_incoming || 0),
          )

          //Recall time
          agent.queues.recallTime = formatDurationLoc(
            agent?.queues?.allQueues?.avg_recall_time || 0,
          )

          // Minimum time
          agent.queues.timeMinimum = formatDurationLoc(agent?.queues?.allCalls?.min_duration || 0)

          // Maximum time
          agent.queues.timeMaximum = formatDurationLoc(agent?.queues?.allCalls?.max_duration || 0)

          // Average time
          agent.queues.timeAverage = formatDurationLoc(agent?.queues?.allCalls?.avg_duration || 0)

          // Incoming total time
          agent.queues.timeTotalIncoming = formatDurationLoc(
            agent?.queues?.incomingCalls?.duration_incoming || 0,
          )

          // Outgoing total time
          agent.queues.timeTotalOutgoing = formatDurationLoc(
            agent?.queues?.outgoingCalls?.duration_outgoing || 0,
          )
        }
      }
      setStats(updatedStats)
    } catch (e) {
      console.error(e)
    }
  }

  const [firstRender, setFirstRender]: any = useState(true)
  const STATS_UPDATE_INTERVAL = 10000 // .. seconds

  // retrieve stats
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    let intervalId: any = 0

    function fetchStatsInterval() {
      // fetch stats immediately and set interval
      fetchStats()

      // update every 5 seconds
      intervalId = setInterval(() => {
        fetchStats()
      }, STATS_UPDATE_INTERVAL)
    }
    fetchStatsInterval()

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [firstRender, realTimeAgent, expanded])

  // Operators section filters
  const applyFiltersOperators = () => {
    // text filter

    let filteredAgentMembers: any = Object.values(realTimeAgentConvertedArray).filter((op) =>
      searchOperatorsInQueuesMembers(op, textFilterOperators, queuesFilterOperators),
    )

    setFilteredAgentMembers(filteredAgentMembers)

    setInfiniteScrollOperators(filteredAgentMembers.slice(0, infiniteScrollLastIndex))
    const hasMore = infiniteScrollLastIndex < filteredAgentMembers.length
    setInfiniteScrollHasMore(hasMore)
  }

  // filtered operators
  useEffect(() => {
    applyFiltersOperators()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTimeAgentConvertedArray, textFilterOperators, queuesFilterOperators])

  // //get queues list information
  // useEffect(() => {
  //   // Avoid api double calling
  //   if (firstRenderQueuesList) {
  //     setFirstRenderQueuesList(false)
  //     return
  //   }
  //   async function getQueuesInformation() {
  //     setLoadedQueues(false)
  //     try {
  //       const res = await getQueues()
  //       setQueuesList(res)
  //     } catch (err) {
  //       console.error(err)
  //     }
  //     setLoadedQueues(true)
  //   }
  //   if (!isLoadedQueues) {
  //     getQueuesInformation()
  //   }
  // }, [firstRenderQueuesList, isLoadedQueues])

  // //get queues status information
  // useEffect(() => {
  //   // Avoid api double calling
  //   if (firstRenderQueuesStats) {
  //     setFirstRenderQueuesStats(false)
  //     return
  //   }
  //   async function getQueuesStats() {
  //     setLoadedQueuesStats(false)
  //     try {
  //       setAllQueuesStats(false)
  //       //get list of queues from queuesList
  //       const queuesName = Object.keys(queuesList)
  //       //get number of queues
  //       const queuesLength = queuesName.length

  //       // Get statuses for each queue
  //       for (let i = 0; i < queuesLength; i++) {
  //         const key = queuesName[i]
  //         const res = await getQueueStats(key)

  //         if (queuesList[key]) {
  //           queuesList[key].qstats = res
  //         }
  //       }

  //       setAllQueuesStats(true)
  //     } catch (err) {
  //       console.error(err)
  //     }
  //   }
  //   if (!isLoadedQueuesStats) {
  //     getQueuesStats()
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [queuesList, firstRenderQueuesStats])

  return (
    <>
      {/* Tab title  */}

      {/* Queues summary  */}
      <div className='flex items-center space-x-1'>
        <div className='flex-grow'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {t('QueueManager.Queues summary')}
          </h2>
        </div>
        <div className='flex items-center justify-end h-6 w-6'>
          <FontAwesomeIcon
            icon={expandedQueuesSummary ? faChevronUp : faChevronDown}
            className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
            aria-hidden='true'
            onClick={toggleQueuesSummary}
          />
        </div>
      </div>

      {/* divider */}
      <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1 mb-4'></div>
      {expandedQueuesSummary && (
        // Queue selection
        <>
          <div className='flex items-center'>
            <div className='flex items-center'>
              <span className='block text-sm font-medium text-gray-700 dark:text-gray-200'>
                {t('QueueManager.Select queue')}
              </span>
            </div>
            <PopoverGroup className='pl-20 flex items-center'>
              {/* queues filter */}
              <Popover
                as='div'
                key={queuesFilterQueues.name}
                id={`desktop-menu-${queuesFilterQueues.id}`}
                className='relative inline-block text-left shrink-0'
              >
                <div>
                  <PopoverButton className='px-3 py-2 flex items-center w-60 text-sm leading-4 p-2 rounded border shadow-sm border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-primaryLight dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-primaryDark group justify-between font-medium hover:text-gray-900 dark:hover:text-gray-100'>
                    <span className='flex justify-start overflow-hidden truncate w-40'>
                      {selectedQueues.length > 0
                        ? selectedQueues.join(', ')
                        : t('QueueManager.Select queue')}
                    </span>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className='ml-2 h-3 w-3 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                      aria-hidden='true'
                    />
                  </PopoverButton>
                </div>

                <Transition
                  as={Fragment}
                  enter='transition ease-out duration-100'
                  enterFrom='transform opacity-0 scale-95'
                  enterTo='transform opacity-100 scale-100'
                  leave='transition ease-in duration-75'
                  leaveFrom='transform opacity-100 scale-100'
                  leaveTo='transform opacity-0 scale-95'
                >
                  <PopoverPanel className='absolute right-0 z-10 mt-2 origin-top-right rounded-md min-w-max p-4 shadow-2xl ring-1 focus:outline-none ring-opacity-5 bg-white ring-black dark:ring-opacity-5 dark:bg-gray-900 dark:ring-gray-700'>
                    <form className='space-y-4'>
                      {queuesFilterQueues.options.map((option) => (
                        <div key={option.value} className='flex items-center'>
                          <input
                            id={`queues-${option.value}`}
                            name={`filter-${queuesFilterQueues.id}`}
                            type='checkbox'
                            defaultChecked={selectedQueues.includes(option.value)}
                            value={option.value}
                            onChange={changeQueuesFilter}
                            className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                          />
                          <label
                            htmlFor={`queues-${option.value}`}
                            className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                          >
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </form>
                  </PopoverPanel>
                </Transition>
              </Popover>
            </PopoverGroup>
          </div>

          <SummaryChart selectedQueues={selectedQueues}></SummaryChart>
        </>
      )}

      {/* Operator summary */}
      <div className='flex items-center space-x-1 pt-8'>
        <div className='flex-grow'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {t('QueueManager.Operators summary')}
          </h2>
        </div>
        <div className='flex items-center justify-end h-6 w-6'>
          <FontAwesomeIcon
            icon={expanded ? faChevronUp : faChevronDown}
            className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
            aria-hidden='true'
            onClick={toggleExpandQueue}
          />
        </div>
      </div>

      {/* divider */}
      <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>

      {expanded && (
        <>
          <div>
            <RealTimeOperatorsFilter
              updateTextFilter={debouncedUpdateTextFilterOperator}
              updateQueuesFilter={updateQueuesFilterOperators}
              className='pt-6'
            ></RealTimeOperatorsFilter>
            <div className='mx-auto text-center 5xl:max-w-screen-2xl'>
              {/* empty state */}
              {filteredAgentMembers.length === 0 && (
                <EmptyState
                  title={t('QueueManager.No agents') || ''}
                  description='There is no agent'
                  icon={
                    <FontAwesomeIcon
                      icon={faHeadset}
                      className='mx-auto h-12 w-12'
                      aria-hidden='true'
                    />
                  }
                ></EmptyState>
              )}
              {/* skeleton */}
              {!queueManagerStore.isLoaded && (
                <ul
                  role='list'
                  className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3 5xl:grid-cols-4 5xl:max-w-screen-2xl'
                >
                  {Array.from(Array(24)).map((e, index) => (
                    <li key={index} className='px-1'>
                      <button
                        type='button'
                        className='group flex w-full items-center justify-between space-x-3 rounded-lg p-2 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 bg-cardBackgroud dark:bg-cardBackgroudDark cursor-default'
                      >
                        <div className='flex min-w-0 flex-1 items-center space-x-3'>
                          <div className='block flex-shrink-0'>
                            <div className='animate-pulse rounded-full h-10 w-10 mx-auto bg-gray-300 dark:bg-gray-600'></div>
                          </div>
                          <span className='block min-w-0 flex-1'>
                            <div className='animate-pulse h-4 rounded bg-gray-300 dark:bg-gray-600'></div>
                          </span>
                        </div>
                        <span className='inline-flex h-10 w-10 flex-shrink-0 items-center justify-center'>
                          <FontAwesomeIcon
                            icon={faAngleRight}
                            className='h-3 w-3 text-gray-400 dark:text-gray-500'
                            aria-hidden='true'
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {filteredAgentMembers.length > 0 && (
                <InfiniteScroll
                  dataLength={infiniteScrollOperators.length}
                  next={showMoreInfiniteScrollOperators}
                  hasMore={infiniteScrollHasMore}
                  scrollableTarget='main-content'
                  loader={
                    <FontAwesomeIcon
                      icon={faCircleNotch}
                      className='inline-block text-center fa-spin h-8 m-10 text-gray-400 dark:text-gray-500'
                    />
                  }
                >
                  <ul
                    role='list'
                    className='grid grid-cols-1 gap-6 xl:grid-cols-2 3xl:grid-cols-3 overflow-y-hidden'
                  >
                    {infiniteScrollOperators.map((operator: any, index: number) => {
                      const isCardOpen = openedCardIndexes.includes(index)

                      return (
                        <li
                          key={index}
                          className={`col-span-1 rounded-md divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark dark:divide-gray-700 ${
                            isCardOpen ? 'h-full' : 'h-20'
                          }`}
                        >
                          {/* card header */}
                          <div className='flex flex-col pt-3 pb-5 px-5'>
                            <div className='flex w-full items-center justify-between space-x-6'>
                              <div className='flex items-center justify-between py-1 text-gray-700 dark:text-gray-200'>
                                <div className='flex items-center space-x-2'>
                                  <span className='block flex-shrink-0'>
                                    <Avatar
                                      rounded='full'
                                      src={operators[operator.shortname]?.avatarBase64}
                                      placeholderType='operator'
                                      bordered
                                      size='large'
                                      star={operators[operator.shortname]?.favorite}
                                      status={operators[operator.shortname]?.mainPresence}
                                      onClick={() =>
                                        openShowOperatorDrawer(operators[operator.shortname])
                                      }
                                      className='cursor-pointer'
                                    />
                                  </span>
                                  <div className='flex-1 pl-2'>
                                    <h3 className='truncate text-lg leading-6 font-medium'>
                                      {operator.name}
                                    </h3>
                                    <span className='block truncate mt-1 text-sm text-left font-medium text-gray-500 dark:text-gray-500'>
                                      <span>{operator.member}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <FontAwesomeIcon
                                icon={isCardOpen ? faChevronUp : faChevronDown}
                                className='h-4 w-4 text-gray-600 dark:text-gray-500 cursor-pointer ml-auto'
                                aria-hidden='true'
                                onClick={() => toggleExpandAgentCard(index)}
                              />
                            </div>
                            {/* Agent card body  */}
                            {isCardOpen && (
                              <>
                                {/* divider */}
                                <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>

                                {/* User statistics  */}
                                <div className='h-96 overflow-auto  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 pt-2'>
                                  <div className='px-3 py-4 '>
                                    <h3 className='truncate text-base leading-6 font-medium flex items-center'>
                                      <FontAwesomeIcon
                                        icon={faUser}
                                        className='h-4 w-4 mr-2'
                                        aria-hidden='true'
                                      />
                                      <span>{t('Queues.Login')}</span>
                                    </h3>
                                  </div>
                                  {/* divider */}
                                  <div className='flex-grow border-b border-gray-200 dark:border-gray-700 mt-1'></div>
                                  {/* login stats */}
                                  <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                                    {/* last login */}
                                    <div className='flex py-2 px-3'>
                                      <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                        {t('Queues.Last login')}
                                      </div>
                                      <div className='w-1/2 flex justify-end mr-4'>
                                        {operator?.queues?.lastLogin || '-'}
                                      </div>
                                    </div>
                                    {/* last logout */}
                                    <div className='flex py-2 px-3'>
                                      <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                        {t('Queues.Last logout')}
                                      </div>
                                      <div className='w-1/2 flex justify-end mr-4'>
                                        {operator?.queues?.lastLogout || '-'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* calls stats */}
                                  <div className='pt-4'>
                                    <div className='col-span-1 divide-y divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark text-gray-700 dark:divide-gray-700 dark:text-gray-200'>
                                      {/* card header */}
                                      <div className='px-3 py-4'>
                                        <h3 className='truncate text-base leading-6 font-medium flex items-center justify-start'>
                                          <FontAwesomeIcon
                                            icon={faPause}
                                            className='h-4 w-4 mr-2'
                                            aria-hidden='true'
                                          />
                                          <span>{t('QueueManager.Calls')}</span>
                                        </h3>
                                      </div>
                                      {/* card body */}
                                      <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                                        {/* last pause */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Answered calls')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.answeredCalls || '-'}
                                          </div>
                                        </div>
                                        {/* outgoing calls */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Outgoing calls')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.outgoingCalls?.outgoing_calls || '-'}
                                          </div>
                                        </div>
                                        {/* missed calls */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Missed calls')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.missedCalls || '-'}
                                          </div>
                                        </div>
                                        {/* from last calls */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Since last call')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.fromLastCall || '-'}
                                          </div>
                                        </div>
                                        {/* time at phone */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Time at phone')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.timeAtPhone || '-'}
                                          </div>
                                        </div>
                                        {/* recall time */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Recall time')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.recallTime || '-'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Calls duration */}
                                  <div className='pt-4'>
                                    <div className='col-span-1 divide-y divide-gray-200  text-gray-700 dark:divide-gray-700  dark:text-gray-200'>
                                      {/* card header */}
                                      <div className='px-3 py-4'>
                                        <h3 className='truncate text-base leading-6 font-medium flex items-center justify-start'>
                                          <FontAwesomeIcon
                                            icon={faPhone}
                                            className='h-4 w-4 mr-2'
                                            aria-hidden='true'
                                          />
                                          <span>{t('Queues.Calls duration')}</span>
                                        </h3>
                                      </div>
                                      {/* card body */}
                                      <div className='flex flex-col divide-y divide-gray-200 dark:divide-gray-700'>
                                        {/* Minimum time */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Minimum')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.timeMinimum || '-'}
                                          </div>
                                        </div>
                                        {/* maximum time */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Maximum')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.timeMaximum || '-'}
                                          </div>
                                        </div>
                                        {/* Average time */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Average')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.timeAverage || '-'}
                                          </div>
                                        </div>
                                        {/* total time incoming */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Incoming total')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.timeTotalIncoming || '-'}
                                          </div>
                                        </div>
                                        {/* total time outgoing */}
                                        <div className='flex py-2 px-3'>
                                          <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                            {t('QueueManager.Outgoing total')}
                                          </div>
                                          <div className='w-1/2 flex justify-end mr-4'>
                                            {operator?.queues?.timeTotalOutgoing || '-'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Queues body */}
                                <div className='pt-6 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25 h-56'>
                                  {Object.entries(operator.queues).map(
                                    ([queueNum, queue]: [string, any], queueIndex: number) => {
                                      if (isNaN(Number(queueNum))) {
                                        return null
                                      }

                                      const queueInfoIndex = `${index}-${queueIndex}`
                                      const isQueueCardOpen =
                                        openedQueueInformationIndexes.includes(queueInfoIndex)

                                      return (
                                        <div
                                          key={queueIndex}
                                          className='col-span-1 pt-2 divide-gray-200 dark:divide-gray-600 bg-cardBackgroud dark:bg-cardBackgroudDark text-gray-700 dark:text-gray-200 pb-6'
                                        >
                                          <div className='bg-gray-100 dark:bg-gray-700 rounded-md'>
                                            {/* Queue header */}
                                            <div className='flex w-full items-center justify-between space-x-6'>
                                              <div className='flex items-center justify-between py-3 px-4 w-full'>
                                                <div className='flex flex-grow justify-between'>
                                                  <div className='flex flex-col'>
                                                    <div className='truncate text-base leading-6 font-medium flex items-center space-x-2'>
                                                      <span>{queue?.qname}</span>
                                                      <span>{queue?.queue}</span>
                                                    </div>
                                                    <div className='flex pt-1'>
                                                      <LoggedStatus
                                                        loggedIn={queue?.loggedIn}
                                                        paused={queue?.paused}
                                                      />
                                                    </div>
                                                  </div>
                                                </div>
                                                <FontAwesomeIcon
                                                  icon={
                                                    isQueueCardOpen ? faChevronUp : faChevronDown
                                                  }
                                                  className='h-4 w-4 text-gray-600 dark:text-gray-500 cursor-pointer ml-auto'
                                                  aria-hidden='true'
                                                  onClick={() =>
                                                    toggleExpandCardQueueInformations(
                                                      index,
                                                      queueIndex,
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>
                                            {isQueueCardOpen && (
                                              <>
                                                {/* divider */}
                                                <div className='flex-grow border-b border-gray-200 dark:border-gray-600 mt-1'></div>

                                                {/* card body */}
                                                <div className='flex flex-col divide-y  divide-gray-200 dark:divide-gray-600'>
                                                  {/* Time in queue */}
                                                  <div className='flex py-2 px-3'>
                                                    <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                      {t('QueueManager.Time in queue')}
                                                    </div>
                                                    <div className='w-1/2 flex justify-end mr-4'>
                                                      {queue?.timeInLogon || '-'}
                                                    </div>
                                                  </div>
                                                  {/* Time in break */}
                                                  <div className='flex py-2 px-3'>
                                                    <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                      {t('QueueManager.Time in break')}
                                                    </div>
                                                    <div className='w-1/2 flex justify-end mr-4'>
                                                      {queue?.timeInPause || '-'}
                                                    </div>
                                                  </div>
                                                  {/* Pause on logon */}
                                                  <div className='flex py-2 px-3'>
                                                    <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                      {t('QueueManager.Pause on logon')}
                                                    </div>
                                                    <div className='w-1/2 flex justify-end mr-4'>
                                                      {queue?.pauseOnLogon || '-'}
                                                    </div>
                                                  </div>
                                                  {/* Time at phone */}
                                                  <div className='flex py-2 px-3'>
                                                    <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                      {t('QueueManager.Time at phone')}
                                                    </div>
                                                    <div className='w-1/2 flex justify-end mr-4'>
                                                      {queue?.timeAtPhone || '-'}
                                                    </div>
                                                  </div>
                                                  {/* Average recall time */}
                                                  <div className='flex py-2 px-3'>
                                                    <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>
                                                      {t('QueueManager.Average recall time')}
                                                    </div>
                                                    <div className='w-1/2 flex justify-end mr-4'>
                                                      {queue?.timeRecall || '-'}
                                                    </div>
                                                  </div>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    },
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </InfiniteScroll>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

Summary.displayName = 'Summary'
