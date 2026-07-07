// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/* eslint-disable react-hooks/exhaustive-deps */
import { FC, useEffect, useState } from 'react'
import { SpeedDial } from './SpeedDial'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faPhone,
  faVoicemail,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { getJSONItem, loadPreference } from '../../lib/storage'
import { RootState, store } from '../../store'
import { useSelector } from 'react-redux'
import { UserLastCalls } from './UserLastCalls'
import { useTranslation } from 'react-i18next'
import { UserVoiceMail } from './UserVoiceMail'
import { isEmpty } from 'lodash'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
const activeStyles = {
  width: '.1875rem',
  height: '1.25rem',
  right: '0',
  top: '.375rem',
  borderRadius: '0rem .375rem .375rem 0rem',
  transform: 'rotate(180deg)',
  position: 'absolute',
} as React.CSSProperties

export const UserNavBar: FC = () => {
  const { t } = useTranslation()
  const username = useSelector((state: RootState) => state.user.username)
  const profile = useSelector((state: RootState) => state.user)
  const auth = useSelector((state: RootState) => state.authentication)

  const [tabReady, setTabReady] = useState<boolean>(false)

  const [tabs, setTabs] = useState<TabTypes[]>([])
  useEffect(() => {
    const savedTabPref = loadPreference('userSideBarTab', username)
    const savedTab =
      savedTabPref === undefined || savedTabPref === null ? 'speed_dial' : savedTabPref
    setTabs([
      ...(profile?.profile?.macro_permissions?.phonebook?.value
        ? [
            {
              icon: faBolt,
              name: 'speed_dial' as const,
              active: savedTab === 'speed_dial',
              label: t('NavBars.Speed dials'),
            },
          ]
        : []),
      {
        icon: faPhone,
        name: 'last_calls' as const,
        active: savedTab === 'last_calls',
        label: t('NavBars.Last calls'),
      },
      ...(!isEmpty(profile?.endpoints?.voicemail)
        ? [
            {
              icon: faVoicemail,
              name: 'voice_mails' as const,
              active: savedTab === 'voice_mails',
              label: t('NavBars.Voice mail'),
            },
          ]
        : []),
    ])
  }, [profile?.endpoints?.voicemail, profile?.profile?.macro_permissions?.phonebook?.value])

  const rightSideStatus: any = useSelector((state: RootState) => state.rightSideMenu)

  const [defaultTabSelected, setDefaultTabSelected] = useState('')

  // On first render of page get value of tab from local storage
  useEffect(() => {
    if (!rightSideStatus?.actualTab && defaultTabSelected !== '') {
      store.dispatch.rightSideMenu.toggleSideMenu({
        tabName: defaultTabSelected,
        username,
        force: rightSideStatus?.isSideMenuOpened,
      })
    }
  }, [rightSideStatus?.actualTab, defaultTabSelected])

  const [firstClickOnTab, setFirstClickOnTab] = useState(false)

  const clickedTab = (tabName: any) => {
    // avoid conflict with useEffect
    if (!firstClickOnTab) {
      setFirstClickOnTab(true)
    }

    if (defaultTabSelected === tabName) {
      // If the selected section is already open, close the navbar
      store.dispatch.rightSideMenu.toggleSideMenu({
        tabName: '',
        username,
        force: false,
      })
      setDefaultTabSelected('')
      setTabs((state) =>
        state.map((tab) => {
          tab.active = false
          return tab
        }),
      )
    } else {
      // Otherwise, change the section without closing the navbar
      setDefaultTabSelected(tabName)
      setTabs((state) =>
        state.map((tab) => {
          tab.active = tab.name === tabName
          return tab
        }),
      )
      store.dispatch.rightSideMenu.toggleSideMenu({
        tabName: tabName,
        username,
        force: true,
      })
    }
  }

  const [firstRender, setFirstRender] = useState(true)

  const userPreferences = getJSONItem(`preferences-${username}`) || {}

  const getTabValuesFromLocalStorage = (currentUsername: string) => {
    const rightSideMenuTabSelectedLocalStorage = loadPreference('userSideBarTab', currentUsername)
    return { rightSideMenuTabSelectedLocalStorage }
  }

  // Get selected user side menu selected value from the local storage
  useEffect(() => {
    const localStorageTabValues = getTabValuesFromLocalStorage(auth.username)
    const selected = localStorageTabValues?.rightSideMenuTabSelectedLocalStorage

    if (selected === '') {
      setDefaultTabSelected('')
      if (!firstClickOnTab) {
        setTabs((state) =>
          state.map((tab) => {
            tab.active = false
            return tab
          }),
        )
      }
    } else if (selected !== undefined && selected !== null && selected !== '') {
      setDefaultTabSelected(selected)
      if (!firstClickOnTab) {
        setTabs((state) =>
          state.map((tab) => {
            tab.active = tab.name === selected
            return tab
          }),
        )
      }
    } else {
      setDefaultTabSelected('speed_dial')
      if (!firstClickOnTab) {
        setTabs((state) =>
          state.map((tab) => {
            tab.active = tab.name === 'speed_dial'
            return tab
          }),
        )
      }
    }

    setTabReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  //Get the selected filter from the local storage
  useEffect(() => {
    if (firstRender && username && userPreferences) {
      setFirstRender(false)
      return
    }
    if (username && userPreferences) {
      if (userPreferences?.rightTabStatus !== undefined) {
        const tabNameFromPrefs =
          userPreferences?.userSideBarTab ?? defaultTabSelected ?? 'speed_dial'
        const forceOpen = tabNameFromPrefs === '' ? false : userPreferences?.rightTabStatus
        // Use the combined action to set both states
        store.dispatch.rightSideMenu.toggleSideMenu({
          tabName: tabNameFromPrefs,
          username,
          force: forceOpen,
        })
      }
    }
  }, [firstRender, username, userPreferences?.rightTabStatus])

  return (
    <>
      {/* The tabs content */}
      {tabReady &&
        tabs.map((tab, i) => {
          if (tab?.active && tab?.name === 'speed_dial') {
            return <SpeedDial key={i} />
          } else if (tab.active && tab.name === 'last_calls') {
            return <UserLastCalls key={i} />
          } else if (tab.active && tab.name === 'voice_mails') {
            return <UserVoiceMail key={i} />
          }
        })}
      {/* The side menu */}
      <div
        style={{ width: '3.125rem' }}
        className='border-gray-200 dark:border-gray-700 border-l bg-sidebar dark:bg-sidebarDark py-6 flex flex-col items-center gap-6 relative z-10'
      >
        {tabs.map((tab, i) => (
          <div
            key={i}
            onClick={() => clickedTab(tab?.name)}
            className={`${
              tab.active
                ? 'text-currentSidebarIconText dark:text-currentSidebarIconTextDark bg-sidebarIconBackground dark:bg-sidebarIconBackgroundDark'
                : 'text-sidebarIconText dark:text-sidebarIconTextDark dark:hover:text-currentSidebarIconTextDark hover:text-currentSidebarIconText hover:bg-sidebarIconBackground dark:hover:bg-sidebarIconBackgroundDark'
            } w-8 h-8 rounded flex justify-center items-center relative cursor-pointer`}
            data-tooltip-id={'tooltip-side-menu'}
            data-tooltip-content={tab?.label}
          >
            <FontAwesomeIcon size='lg' icon={tab.icon} />
            {tab?.active && (
              <div
                style={activeStyles}
                className='bg-currentBadgePrimary dark:bg-currentBadgePrimaryDark'
              />
            )}
          </div>
        ))}
      </div>
      <CustomThemedTooltip id='tooltip-side-menu' place='left' />
    </>
  )
}
type TabTypes = {
  icon: IconDefinition
  name: 'speed_dial' | 'last_calls' | 'voice_mails'
  active: boolean
  label: string
}
