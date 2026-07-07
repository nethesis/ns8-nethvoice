import React, { Fragment, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Popover, PopoverPanel, Transition } from '@headlessui/react'
import {
  faAngleRight,
  faArrowRight,
  faMobile,
  faVoicemail,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Dropdown, StatusDot } from '../common'
import { isEmpty } from 'lodash'
import classNames from 'classnames'
import { StatusTypes, asStatusType } from '../../types/status'

interface PresenceMenuProps {
  mainPresence: string
  profile: any
  setPresence: (presence: string) => void
  setForwardPresence: (number: string) => void
}

export const PresenceMenu: React.FC<PresenceMenuProps> = ({
  mainPresence,
  profile,
  setPresence,
  setForwardPresence,
}) => {
  const { t } = useTranslation()
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false)

  return (
    <Popover className='md:relative hover:bg-gray-200 dark:hover:bg-gray-700'>
      {() => (
        <>
          <div
            className={classNames(
              'relative text-left cursor-pointer px-5 py-2 text-sm flex items-center gap-3 w-full text-dropdownText dark:text-dropdownTextDark',
            )}
            onMouseEnter={() => setPresenceMenuOpen(true)}
            onMouseLeave={() => setPresenceMenuOpen(false)}
          >
            <StatusDot status={asStatusType(mainPresence)} className='flex mr-1' />
            <span className='text-sm font-normal'>{t('TopBar.Presence')}</span>
            <FontAwesomeIcon icon={faAngleRight} className='ml-auto h-4 w-4 flex justify-center' />
          </div>
          <Transition
            as={Fragment}
            show={presenceMenuOpen}
            enter='transition ease-out duration-200'
            enterFrom='opacity-0 translate-y-1'
            enterTo='opacity-100 translate-y-0'
            leave='transition ease-in duration-150'
            leaveFrom='opacity-100 translate-y-0'
            leaveTo='opacity-0 translate-y-1'
          >
            <PopoverPanel
              className='absolute sm:mr-[4.788rem] sm:-mt-10 right-0 z-10 w-screen max-w-xs sm:-translate-x-1/2 transform px-0.5 sm:px-1 xs:mr-[6rem]'
              onMouseEnter={() => setPresenceMenuOpen(true)}
              onMouseLeave={() => setPresenceMenuOpen(false)}
            >
              <div className='overflow-hidden shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 ring-opacity-1 rounded-md'>
                <div className='relative bg-dropdownBg dark:bg-dropdownBgDark dark:border-gray-700 py-2'>
                  <Dropdown.Item onClick={() => setPresence('online')}>
                    <div className='text-dropdownText dark:text-dropdownTextDark'>
                      <div className='flex items-center'>
                        <StatusDot status='online' className='flex mr-2' />
                        <p className='flex text-sm font-medium'>{t('TopBar.Online')}</p>
                      </div>
                      <p className='text-sm mt-2'>{t('TopBar.Make and receive phone calls')}</p>
                    </div>
                  </Dropdown.Item>

                  {/* Show call forward option if allowed */}
                  {profile.profile?.macro_permissions?.settings?.permissions?.call_forward
                    ?.value && (
                    <Dropdown.Item onClick={() => setPresence('callforward')}>
                      <div className='text-dropdownText dark:text-dropdownTextDark'>
                        <div className='flex items-center'>
                          <StatusDot status='callforward' className='flex mr-2' />
                          <p className='flex text-sm font-medium'>{t('TopBar.Call forward')}</p>
                          <FontAwesomeIcon icon={faArrowRight} className='h-4 w-4 ml-2' />
                        </div>
                        <p className='text-sm mt-2'>
                          {t('TopBar.Forward incoming calls to another phone number')}
                        </p>
                      </div>
                    </Dropdown.Item>
                  )}

                  {/* Cellphone option */}
                  {!isEmpty(profile?.endpoints?.cellphone) && (
                    <Dropdown.Item
                      onClick={() => setForwardPresence(profile?.endpoints?.cellphone[0]?.id)}
                    >
                      <div className='text-dropdownText dark:text-dropdownTextDark'>
                        <div className='flex items-center'>
                          <StatusDot status='cellphone' className='flex mr-2' />
                          <p className='flex text-sm font-medium'>{t('TopBar.Cellphone')}</p>
                          <FontAwesomeIcon icon={faMobile} className='h-4 w-4 ml-2' />
                        </div>
                        <p className='text-sm mt-2'>
                          {t('TopBar.Forward incoming calls to cellphone')}
                        </p>
                      </div>
                    </Dropdown.Item>
                  )}

                  {/* Voicemail option */}
                  {!isEmpty(profile?.endpoints?.voicemail) && (
                    <Dropdown.Item onClick={() => setPresence('voicemail')}>
                      <div className='text-dropdownText dark:text-dropdownTextDark'>
                        <div className='flex items-center'>
                          <StatusDot status='voicemail' className='flex mr-2' />
                          <p className='flex text-sm font-medium'>{t('TopBar.Voicemail')}</p>
                          <FontAwesomeIcon icon={faVoicemail} className='h-4 w-4 ml-2' />
                        </div>
                        <p className='text-sm mt-2'>{t('TopBar.Activate voicemail')}</p>
                      </div>
                    </Dropdown.Item>
                  )}

                  {/* Divider */}
                  <div className='relative py-2'>
                    <div className='absolute inset-0 flex items-center' aria-hidden='true'>
                      <div className='w-full border-t border-gray-300 dark:border-gray-700' />
                    </div>
                  </div>

                  {/* DND option */}
                  {profile.profile?.macro_permissions?.settings?.permissions?.dnd?.value && (
                    <Dropdown.Item onClick={() => setPresence('dnd')}>
                      <div className='text-dropdownText dark:text-dropdownTextDark'>
                        <div className='flex items-center'>
                          <StatusDot status='dnd' className='flex mr-2' />
                          <p className='flex text-sm font-medium'>{t('TopBar.Do not disturb')}</p>
                        </div>
                        <p className='text-sm mt-2'>{t('TopBar.Do not receive any calls')}</p>
                      </div>
                    </Dropdown.Item>
                  )}
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
