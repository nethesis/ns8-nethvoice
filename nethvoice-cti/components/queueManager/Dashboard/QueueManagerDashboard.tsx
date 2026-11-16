// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown } from '../../common'
import {
  DashboardRankCard,
  OperatorRankRows,
  QueueRankRows,
  RankIndexCell,
  RankValueCell,
} from './DashboardRankCard'
import { isEmpty } from 'lodash'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { savePreference } from '../../../lib/storage'
import { faCheck, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import {
  getQueues,
  getAgentsStats,
  getQueueStats,
  getTotalsForEachKey,
  sortAgentsData,
  convertToHumanReadable,
  getQueuesHistory,
  getExpandedQueueManagerDashboardValue,
  getFullUsername,
  getQueuesDashboardRank,
  agentsDashboardRanks,
  getQueueName,
  setOperatorInformationDrawer,
  retrieveOnlyNotManaged,
} from '../../../lib/queueManager'
import { invertObject } from '../../../lib/utils'
import { QueueManagerDashboardChart } from '../Chart/QueueManagerDashboardChart'
import { QueueManagerDashboardHeader } from './QueueManagerDashboardHeader'

import { openShowOperatorDrawer } from '../../../lib/operators'

export interface QueueManagerDashboardProps extends ComponentProps<'div'> {}

export const QueueManagerDashboard: FC<QueueManagerDashboardProps> = ({
  className,
}): JSX.Element => {
  const { t } = useTranslation()

  const [firstRenderQueuesList, setFirstRenderQueuesList]: any = useState(true)
  const [firstRenderQueuesStats, setFirstRenderQueuesStats]: any = useState(true)
  const [firstRenderQueuesHistory, setFirstRenderQueuesHistory]: any = useState(true)
  const [firstRenderQueuesAgents, setFirstRenderQueuesAgents]: any = useState(true)

  const { operators } = useSelector((state: RootState) => state.operators)

  // load operators information from the store
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const [operatorInformation, setOperatorInformation] = useState<any>()

  // get operator information from the store
  useEffect(() => {
    if (operatorsStore && !operatorInformation) {
      setOperatorInformation(operatorsStore.operators)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [expandedOperators, setExpandedOperators] = useState(false)
  const [expandedQueues, setExpandedQueues] = useState(true)

  const auth = useSelector((state: RootState) => state.authentication)

  //set Expanded Operators value to localStorage
  const toggleExpandedOperators = () => {
    setExpandedOperators(!expandedOperators)
    let correctExpandedOperators = !expandedOperators
    savePreference(
      'queueManagerDashboardOperatorsStatisticExpandedPreference',
      correctExpandedOperators,
      auth.username,
    )
  }

  //set Expanded Queues value to localStorage
  const toggleExpandedQueues = () => {
    setExpandedQueues(!expandedQueues)
    let correctExpandedQueues = !expandedQueues
    savePreference(
      'queueManagerQueuesStatisticExpandedPreference',
      correctExpandedQueues,
      auth.username,
    )
  }

  //set expanded values at the beginning
  useEffect(() => {
    const expandedValues = getExpandedQueueManagerDashboardValue(auth.username)
    setExpandedOperators(expandedValues.expandedOperators)
    setExpandedQueues(expandedValues.expandedQueues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [queuesList, setQueuesList] = useState<any>({})
  const [agentsStatsList, setAgentsStatsList] = useState<any>({})
  const [isLoadedQueuesStats, setLoadedQueuesStats] = useState(false)
  const [isLoadedQueuesAgents, setLoadedQueuesAgents] = useState(false)
  const [isLoadedQueuesHistory, setLoadedQueuesHistory] = useState(false)
  const [queuesHistory, setQueuesHistory] = useState<any>({})
  const [isLoadedQueues, setLoadedQueues] = useState(false)

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

  //get queues list information
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

  const [notManaged, setNotManaged]: any = useState({})
  const [firstRenderNotManaged, setFirstRenderNotManaged]: any = useState(true)
  const [isLoadedQueuesNotManaged, setLoadedQueuesNotManaged] = useState(false)
  const [queueManagerQueues, setQueueManagerQueues]: any = useState({})
  const queueManagerStore = useSelector((state: RootState) => state.queueManagerQueues)

  // //set all queue manager queues
  // let selectedQueues = Object.keys(queueManagerStore.queues)

  useEffect(() => {
    if (queueManagerStore.queues) {
      setQueueManagerQueues(Object.keys(queueManagerStore.queues))
    }
  }, [queueManagerStore.isLoaded, queueManagerStore.queues])

  //get queues list information
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderNotManaged) {
      setFirstRenderNotManaged(false)
      return
    }
    async function getQueuesNotManaged() {
      if (!isEmpty(queueManagerQueues)) {
        setLoadedQueuesNotManaged(false)
        try {
          const res = await retrieveOnlyNotManaged(queueManagerQueues)
          setNotManaged(res)
        } catch (err) {
          console.error(err)
        }
        setLoadedQueuesNotManaged(true)
      }
    }
    if (!isLoadedQueuesNotManaged) {
      getQueuesNotManaged()
    }
  }, [
    firstRenderNotManaged,
    isLoadedQueuesNotManaged,
    queueManagerStore.isLoaded,
    queueManagerQueues,
  ])

  // Get queues history information
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderQueuesHistory) {
      setFirstRenderQueuesHistory(false)
      return
    }
    async function getQueueHistory() {
      setLoadedQueuesHistory(false)
      try {
        const res = await getQueuesHistory()
        setQueuesHistory(res)
      } catch (err) {
        console.error(err)
      }
      setLoadedQueuesHistory(true)
    }
    if (!isLoadedQueuesHistory) {
      getQueueHistory()
    }
  }, [firstRenderQueuesHistory, isLoadedQueuesHistory, isLoadedQueues])

  // initialize allQueuesStats to false
  // it will be true only if all queues have been populated with states
  const [allQueuesStats, setAllQueuesStats] = useState(false)

  //get queues status information
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

        // Get statuses for each queue
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
  }, [queuesList, firstRenderQueuesStats])

  const [totalAll, setTotalAll] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [totalFailed, setTotalFailed] = useState(0)
  const [totalInvalid, setTotalInvalid] = useState(0)
  const [totalInProgress, setTotalInProgress] = useState(0)

  const [queuesTotalCalls, setQueuesTotalCalls] = useState({} as Record<string, any>)
  const [queuesFailedCalls, setQueuesFailedCalls] = useState({} as Record<string, any>)
  const [queuesInvalidCalls, setQueuesInvalidCalls] = useState({} as Record<string, any>)
  const [queuesFailures, setQueuesFailures] = useState({} as Record<string, any>)
  const [averageCallTime, setAverageCallTime] = useState({} as Record<string, any>)
  const [averageCallTimeQueue, setAverageCallTimeQueue] = useState({} as Record<string, any>)

  //type of order section
  const [sortOrderQueuesTotalCalls, setSortOrderQueuesTotalCalls] = useState<'asc' | 'desc'>('desc')
  const [sortOrderQueuesFailedCalls, setSortOrderQueuesFailedCalls] = useState<'asc' | 'desc'>(
    'desc',
  )
  const [sortOrderQueuesInvalidCalls, setSortOrderQueuesInvalidCalls] = useState<'asc' | 'desc'>(
    'desc',
  )
  const [sortOrderQueuesFailures, setSortOrderQueuesFailures] = useState<'asc' | 'desc'>('desc')

  const [sortOrderAverageCallTime, setSortOrderAverageCallTime] = useState<'asc' | 'desc'>('desc')

  const [sortOrderAverageCallTimeQueue, setSortOrderAverageCallTimeQueue] = useState<
    'asc' | 'desc'
  >('desc')

  const [sortOrderAnsweredCalls, setSortOrderAnsweredCalls] = useState<'asc' | 'desc'>('desc')
  const [sortOrderUnansweredCalls, setSortOrderUnansweredCalls] = useState<'asc' | 'desc'>('desc')
  const [sortOrderPauseOnLogin, setSortOrderPauseOnLogin] = useState<'asc' | 'desc'>('desc')

  const [sortOrderAgentsLoginTime, setSortOrderAgentsLoginTime] = useState<'asc' | 'desc'>('desc')
  const [sortOrderAgentsPauseTime, setSortOrderAgentsPauseTime] = useState<'asc' | 'desc'>('desc')
  const [sortOrderInCallPercentage, setSortOrderInCallPercentage] = useState<'asc' | 'desc'>('desc')

  //change card order
  // the order buttons open a menu with the two directions, the current one checked
  // same layout as the speed dial sort menu: label on the left, check on the right
  const sortOrderItems = (sortOrder: 'asc' | 'desc', setSortOrder: any) => (
    <>
      <Dropdown.Item onClick={() => setSortOrder('desc')}>
        <span>{t('QueueManager.Descending order')}</span>
        {sortOrder === 'desc' && (
          <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
        )}
      </Dropdown.Item>
      <Dropdown.Item onClick={() => setSortOrder('asc')}>
        <span>{t('QueueManager.Ascending order')}</span>
        {sortOrder === 'asc' && (
          <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
        )}
      </Dropdown.Item>
    </>
  )

  //get total calls for headers cards Dashboard
  useEffect(() => {
    // carry out the operations only after the data has been inserted to the queues
    if (allQueuesStats) {
      //total calls tables section
      const keys = ['tot_processed', 'tot_failed', 'tot', 'tot_null']
      const calculatedRank = getQueuesDashboardRank(keys, queuesList)

      const rankBy = (field: string) =>
        Object.values(calculatedRank).map((queue: any) => ({
          name: queue.name,
          queue: queue.queue,
          values: queue.values[field],
        }))

      setQueuesTotalCalls(sortAgentsData(rankBy('tot'), sortOrderQueuesTotalCalls))
      setQueuesFailedCalls(sortAgentsData(rankBy('tot_failed'), sortOrderQueuesFailedCalls))
      setQueuesInvalidCalls(sortAgentsData(rankBy('tot_null'), sortOrderQueuesInvalidCalls))

      //failure calls tables section
      const reasonsToFailCallsKeys = [
        'failed_abandon',
        'failed_full',
        'failed_inqueue_noagents',
        'failed_outqueue_noagents',
        'failed_timeout',
        'failed_withkey',
      ]

      const failureCallRank = getQueuesDashboardRank(reasonsToFailCallsKeys, queuesList)
      const totalValueForEachFailuerType = getTotalsForEachKey(failureCallRank)

      const queuesFailuresData = Object.values(totalValueForEachFailuerType).map(
        (agent: any, index: number) => ({
          name: agent.name,
          queue: agent.queue,
          values: agent.values.value,
          note: agent.note,
        }),
      )

      const sortedQueuesFailuresData = sortAgentsData(queuesFailuresData, sortOrderQueuesFailures)
      setQueuesFailures(sortedQueuesFailuresData)

      // top section of the dashboard page
      // total counts cards section
      // Initialize variables to hold the total counts
      let totalAllCount = 0
      let totalAnsweredCount = 0
      let totalFailedCount = 0
      let totalInvalidCount = 0

      // Iterate over each queue in calculatedRank and calculate the totals
      calculatedRank.forEach((queue: any) => {
        totalAllCount += queue.values.tot
        totalAnsweredCount += queue.values.tot_processed
        totalFailedCount += queue.values.tot_failed
        totalInvalidCount += queue.values.tot_null
      })
      // Update the state with the calculated totals
      setTotalAll(totalAllCount)
      setTotalAnswered(totalAnsweredCount)
      setTotalFailed(totalFailedCount)
      setTotalInvalid(totalInvalidCount)
      setTotalInProgress(totalAllCount - totalAnsweredCount - totalFailedCount - totalInvalidCount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allQueuesStats,
    queuesList,
    sortOrderQueuesFailedCalls,
    sortOrderQueuesTotalCalls,
    sortOrderQueuesInvalidCalls,
    sortOrderQueuesFailures,
  ])

  //get queues agents stats
  useEffect(() => {
    // Avoid api double calling
    if (firstRenderQueuesAgents) {
      setFirstRenderQueuesAgents(false)
      return
    }
    async function getQueuesAgentsStats() {
      setLoadedQueuesAgents(false)
      try {
        const res = await getAgentsStats()
        setAgentsStatsList(res)
      } catch (err) {
        console.error(err)
      }
      setLoadedQueuesAgents(true)
    }
    if (!isLoadedQueuesAgents) {
      getQueuesAgentsStats()
    }
  }, [firstRenderQueuesAgents, isLoadedQueuesAgents])

  // Get operators short names ( only for average call functions)
  function getAverageCallFullUsername(operator: any, operatorInformation: any) {
    let shortname = ''
    if (operator && operatorInformation) {
      const username = operatorInformation[operator]
      if (username) {
        shortname = username
      }
    }
    return shortname
  }

  const [agentsAnswered, setAgentsAnswered] = useState({} as Record<string, any>)
  const [agentsLost, setAgentsLost] = useState({} as Record<string, any>)
  const [agentsPauseOnLogon, setAgentsPauseOnLogon] = useState({} as Record<string, any>)

  const [agentsLoginTime, setAgentsLoginTime] = useState({} as Record<string, any>)
  const [agentsPauseTime, setAgentsPauseTime] = useState({} as Record<string, any>)
  const [inCallPercentage, setInCallPercentage] = useState({} as Record<string, any>)

  const avgRecallTimeRanks = (queuesInformation: any) => {
    const newQueuesInformation = { ...queuesInformation }

    for (const agent in newQueuesInformation) {
      //check if allQueues object exists
      if (
        !newQueuesInformation[agent].allQueues ||
        (!newQueuesInformation[agent].allQueues.avg_recall_time &&
          !newQueuesInformation[agent].allQueues.min_recall_time &&
          !newQueuesInformation[agent].allQueues.max_recall_time)
      ) {
        delete newQueuesInformation[agent]
      }
    }
    return newQueuesInformation
  }

  //Get average recall time value
  useEffect(() => {
    if (isLoadedQueuesAgents) {
      let avgRecallTime = avgRecallTimeRanks(agentsStatsList)

      const invertedOperatorInformation = invertObject(operatorInformation)
      const avgRecallTimeArray = Object.entries(avgRecallTime).map(
        ([name, data]: [string, any]) => ({
          name,
          values: data?.allQueues?.avg_recall_time ?? 0,
          shortname: getAverageCallFullUsername(name, invertedOperatorInformation),
        }),
      )

      const sortedAvgRecallTimeArray = sortAgentsData(avgRecallTimeArray, sortOrderAverageCallTime)
      setAverageCallTime(sortedAvgRecallTimeArray)

      const avgRecallTimeQueueSum: { [key: string]: { values: number; name: string } } = {}

      Object.values(avgRecallTime).forEach((userData: any) => {
        Object.entries(userData)
          .filter(([queue]) => /^\d+$/.test(queue))
          .forEach(([queue, queueData]: [string, any]) => {
            if (!avgRecallTimeQueueSum[queue]) {
              avgRecallTimeQueueSum[queue] = {
                values: queueData?.avg_recall_time ?? 0,
                name: queue,
              }
            } else {
              avgRecallTimeQueueSum[queue].values += queueData?.avg_recall_time ?? 0
            }
          })
      })

      const sortedAvgRecallTimeQueueArray = sortAgentsData(
        Object.values(avgRecallTimeQueueSum),
        sortOrderAverageCallTimeQueue,
      )
      setAverageCallTimeQueue(sortedAvgRecallTimeQueueArray)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoadedQueuesAgents,
    sortOrderAnsweredCalls,
    sortOrderInCallPercentage,
    sortOrderAverageCallTimeQueue,
    sortOrderAverageCallTime,
  ])

  useEffect(() => {
    if (isLoadedQueuesAgents) {
      const keys = [
        'calls_taken',
        'no_answer_calls',
        'pause_percent',
        'time_in_logon',
        'time_in_pause',
        'conversation_percent',
      ]
      let calculatedAgent = agentsDashboardRanks(keys, agentsStatsList)
      const invertedOperatorInformation = invertObject(operatorInformation)

      const agentsAnsweredData = Object.values(calculatedAgent).map(
        (agent: any, index: number) => ({
          name: agent.name,
          shortname: getFullUsername(agent, invertedOperatorInformation),
          queue: agent.queue,
          values: agent.values.calls_taken,
        }),
      )

      const agentsLostData = Object.values(calculatedAgent).map((agent: any, index: number) => ({
        name: agent.name,
        shortname: getFullUsername(agent, invertedOperatorInformation),
        queue: agent.queue,
        values: agent.values.no_answer_calls,
      }))

      const agentsPauseOnLogonData = Object.values(calculatedAgent).map(
        (agent: any, index: number) => ({
          name: agent.name,
          shortname: getFullUsername(agent, invertedOperatorInformation),
          queue: agent.queue,
          values: agent.values.pause_percent,
        }),
      )

      const agentsLoginTimeData = Object.values(calculatedAgent).map(
        (agent: any, index: number) => ({
          name: agent.name,
          shortname: getFullUsername(agent, invertedOperatorInformation),
          queue: agent.queue,
          values: agent.values.time_in_logon,
        }),
      )

      const agentsPauseTimeData = Object.values(calculatedAgent).map(
        (agent: any, index: number) => ({
          name: agent.name,
          shortname: getFullUsername(agent, invertedOperatorInformation),
          queue: agent.queue,
          values: agent.values.time_in_pause,
        }),
      )

      const inCallPercentageData = Object.values(calculatedAgent).map(
        (agent: any, index: number) => ({
          name: agent.name,
          shortname: getFullUsername(agent, invertedOperatorInformation),
          queue: agent.queue,
          values: agent.values.conversation_percent,
        }),
      )

      const sortedAgentsAnswered = sortAgentsData(agentsAnsweredData, sortOrderAnsweredCalls)
      const sortedAgentsLost = sortAgentsData(agentsLostData, sortOrderUnansweredCalls)
      const sortedAgentsPauseOnLogon = sortAgentsData(agentsPauseOnLogonData, sortOrderPauseOnLogin)

      const sortedAgentsLoginTimeData = sortAgentsData(
        agentsLoginTimeData,
        sortOrderAgentsLoginTime,
      )
      const sortedAgentsPauseTimeData = sortAgentsData(
        agentsPauseTimeData,
        sortOrderAgentsPauseTime,
      )

      const sortedInCallPercentageData = sortAgentsData(
        inCallPercentageData,
        sortOrderInCallPercentage,
      )

      setAgentsAnswered(sortedAgentsAnswered)
      setAgentsLost(sortedAgentsLost)
      setAgentsPauseOnLogon(sortedAgentsPauseOnLogon)
      setAgentsLoginTime(sortedAgentsLoginTimeData)
      setAgentsPauseTime(sortedAgentsPauseTimeData)
      setInCallPercentage(sortedInCallPercentageData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoadedQueuesAgents,
    sortOrderAnsweredCalls,
    sortOrderUnansweredCalls,
    sortOrderPauseOnLogin,
    sortOrderAgentsLoginTime,
    sortOrderAgentsPauseTime,
    sortOrderInCallPercentage,
  ])

  return (
    <>
      {/* Top page section */}
      <QueueManagerDashboardHeader
        totalAll={totalAll}
        totalAnswered={totalAnswered}
        totalFailed={totalFailed}
        totalInvalid={totalInvalid}
        totalInProgress={totalInProgress}
        notManaged={notManaged}
      ></QueueManagerDashboardHeader>
      {/* Chart section */}
      <QueueManagerDashboardChart
        isLoadedQueuesHistory={isLoadedQueuesHistory}
        queuesHistory={queuesHistory}
        queuesList={queueManagerStore.queues}
        isLoadedQueues={isLoadedQueues}
      ></QueueManagerDashboardChart>

      {/* Operator statistics section */}
      <div className='py-12 mt-8 relative'>
        <div className='flex items-center space-x-1'>
          <div className='flex-grow'>
            <h2 className='text-base font-semibold ml-2'>
              {t('QueueManager.Operators statistics')}
            </h2>
          </div>
          <div className='flex items-center justify-end h-6 w-6'>
            <FontAwesomeIcon
              icon={expandedOperators ? faChevronUp : faChevronDown}
              className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
              aria-hidden='true'
              onClick={toggleExpandedOperators}
            />
          </div>
        </div>
        <div className='flex-grow border-b border-gray-200 dark:border-gray-700'></div>
        {expandedOperators && (
          <>
            <div className='grid grid-cols-1 gap-6 xl:grid-cols-2 3xl:grid-cols-3 pt-6'>
              {/* Number of answered calls  */}
              <DashboardRankCard
                title={t('QueueManager.Number of answered calls')}
                sortItems={sortOrderItems(sortOrderAnsweredCalls, setSortOrderAnsweredCalls)}
                isLoading={!isLoadedQueues}
              >
                <OperatorRankRows
                  rows={agentsAnswered}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                />
              </DashboardRankCard>

              {/* Number of unanswered calls  */}
              <DashboardRankCard
                title={t('QueueManager.Number of unanswered calls')}
                sortItems={sortOrderItems(sortOrderUnansweredCalls, setSortOrderUnansweredCalls)}
                isLoading={!isLoadedQueues}
                withDivider
              >
                <OperatorRankRows
                  rows={agentsLost}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => setOperatorInformationDrawer(agent, operatorsStore)}
                />
              </DashboardRankCard>

              {/* Pause on login  */}
              <DashboardRankCard
                title={t('QueueManager.Pause on login')}
                sortItems={sortOrderItems(sortOrderPauseOnLogin, setSortOrderPauseOnLogin)}
                isLoading={!isLoadedQueues}
                withDivider
              >
                <OperatorRankRows
                  rows={agentsPauseOnLogon}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => setOperatorInformationDrawer(agent, operatorsStore)}
                  formatValue={(value) => `${value}%`}
                />
              </DashboardRankCard>

              {/* Time on login  */}
              <DashboardRankCard
                title={t('QueueManager.Time on login')}
                sortItems={sortOrderItems(sortOrderAgentsLoginTime, setSortOrderAgentsLoginTime)}
                isLoading={!isLoadedQueues}
                withDivider
              >
                <OperatorRankRows
                  rows={agentsLoginTime}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => setOperatorInformationDrawer(agent, operatorsStore)}
                  formatValue={(value) => convertToHumanReadable(value)}
                />
              </DashboardRankCard>

              {/* Pause time  */}
              <DashboardRankCard
                title={t('QueueManager.Pause time')}
                sortItems={sortOrderItems(sortOrderAgentsPauseTime, setSortOrderAgentsPauseTime)}
                isLoading={!isLoadedQueues}
                withDivider
              >
                <OperatorRankRows
                  rows={agentsPauseTime}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => setOperatorInformationDrawer(agent, operatorsStore)}
                  formatValue={(value) => convertToHumanReadable(value)}
                />
              </DashboardRankCard>

              {/* In call percentage */}
              <DashboardRankCard
                title={t('QueueManager.In call percentage')}
                sortItems={sortOrderItems(sortOrderInCallPercentage, setSortOrderInCallPercentage)}
                isLoading={!isLoadedQueues}
                withDivider
              >
                <OperatorRankRows
                  rows={inCallPercentage}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => setOperatorInformationDrawer(agent, operatorsStore)}
                  formatValue={(value) => `${value}%`}
                />
              </DashboardRankCard>
            </div>
          </>
        )}
      </div>

      {/* Queues statistics section */}
      <div className='py-2 relative'>
        <div className='flex items-center space-x-1'>
          <div className='flex-grow'>
            <h2 className='text-base font-semibold ml-2'>{t('QueueManager.Queues statistics')}</h2>
          </div>
          <div className='flex items-center justify-end h-6 w-6'>
            <FontAwesomeIcon
              icon={expandedQueues ? faChevronUp : faChevronDown}
              className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
              aria-hidden='true'
              onClick={toggleExpandedQueues}
            />
          </div>
        </div>
        <div className='flex-grow border-b border-gray-200 dark:border-gray-700'></div>
        {expandedQueues && (
          <>
            <div className='grid grid-cols-1 gap-6 xl:grid-cols-2 3xl:grid-cols-3 pt-6'>
              {/* Total calls  */}
              <DashboardRankCard
                title={t('QueueManager.Total calls')}
                sortItems={sortOrderItems(sortOrderQueuesTotalCalls, setSortOrderQueuesTotalCalls)}
                isLoading={!isLoadedQueues}
              >
                <QueueRankRows rows={queuesTotalCalls} />
              </DashboardRankCard>

              {/* Unanswered calls  */}
              <DashboardRankCard
                title={t('QueueManager.Unanswered calls')}
                sortItems={sortOrderItems(
                  sortOrderQueuesFailedCalls,
                  setSortOrderQueuesFailedCalls,
                )}
                isLoading={!isLoadedQueues}
              >
                <QueueRankRows rows={queuesFailedCalls} />
              </DashboardRankCard>

              {/* Invalid calls  */}
              <DashboardRankCard
                title={t('QueueManager.Invalid calls')}
                sortItems={sortOrderItems(
                  sortOrderQueuesInvalidCalls,
                  setSortOrderQueuesInvalidCalls,
                )}
                isLoading={!isLoadedQueues}
              >
                <QueueRankRows rows={queuesInvalidCalls} />
              </DashboardRankCard>

              {/* Missed call reasons  */}
              <DashboardRankCard
                title={t('QueueManager.Missed call reasons')}
                sortItems={sortOrderItems(sortOrderQueuesFailures, setSortOrderQueuesFailures)}
                isLoading={!isLoadedQueues}
              >
                {Object.values(queuesFailures).map((queue: any, index: number) => (
                  <tr key={index}>
                    <RankIndexCell index={index} />
                    <td className='whitespace-nowrap py-3 pl-4 pr-3 text-sm sm:pl-0'>
                      <div className='flex items-center py-3'>
                        <div className='text-gray-900 dark:text-gray-100'>
                          {queue?.name} ({queue?.queue})
                        </div>
                      </div>
                    </td>
                    <RankValueCell>{t(`QueueManager.${queue?.note}`)}</RankValueCell>
                    <RankValueCell>{queue?.values}</RankValueCell>
                  </tr>
                ))}
              </DashboardRankCard>

              {/* Average call time */}
              <DashboardRankCard
                title={t('QueueManager.Average call time')}
                sortItems={sortOrderItems(sortOrderAverageCallTime, setSortOrderAverageCallTime)}
                isLoading={!isLoadedQueues}
                withDivider
              >
                <OperatorRankRows
                  rows={averageCallTime}
                  operators={operators}
                  onAvatarClick={(agent) => openShowOperatorDrawer(operators[agent?.shortname])}
                  onNameClick={(agent) => setOperatorInformationDrawer(agent, operatorsStore)}
                  formatValue={(value) => convertToHumanReadable(value)}
                  emptyValue='00:00:00'
                  isTallIndex
                />
              </DashboardRankCard>

              {/* Average callback time */}
              <DashboardRankCard
                title={t('QueueManager.Average callback time')}
                sortItems={sortOrderItems(
                  sortOrderAverageCallTimeQueue,
                  setSortOrderAverageCallTimeQueue,
                )}
                isLoading={!isLoadedQueues}
                withDivider
              >
                {Array.from({ length: 5 }).map((_, index) => {
                  const agent = Object.values(averageCallTimeQueue)[index]
                  const isRowEmpty = !agent

                  return (
                    <tr key={index}>
                      <RankIndexCell index={index} isTall />
                      <td className='whitespace-nowrap py-3 pl-4 pr-3 text-sm sm:pl-0'>
                        <div className='flex items-center'>
                          <span className='flex-shrink-0 mr-2'>
                            {isRowEmpty ? '' : getQueueName(agent?.name, queuesList)}
                          </span>
                          <div className='text-gray-900 dark:text-gray-100'>
                            {isRowEmpty ? '-' : agent?.name}
                          </div>
                        </div>
                      </td>
                      <RankValueCell>
                        {isRowEmpty ? '00:00:00' : convertToHumanReadable(agent?.values)}
                      </RankValueCell>
                    </tr>
                  )
                })}
              </DashboardRankCard>
            </div>
          </>
        )}
      </div>
    </>
  )
}

QueueManagerDashboard.displayName = 'QueueManagerDashboard'
