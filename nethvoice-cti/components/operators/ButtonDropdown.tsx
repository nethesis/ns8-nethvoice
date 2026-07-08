// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { Fragment } from 'react'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faMobileScreenButton,
  faPhone,
  faRightLeft,
} from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { callPhoneNumber, transferCall } from '../../lib/utils'
import { callOperator } from '../../lib/operators'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

interface ButtonDropdownProps {
  operatorDevices?: any
  operator: any
  isTransfer?: boolean
}

export const ButtonDropdown: React.FC<ButtonDropdownProps> = ({
  operatorDevices,
  operator,
  isTransfer,
}) => {
  const auth = useSelector((state: RootState) => state.authentication)
  const operatorsStore = useSelector((state: RootState) => state.operators)

  const isDeviceInConversation = operator?.conversations?.some((conversation: any) => {
    const devicesToCheck = [operatorDevices?.mainExtension, operatorDevices?.cellphone].filter(
      Boolean,
    )

    return devicesToCheck.some((device) =>
      [conversation.chDest?.callerNum, conversation.chSource?.callerNum].includes(device),
    )
  })

  const isDisabled =
    !operatorDevices?.mainExtension ||
    operator?.username === auth?.username ||
    isDeviceInConversation ||
    ['busy', 'onhold'].includes(
      operator?.status ||
        operatorsStore?.operators[operator?.username]?.mainPresence === 'busy' ||
        operatorsStore?.operators[operator?.username]?.status === 'busy' ||
        operatorsStore?.operators[operator?.username]?.status === 'onhold' ||
        operatorsStore?.operators[operator?.username]?.username === auth?.username ||
        '',
    )

  return (
    <div className='inline-flex pb-5'>
      <button
        type='button'
        className={`relative inline-flex items-center px-3 py-2 ring-gray-300 text-sm font-medium leading-5 bg-primary dark:bg-primaryDark hover:bg-emerald-800 dark:hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-gray-950
          ${isTransfer ? 'rounded-md' : 'rounded-l-md'}
          `}
        onClick={() => (isTransfer ? transferCall(operator) : callOperator(operator))}
        disabled={isDisabled}
      >
        <FontAwesomeIcon icon={isTransfer ? faRightLeft : faPhone} className='mr-2 h-4 w-4' />
        <span>{t(isTransfer ? 'Operators.Transfer' : 'Operators.Call')}</span>
        {!isTransfer && (
          <span className='absolute right-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-white dark:bg-gray-950'></span>
        )}
      </button>

      {!isTransfer && (
        <Menu as='div' className='relative -ml-px block'>
          <MenuButton
            className='relative inline-flex items-center rounded-r-md px-2 py-2 bg-primary dark:bg-primaryDark hover:bg-emerald-800 dark:hover:bg-emerald-300 text-sm focus:ring-2 focus:ring-primaryRing dark:focus:ring-primaryRingDark dark:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 text-primaryButtonText dark:text-gray-950'
            disabled={isDisabled}
          >
            <span className='sr-only'>{t('Operators.Open user devices')}</span>
            <FontAwesomeIcon icon={faChevronDown} className='h-5 w-5' aria-hidden='true' />
          </MenuButton>

          <Transition
            as={Fragment}
            enter='transition ease-out duration-100'
            enterFrom='transform opacity-0 scale-95'
            enterTo='transform opacity-100 scale-100'
            leave='transition ease-in duration-75'
            leaveFrom='transform opacity-100 scale-100'
            leaveTo='transform opacity-0 scale-95'
          >
            <MenuItems className='absolute right-[-7.5rem] z-10 -mr-1 mt-2 w-56 origin-top-right bg-white shadow-lg rounded-md ring-1 ring-black ring-opacity-5 focus:outline-none'>
              <div className='py-1 flex-col overflow-hidden shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 ring-opacity-1 rounded-md dark:border-gray-700 dark:bg-gray-900'>
                {Object.entries(operatorDevices)
                  .filter(([key, value]) => value !== undefined && value !== null)
                  .map(([key, value]: [any, any]) => (
                    <MenuItem key={key}>
                      {() => (
                        <div className='py-1 px-3.5 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:dark:bg-gray-700 text-gray-700 dark:text-gray-200'>
                          {key === 'mainExtension' && (
                            <div
                              className='py-2 sm:grid sm:grid-cols-2 sm:gap-3 cursor-pointer'
                              onClick={() => callPhoneNumber(value)}
                            >
                              <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                                <div className='flex items-center text-sm text-gray-900 dark:text-gray-200'>
                                  <FontAwesomeIcon
                                    icon={faPhone}
                                    className='mr-2 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-300'
                                    aria-hidden='true'
                                  />
                                  <span className='truncate'>{value}</span>
                                </div>
                              </dd>
                            </div>
                          )}
                          {key === 'cellphone' && (
                            <div
                              className='py-2 sm:grid sm:grid-cols-2 sm:gap-3 cursor-pointer'
                              onClick={() => callPhoneNumber(value)}
                            >
                              <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0 '>
                                <div className='flex items-center text-sm text-gray-900 dark:text-gray-200'>
                                  <FontAwesomeIcon
                                    icon={faMobileScreenButton}
                                    className='mr-2 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-300'
                                    aria-hidden='true'
                                  />
                                  <span className='truncate'>{value}</span>
                                </div>
                              </dd>
                            </div>
                          )}
                        </div>
                      )}
                    </MenuItem>
                  ))}
              </div>
            </MenuItems>
          </Transition>
        </Menu>
      )}
    </div>
  )
}

ButtonDropdown.displayName = 'ButtonDropdown'
