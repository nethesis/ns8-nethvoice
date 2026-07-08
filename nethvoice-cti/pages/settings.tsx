// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette,
  faDatabase,
  faMobile,
  faUsers,
  faIdCardClip,
  faCircleUser,
  faPuzzlePiece,
  faVoicemail,
  faPhoneVolume,
  faUserShield,
  faBell,
} from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { Integrations, ClearCache } from '../components/settings'
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Queues } from '../components/settings/Queues'
import { useRouter } from 'next/router'
import { Theme } from '../components/settings/Theme'
import { MobileApp } from '../components/settings/MobileApp'
import { CustomerCards } from '../components/settings/CustomerCards'
import Profile from '../components/settings/ProfilePicture'
import Devices from '../components/settings/Devices'
import { IncomingCalls } from '../components/settings/IncomingCalls'
import { faOfficePhone } from '@nethesis/nethesis-solid-svg-icons'
import { savePreference } from '../lib/storage'
import { getSelectedSettingsPage } from '../lib/settings'
import { Voicemail } from '../components/settings/Voicemail'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { isEmpty } from 'lodash'
import { Setup2FA } from '../components/settings/2fa/Setup2FA'
import {
  Notifications,
  getAvailableNotificationSettings,
} from '../components/settings/Notifications'

interface SettingsMenuTypes {
  name: string
  icon: IconProp
  href: string
  current: boolean
  hidden?: boolean
}

interface EndpointExtension {
  type: string
  [key: string]: any
}

const Settings: NextPage = () => {
  const { t } = useTranslation()
  const authStore = useSelector((state: RootState) => state.authentication)
  const profile = useSelector((state: RootState) => state.user)
  const router = useRouter()

  const [currentSection, setCurrentSection] = useState<string>('Devices')
  const hasNotificationSettings = useMemo(
    () => getAvailableNotificationSettings(profile?.call_summary_enabled === true).length > 0,
    [profile?.call_summary_enabled],
  )

  // Determine if mobile extensions exist
  const hasMobileExtension = useMemo(() => {
    if (!profile?.endpoints?.extension) return false
    return profile.endpoints.extension.some((phone: EndpointExtension) => phone.type === 'mobile')
  }, [profile?.endpoints?.extension])

  // Create settings menu with dynamic visibility
  const settingsMenu = useMemo(() => {
    const menu: SettingsMenuTypes[] = [
      { name: 'Devices', href: '#', icon: faOfficePhone as IconProp, current: false },
      {
        name: 'Mobile App',
        href: '#',
        icon: faMobile,
        current: false,
        hidden: !hasMobileExtension,
      },
      { name: 'Customer cards', href: '#', icon: faIdCardClip, current: false },
      { name: 'Incoming calls', href: '#', icon: faPhoneVolume, current: false },
      { name: 'Notifications', href: '#', icon: faBell, current: false, hidden: !hasNotificationSettings },
      { name: 'Queues', href: '#', icon: faUsers, current: false },
      { name: 'Profile picture', href: '#', icon: faCircleUser, current: false },
      { name: 'Theme', href: '#', icon: faPalette, current: false },
      {
        name: 'Integrations',
        href: '#',
        icon: faPuzzlePiece,
        current: false,
        hidden: !profile?.lkhash,
      },
      { name: 'Cache', href: '#', icon: faDatabase, current: false },
      { name: 'Two-Factor Authentication', href: '#', icon: faUserShield, current: false },
    ]

    // Conditionally add Voicemail section
    if (!isEmpty(profile?.endpoints?.voicemail)) {
      menu.push({ name: 'Voicemail', href: '#', icon: faVoicemail, current: false })
    }

    return menu
  }, [profile?.endpoints?.voicemail, profile?.lkhash, hasMobileExtension, hasNotificationSettings])

  const [items, setItems] = useState<SettingsMenuTypes[]>(settingsMenu)

  // Update items when menu definition changes
  useEffect(() => {
    const visibleItems = settingsMenu.filter((item) => !item.hidden)
    const nextSection = visibleItems.some((item) => item.name === currentSection)
      ? currentSection
      : visibleItems[0]?.name || 'Devices'

    if (nextSection !== currentSection) {
      setCurrentSection(nextSection)
      savePreference('settingsSelectedPage', nextSection, authStore.username)
    }

    setItems(
      settingsMenu.map((item) => ({
        ...item,
        current: item.name === nextSection,
      })),
    )
  }, [settingsMenu, currentSection])

  const changeSection = (sectionName: string) => {
    setCurrentSection(sectionName)
    savePreference('settingsSelectedPage', sectionName, authStore.username)
  }

  // Load selected tab values from local storage
  useEffect(() => {
    const storedSection = getSelectedSettingsPage(authStore.username)
    if (storedSection.selectedSettingsPage) {
      setCurrentSection(storedSection.selectedSettingsPage)
    }
  }, [authStore.username])

  // Process URL parameter on first render
  useEffect(() => {
    const section = router.query.section as string
    if (section) {
      changeSection(section)
    }
  }, [router.query.section])

  // Render the component for the selected section
  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'Theme':
        return <Theme />
      case 'Queues':
        return <Queues />
      case 'Integrations':
        return <Integrations />
      case 'Cache':
        return <ClearCache />
      case 'Mobile App':
        return <MobileApp />
      case 'Customer cards':
        return <CustomerCards />
      case 'Incoming calls':
        return <IncomingCalls />
      case 'Notifications':
        return <Notifications />
      case 'Profile picture':
        return <Profile />
      case 'Devices':
        return <Devices />
      case 'Voicemail':
        return !isEmpty(profile?.endpoints?.voicemail) ? <Voicemail /> : null
      case 'Two-Factor Authentication':
        return <Setup2FA />
      default:
        return <Devices />
    }
  }

  return (
    <>
      <div>
        <div className='mx-auto'>
          <h1 className='text-2xl font-medium mb-6 text-primaryNeutral dark:text-primaryNeutralDark'>
            {t('Settings.Settings')}
          </h1>
          <div className='overflow-hidden rounded-lg bg-elevationL2Invert dark:bg-elevationL2InvertDark shadow'>
            <div className='divide-y divide-layoutDivider dark:divide-layoutDividerDark lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x'>
              {/* settings menu */}
              <aside className='py-6 lg:col-span-3'>
                <nav className='space-y-1'>
                  {items
                    .filter((item) => !item?.hidden)
                    .map((item) => (
                      <a
                        key={item?.name}
                        onClick={() => changeSection(item?.name)}
                        className={classNames(
                          item?.current
                            ? 'text-primaryNeutral dark:text-primaryNeutralDark bg-elevationL2 dark:bg-elevationL2Dark border-l-4 border-iconPrimary dark:border-iconPrimaryDark'
                            : 'text-secondaryNeutral dark:text-secondaryNeutralDark hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-50',
                          'group rounded-md flex items-center text-sm font-medium justify-start space-x-2 w-74 mx-4 h-[3rem] cursor-pointer',
                        )}
                        aria-current={item?.current ? 'page' : undefined}
                      >
                        <FontAwesomeIcon
                          icon={item.icon}
                          className={classNames(item?.current ? 'ml-3' : 'ml-4', 'h-4 w-4')}
                          aria-hidden='true'
                        />
                        <span className='truncate leading-5'>{t(`Settings.${item?.name}`)}</span>
                      </a>
                    ))}
                </nav>
              </aside>
              {/* main content */}
              <div className='lg:col-span-9'>{renderCurrentSection()}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default Settings
