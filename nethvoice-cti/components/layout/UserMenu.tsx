import React from 'react'
import { Dropdown } from '../common'
import { faArrowRightFromBracket, faGear } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/router'
import { Divider } from '../common/Divider'
import { PresenceMenu } from './PresenceMenu'
import { DeviceMenu } from './DeviceMenu'

interface UserMenuProps {
  name: string
  mainextension: string
  mainPresence: string
  profile: any
  phoneLinkData: any[]
  operatorsStore: any
  theme: string
  mainDeviceType: string
  noMobileListDevice: any[]
  setPresence: (presence: string) => void
  setForwardPresence: (number: string) => void
  setMainDeviceId: (device: any) => void
  disconnectionFunction: () => void
}

export const UserMenu: React.FC<UserMenuProps> = ({
  name,
  mainextension,
  mainPresence,
  profile,
  phoneLinkData,
  operatorsStore,
  mainDeviceType,
  noMobileListDevice,
  setPresence,
  setForwardPresence,
  setMainDeviceId,
  disconnectionFunction,
}) => {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <>
      <div className='cursor-default'>
        <Dropdown.Header>
          <span className='block text-sm mb-1 text-dropdownText dark:text-dropdownTextDark'>
            {t('TopBar.Signed in as')}
          </span>
          <span className='text-sm font-medium flex justify-between text-dropdownText dark:text-dropdownTextDark'>
            <span className='truncate pr-2'>{name}</span>
            <span className='text-sm font-normal'>{mainextension}</span>
          </span>
        </Dropdown.Header>
      </div>

      {/* Divider */}
      <Divider paddingY='pt-2' className='pointer-events-none' />

      {/* Presence Menu */}
      <PresenceMenu
        mainPresence={mainPresence}
        profile={profile}
        setPresence={setPresence}
        setForwardPresence={setForwardPresence}
      />

      {/* Device Menu */}
      <DeviceMenu
        mainDeviceType={mainDeviceType}
        noMobileListDevice={noMobileListDevice}
        profile={profile}
        phoneLinkData={phoneLinkData}
        operatorsStore={operatorsStore}
        setMainDeviceId={setMainDeviceId}
      />

      {/* Settings redirect */}
      <Dropdown.Item
        icon={faGear as any}
        onClick={() => router.push({ pathname: '/settings', query: { section: 'Devices' } })}
      >
        <span>{t('Settings.Settings')}</span>
      </Dropdown.Item>

      {/* Divider */}
      <Divider paddingY='pt-2' className='pointer-events-none' />

      {/* Logout */}
      <Dropdown.Item icon={faArrowRightFromBracket} onClick={disconnectionFunction}>
        {t('TopBar.Sign out')}
      </Dropdown.Item>
    </>
  )
}
