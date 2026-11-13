// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode } from 'react'
import { ListboxOption } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'

export const monitorDropdownPanelClasses =
  'absolute z-10 mt-1 overflow-auto rounded-md border border-gray-200 bg-white py-1 text-base shadow-lg focus:outline-none sm:text-sm dark:border-gray-700 dark:bg-gray-950 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'

interface MonitorDropdownOptionProps {
  value: any
  isSelected: boolean
  textSize?: string
  children: ReactNode
}

export const MonitorDropdownOption: FC<MonitorDropdownOptionProps> = ({
  value,
  isSelected,
  textSize = '',
  children,
}) => (
  <ListboxOption
    value={value}
    className={`relative cursor-default select-none py-2 pl-8 pr-4 text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 dark:text-gray-200 dark:data-[focus]:bg-gray-800 dark:data-[focus]:text-gray-50 ${textSize}`}
  >
    <span className={`block truncate ${isSelected ? 'font-semibold' : 'font-normal'}`}>
      {children}
    </span>
    {isSelected && (
      <span className='absolute inset-y-0 left-0 flex items-center pl-1.5 text-primary dark:text-primaryDark'>
        <FontAwesomeIcon
          icon={faCheck}
          className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
          aria-hidden='true'
        />
      </span>
    )}
  </ListboxOption>
)

MonitorDropdownOption.displayName = 'MonitorDropdownOption'
