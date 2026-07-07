// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { QueueManagerDashboard } from '../components/queueManager/Dashboard/QueueManagerDashboard'
import { QueueManagement } from '../components/queueManager/QueueManagement/QueueManagement'
import { NotManagedCalls } from '../components/queueManager/NotManaged/NotManagedCalls'
import { RealTimeManagement } from '../components/queueManager/Realtime/RealTimeManagement'
import { Summary } from '../components/queueManager/Summary/Summary'
import { Monitor } from '../components/queueManager/Monitor/Monitor'
import { useSelector } from 'react-redux'
import { RootState, store } from '../store'
import { savePreference } from '../lib/storage'
import { getSelectedTabQueueManager } from '../lib/queueManager'
import { Button } from '../components/common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { getApiEndpoint, getApiVoiceEndpoint } from '../lib/utils'
import { getApiScheme } from '../lib/utils'
import { useRouter } from 'next/router'
import { MissingPermission } from '../components/common/MissingPermissionsPage'

interface tabsType {
  name: string
  href: string
  current: boolean
}

const QueueManager: NextPage = () => {
  const { t } = useTranslation()

  const apiVoiceEnpoint = getApiVoiceEndpoint()
  const apiScheme = getApiScheme()
  const pbxReportUrl = apiScheme + apiVoiceEnpoint + '/pbx-report/'

  const auth = useSelector((state: RootState) => state.authentication)
  const router = useRouter()

  const tabs: tabsType[] = [
    { name: t('QueueManager.Dashboard'), href: '#', current: false },
    { name: t('QueueManager.Queues management'), href: '#', current: false },
    { name: t('QueueManager.Customers management'), href: '#', current: false },
    { name: t('QueueManager.Live'), href: '#', current: false },
    { name: t('QueueManager.Summary'), href: '#', current: false },
    { name: t('QueueManager.Monitor'), href: '#', current: false },
  ]

  const [items, setItems] = useState<tabsType[]>(tabs)
  const [currentSection, setCurrentSection] = useState<string>(tabs[0].name)
  const [firstRender, setFirstRender]: any = useState(true)

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    let section = router.query.section as string

    if (!currentSection && !section) {
      section = 'Dashboard'
    }
    changeSection(section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRender])

  const changeSection = (sectionName: string) => {
    const currentItems = items.map((route) => {
      if (sectionName === route.name) {
        route.current = true
        setCurrentSection(sectionName)
        savePreference('queueManagerSelectedTab', sectionName, auth.username)
      } else {
        route.current = false
      }
      return route
    })
    setItems(currentItems)
  }

  //Load selected tab values from local storage
  useEffect(() => {
    const currentSection = getSelectedTabQueueManager(auth.username)
    setCurrentSection(currentSection.selectedQueueManagerTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load queues when navigating to queues page
  useEffect(() => {
    store.dispatch.queueManagerQueues.setLoaded(false)
  }, [])

  const { profile } = useSelector((state: RootState) => state.user)

  return (
    <>
      {profile?.macro_permissions?.qmanager?.value ? (
        <div>
          <div className='flex items-center justify-between'>
            <h1 className='text-2xl font-semibold text-gray-900 dark:text-gray-100'>
              {t('QueueManager.Queue manager')}
            </h1>
            <div className='text-gray-900 dark:text-gray-100 text-sm flex items-center'>
              <Button size='small' variant='white'>
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='mr-2 h-5 w-4' />
                <a href={pbxReportUrl} target='_blank' rel='noreferrer'>
                  {t('Applications.Open PBX Report')}
                </a>
              </Button>
            </div>
          </div>

          {/* tabs */}
          <>
            <div className='mb-6 mt-6'>
              {/* mobile tabs */}
              <div className='sm:hidden'>
                <label htmlFor='tabs' className='sr-only'>
                  {t('Queues.Select a tab')}
                </label>
                <select
                  id='tabs'
                  name='tabs'
                  className='block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primaryDark dark:focus:ring-primaryDark dark:bg-gray-900'
                  defaultValue={currentSection}
                  onChange={(event) => changeSection(event.target.value)}
                >
                  {items.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>
              {/* desktop tabs */}
              <div className='hidden sm:block overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'>
                <div className='border-b border-gray-300 dark:border-gray-600'>
                  <nav className='-mb-px flex space-x-8' aria-label='Tabs'>
                    {items.map((item: any) => (
                      <a
                        key={item.name}
                        onClick={() => changeSection(item.name)}
                        className={classNames(
                          item.name === currentSection
                            ? 'border-primary dark:border-primaryDark text-primary dark:text-primaryDark'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600',
                          'cursor-pointer whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                        )}
                        aria-current={item.current ? 'page' : undefined}
                      >
                        {t(`QueueManager.${item.name}`)}
                      </a>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
            <div>
              {currentSection === `${t('QueueManager.Dashboard')}` ? (
                <QueueManagerDashboard />
              ) : currentSection === `${t('QueueManager.Queues management')}` ? (
                <QueueManagement />
              ) : currentSection === `${t('QueueManager.Customers management')}` ? (
                <NotManagedCalls />
              ) : currentSection === `${t('QueueManager.Live')}` ? (
                <RealTimeManagement />
              ) : currentSection === `${t('QueueManager.Summary')}` ? (
                <Summary />
              ) : currentSection === `${t('QueueManager.Monitor')}` ? (
                <Monitor />
              ) : null}
            </div>
          </>
        </div>
      ) : (
        <MissingPermission />
      )}
    </>
  )
}

export default QueueManager
