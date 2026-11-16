// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { Fragment, ReactNode, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { TextInput } from '../TextInput'

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
  /** Extra class for option labels */
  optionLabelClassName?: string
  /** Render options as multi-select checkboxes instead of single-select radios */
  multiple?: boolean
  /** Currently selected values (multi-select mode) */
  selectedValues?: string[]
  /** Toggle callback for a single option value (multi-select mode) */
  onToggle?: (value: string) => void
  /** Show a search field to filter the options */
  searchable?: boolean
  /** Placeholder for the search field */
  searchPlaceholder?: string
  /** Text shown when no options match */
  noOptionsText?: string
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
  optionLabelClassName,
  multiple = false,
  selectedValues = [],
  onToggle,
  searchable = false,
  searchPlaceholder,
  noOptionsText,
}) => {
  const [search, setSearch] = useState('')
  const searchRef = useRef() as React.MutableRefObject<HTMLInputElement>

  const filteredOptions = useMemo(() => {
    if (!searchable || !search) {
      return options
    }
    const regex = /[^a-zA-Z0-9]/g
    const queryText = search.replace(regex, '')
    return options.filter((option) =>
      new RegExp(queryText, 'i').test(option.label.replace(regex, '')),
    )
  }, [options, search, searchable])

  const clearSearch = () => {
    setSearch('')
    searchRef.current?.focus()
  }

  const useCustomVariant = multiple || searchable

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
            'absolute left-0 z-10 mt-2 origin-top-left rounded-md p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-700'
          }
        >
          {children ||
            (useCustomVariant ? (
              <form className='space-y-4'>
                {searchable && (
                  <TextInput
                    placeholder={searchPlaceholder || ''}
                    value={search}
                    onChange={(e: any) => setSearch(e.target.value)}
                    autoFocus
                    ref={searchRef}
                    icon={search.length ? faCircleXmark : undefined}
                    onIconClick={clearSearch}
                    trailingIcon={true}
                    className='min-w-[10rem]'
                  />
                )}
                {!filteredOptions.length && (
                  <div className='text-sm text-gray-500 dark:text-gray-400'>
                    <span>{noOptionsText || ''}</span>
                  </div>
                )}
                {filteredOptions.map((option) =>
                  option.value.startsWith('divider') ? (
                    <div key={option.value} className='relative'>
                      <div className='absolute inset-0 flex items-center' aria-hidden='true'>
                        <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                      </div>
                      <div className='relative flex justify-center'></div>
                    </div>
                  ) : (
                    <div key={option.value} className='flex items-center'>
                      <input
                        id={`${idPrefix}${option.value}`}
                        name={`filter-${filterId}`}
                        type={multiple ? 'checkbox' : 'radio'}
                        checked={
                          multiple
                            ? selectedValues.includes(option.value)
                            : option.value === selectedValue
                        }
                        onChange={
                          multiple && onToggle ? () => onToggle(option.value) : onChange
                        }
                        className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                      />
                      <label
                        htmlFor={`${idPrefix}${option.value}`}
                        className='ml-3 block whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200'
                      >
                        {option.label}
                      </label>
                    </div>
                  ),
                )}
              </form>
            ) : (
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
                      className='ml-3 block whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200'
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </form>
            ))}
        </PopoverPanel>
      </Transition>
    </Popover>
  )
}
