// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { exactDistanceToNowLoc } from '../../../lib/dateTime'
import { getAgentsStats } from '../../../lib/queueManager'
import { RealTimeHeader } from './RealTimeHeader'
import { RealTimeOperators } from './RealTimeOperators'
import { RealTimeQueues } from './RealTimeQueues'
import { getCallTimeToDisplay } from '../../../lib/dateTime'

export interface RealTimeManagementProps extends ComponentProps<'div'> { }

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export const RealTimeManagement: FC<RealTimeManagementProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()

  const [realTimeAgent, setRealTimeAgent] = useState<any>({})
  const [realTimeAgentConvertedArray, setRealTimeAgentConvertedArray] = useState<any>([])

  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  // load extensions information from the store
  const operatorsStore = useSelector((state: RootState) => state.operators) as Record<string, any>

  const [realTimeAgentCounters, setRealTimeAgentCounters] = useState<any>({})

  //update agents counters
  useEffect(() => {
    const updateCounters = () => {
      let updatedCounters: Record<string, any> = {
        counters: {},
        waiting: 0,
        connected: 0,
        online: 0,
        offline: 0,
        paused: 0,
        busy: 0,
        free: 0,
        tot: 0,
      }

      for (const q in queueManagerStore?.queues) {
        updatedCounters.counters[q] = {
          total: 0,
          waiting: 0,
          connected: 0,
          online: 0,
          offline: 0,
          paused: 0,
          busy: 0,
          free: 0,
        }
      }

      let waitingCount = 0
      let connectedCount = 0
      let onlineCount = 0
      let offlineCount = 0
      let pausedCount = 0
      let busyCount = 0
      let freeCount = 0

      for (const q in queueManagerStore?.queues) {
        const waitingCallersCount = Object.keys(queueManagerStore?.queues[q].waitingCallers).length
        updatedCounters.counters[q].waiting = waitingCallersCount
        waitingCount += waitingCallersCount

        for (const m in queueManagerStore?.queues[q].members) {
          const member = queueManagerStore?.queues[q].members[m]

          if (member.loggedIn === true) {
            updatedCounters.counters[q].online += 1
            onlineCount += 1
          } else {
            updatedCounters.counters[q].offline += 1
            offlineCount += 1
          }

          if (member.paused === true) {
            updatedCounters.counters[q].paused += 1
            pausedCount += 1
          }

          const usernameMember = member.shortname
          const operatorconversation = operatorsStore.operators
          const memberConversations = operatorconversation[usernameMember]?.conversations
          if (
            memberConversations &&
            Object.keys(memberConversations).length > 0 &&
            memberConversations[Object.keys(memberConversations)[0]].connected === true
          ) {
            updatedCounters.counters[q].busy += 1
            busyCount += 1
          } else if (member.paused === false && member.loggedIn === true) {
            updatedCounters.counters[q].free += 1
            freeCount += 1
          }
        }
      }

      for (const e in operatorsStore.operators) {
        const conversations = operatorsStore.operators[e].conversations
        for (const c in conversations) {
          const conversation = conversations[c]
          //check if exists and is inside queue
          if (
            conversation?.connected === true &&
            conversation?.throughQueue === true &&
            queueManagerStore?.queues[conversation.queueId] !== undefined
          ) {
            const queueId = conversation.queueId
            if (updatedCounters.counters[queueId]) {
              updatedCounters.counters[queueId].connected += 1
            } else {
              updatedCounters.counters[queueId] = {
                total: 0,
                waiting: 0,
                connected: 1,
                online: 0,
                offline: 0,
                paused: 0,
                busy: 0,
                free: 0,
              }
            }
            connectedCount += 1
          }
        }
      }

      const total = waitingCount + connectedCount

      for (const q in updatedCounters.counters) {
        updatedCounters.counters[q].total =
          updatedCounters.counters[q].waiting + updatedCounters.counters[q].connected
      }

      updatedCounters.waiting = waitingCount
      updatedCounters.connected = connectedCount
      updatedCounters.online = onlineCount
      updatedCounters.offline = offlineCount
      updatedCounters.paused = pausedCount
      updatedCounters.busy = busyCount
      updatedCounters.free = freeCount
      updatedCounters.tot = total

      setRealTimeAgentCounters(updatedCounters)
    }

    updateCounters()
  }, [queueManagerStore, operatorsStore])

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
  const [firstRender, setFirstRender]: any = useState(true)
  const STATS_UPDATE_INTERVAL = 5000 // 5 seconds

  const fetchStats = async () => {
    try {
      const res = await getAgentsStats()
      const agentsRealTimeStats = res
      let updatedStats = {} as Record<string, any>

      if (realTimeAgent) {
        for (const agentId in realTimeAgent) {
          const agent = realTimeAgent[agentId]

          for (const queueId in agent.queues) {
            const queue = agent.queues[queueId]

            // Check if the real-time stats exist for the agent and queue
            if (agentsRealTimeStats[agent.name] && agentsRealTimeStats[agent.name][queueId]) {
              queue.stats = agentsRealTimeStats[agent.name][queueId]

              // Update answered calls count
              if (queue?.stats?.calls_taken) {
                queue.answeredcalls = queue.stats.calls_taken
              }

              // Update no answered calls count
              if (queue?.stats?.no_answer_calls) {
                queue.noAnswerCalls = queue.stats.no_answer_calls
              }

              // Last login
              if (queue?.stats?.last_login_time) {
                queue.lastLogin = getCallTimeToDisplay(queue.stats?.last_login_time * 1000)
              }

              // Last logout
              if (queue?.stats?.last_logout_time) {
                queue.lastLogout = getCallTimeToDisplay(
                  queue.stats?.last_logout_time * 1000,
                )
              }

              // Update last call time
              if (queue.stats.last_call_time) {
                const lastCallTime = queue.stats.last_call_time
                if (lastCallTime > agent.lastcall) {
                  queue.lastcall = getCallTimeToDisplay(lastCallTime * 1000)
                }
              }

              // Update last pause time
              if (queue.stats.last_paused_time) {
                queue.lastPause = getCallTimeToDisplay(queue.stats.last_paused_time * 1000)
              }

              // Update since last pause time
              if (queue.stats.last_unpaused_time) {
                queue.lastEndPause = getCallTimeToDisplay(
                  queue.stats.last_unpaused_time * 1000,
                )
                queue.sinceLastPause = exactDistanceToNowLoc(
                  new Date(queue.stats.last_unpaused_time * 1000),
                )
              }

              // Update from last call time
              if (queue.stats.last_call_time) {
                queue.lastCall = getCallTimeToDisplay(queue.stats.last_call_time * 1000)
                queue.sinceLastCall = exactDistanceToNowLoc(
                  new Date(queue.stats.last_call_time * 1000),
                )
              }
              // Update and save queue inside updatedStat
              if (!updatedStats[agent.name]) {
                updatedStats[agent.name] = {}
              }
              updatedStats[agent.name][queueId] = queue
            }
          }
        }
      }
      //Update the agents' data with the real-time stats

      setStats(updatedStats)
    } catch (e) {
      console.error(e)
    }
  }

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
  }, [firstRender, realTimeAgent])

  return (
    <>
      {/* Dashboard queue active section */}
      <RealTimeHeader realTimeAgentCounters={realTimeAgentCounters} />
      {/* Queues statistics*/}
      <RealTimeQueues realTimeAgentCounters={realTimeAgentCounters}></RealTimeQueues>
      {/* Operators statistics*/}
      <RealTimeOperators
        realTimeAgentConvertedArray={realTimeAgentConvertedArray}
      ></RealTimeOperators>
    </>
  )
}

RealTimeManagement.displayName = 'RealTimeManagement'
