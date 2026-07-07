// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { Fragment, ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'

interface FilterOption {
  value: string
  label: string
}

interface FilterPopoverProps {
  /** Display name for the filter button */
  name: string
  /** Filter group id, used for radio button grouping and desktop-menu id */
  filterId: string
  /** Available options */
  options: FilterOption[]
  /** Currently selected value */
  selectedValue: string
  /** Callback when selection changes */
  onChange: (event: any) => void
  /** Optional prefix for radio button ids (e.g. 'status-') */
  idPrefix?: string
  /** Extra class for the PopoverPanel */
  panelClassName?: string
  /** Custom children to render instead of default radio buttons */
  children?: ReactNode
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  name,
  filterId,
  options,
  selectedValue,
  onChange,
  idPrefix = '',
  panelClassName,
  children,
}) => {
  return (
    <Popover
      as='div'
      id={`desktop-menu-${filterId}`}
      className='relative inline-block text-left shrink-0'
    >
      <div>
        <PopoverButton className='px-3 py-2 text-sm leading-4 rounded border shadow-sm border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-primaryLight dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-primaryDark group inline-flex items-center justify-center font-medium hover:text-gray-900 dark:hover:text-gray-100'>
          <span>{name}</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className='ml-2 h-3 w-3 flex-shrink-0 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
            aria-hidden='true'
          />
        </PopoverButton>
      </div>

      <Transition
        as={Fragment}
        enter='transition ease-out duration-100'
        enterFrom='transform opacity-0 scale-95'
        enterTo='transform opacity-100 scale-100'
        leave='transition ease-in duration-75'
        leaveFrom='transform opacity-100 scale-100'
        leaveTo='transform opacity-0 scale-95'
      >
        <PopoverPanel
          className={
            panelClassName ||
            'absolute right-0 z-10 mt-2 origin-top-right rounded-md p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-700'
          }
        >
          {children || (
            <form className='space-y-4'>
              {options.map((option) => (
                <div key={option.value} className='flex items-center'>
                  <input
                    id={`${idPrefix}${option.value}`}
                    name={`filter-${filterId}`}
                    type='radio'
                    defaultChecked={option.value === selectedValue}
                    onChange={onChange}
                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                  />
                  <label
                    htmlFor={`${idPrefix}${option.value}`}
                    className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </form>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  )
}
