// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { ReactNode, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { TextInput } from '../TextInput'

interface FilterOption {
  value: string
  label: string
}

interface FilterDisclosureProps {
  /** Display name for the filter section */
  name: string
  /** Filter group id, used for radio button grouping */
  filterId: string
  /** Available options */
  options: FilterOption[]
  /** Currently selected value */
  selectedValue: string
  /** Callback when selection changes */
  onChange: (event: any) => void
  /** Optional prefix for radio button ids (e.g. 'status-') */
  idPrefix?: string
  /** Custom children to render instead of default radio buttons */
  children?: ReactNode
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

export const FilterDisclosure: React.FC<FilterDisclosureProps> = ({
  name,
  filterId,
  options,
  selectedValue,
  onChange,
  idPrefix = '',
  children,
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
    <Disclosure
      as='div'
      className='border-t border-gray-200 px-4 py-6 dark:border-gray-700'
    >
      {({ open }) => (
        <>
          <h3 className='-mx-2 -my-3 flow-root'>
            <DisclosureButton className='flex w-full items-center justify-between px-2 py-3 text-sm bg-white text-gray-400 dark:bg-gray-900 dark:text-gray-500'>
              <span className='font-medium text-gray-900 dark:text-gray-100'>{name}</span>
              <span className='ml-6 flex items-center'>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={classNames(
                    open ? '-rotate-180' : 'rotate-0',
                    'h-3 w-3 transform',
                  )}
                  aria-hidden='true'
                />
              </span>
            </DisclosureButton>
          </h3>
          <DisclosurePanel className='pt-6'>
            {children ||
              (useCustomVariant ? (
                <fieldset>
                  <legend className='sr-only'>{name}</legend>
                  <div className='space-y-4'>
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
                        className='min-w-[8rem]'
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
                            className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                          >
                            {option.label}
                          </label>
                        </div>
                      ),
                    )}
                  </div>
                </fieldset>
              ) : (
                <fieldset>
                  <legend className='sr-only'>{name}</legend>
                  <div className='space-y-4'>
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
                  </div>
                </fieldset>
              ))}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}
