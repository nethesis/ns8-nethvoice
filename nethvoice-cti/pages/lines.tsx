// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { RootState, store } from '../store'
import { LinesView, AnnouncementView, RulesView } from '../components/lines'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/router'
import { savePreference } from '../lib/storage'
import { getSelectedLinesManager } from '../lib/lines'
import { Breadcrumb } from '../components/common/Breadcrumb'

interface tabsType {
  name: string
  href: string
  current: boolean
}

const Lines: NextPage = () => {
  const { t } = useTranslation()
  const [currentTab, setCurrentTab] = useState('lines')

  const auth = useSelector((state: RootState) => state.authentication)
  const router = useRouter()

  const tabs: tabsType[] = [
    { name: t('Lines.Lines management'), href: '#', current: false },
    { name: t('Lines.Ads'), href: '#', current: false },
    // { name: t('Lines.Rules'), href: '#', current: false },
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
      section = `${t('Lines.Lines management')}`
    }
    changeSection(section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRender])

  const changeSection = (sectionName: string) => {
    const currentItems = items.map((route) => {
      if (sectionName === route.name) {
        route.current = true
        setCurrentSection(sectionName)
        savePreference('linesSelectedTab', sectionName, auth.username)
      } else {
        route.current = false
      }
      return route
    })
    setItems(currentItems)
  }

  //Load selected tab values from local storage
  useEffect(() => {
    const currentSection = getSelectedLinesManager(auth.username)
    setCurrentSection(currentSection.selectedLinesTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    store.dispatch.lines.setLoaded(false)
  }, [])

  return (
    <>
      <div>
        <Breadcrumb
          previousLink={{
            path: '/applications',
            label: t('Applications.Applications'),
          }}
          currentPage={t('Applications.Phone lines and announcements')}
        />

        <h1 className='text-2xl font-semibold mb-6 text-title dark:text-titleDark'>
          {t('Applications.Phone lines and announcements')}
        </h1>
        {/* tabs */}
        <>
          <div className='mb-6'>
            {/* mobile tabs */}
            <div className='sm:hidden'>
              <label htmlFor='tabs' className='sr-only'>
                {t('Queues.Select a tab')}
              </label>
              <select
                id='tabs'
                name='tabs'
                className='block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primary dark:focus:ring-primary dark:bg-gray-900'
                defaultValue={currentSection}
                onChange={(event) => changeSection(event.target.value)}
              >
                {items.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            {/* desktop tabs */}
            <div className='hidden sm:block'>
              <div className='border-b border-gray-300 dark:border-gray-600'>
                <nav className='-mb-px flex space-x-8' aria-label='Tabs'>
                  {items.map((item: any) => (
                    <a
                      key={item.name}
                      onClick={() => changeSection(item.name)}
                      className={classNames(
                        item.name === currentSection
                          ? 'border-primary text-primary dark:text-primaryDark'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600',
                        'cursor-pointer whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                      )}
                      aria-current={item.current ? 'page' : undefined}
                    >
                      {item.name}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </div>
          <div>
            {currentSection === `${t('Lines.Lines management')}` ? (
              <LinesView />
            ) : currentSection === `${t('Lines.Ads')}` ? (
              <AnnouncementView />
            ) : currentSection === `${t('Lines.Rules')}` ? (
              <RulesView />
            ) : null}
          </div>
        </>
      </div>
    </>
  )
}

export default Lines
