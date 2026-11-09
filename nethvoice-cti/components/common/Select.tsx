// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, Fragment, ReactNode } from 'react'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { useTheme } from '../../theme/Context'

export interface SelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  label?: ReactNode
  placeholder?: string
  helperText?: ReactNode
  invalid?: boolean
  invalidMessage?: ReactNode
  optionalLabel?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
}

export const Select: FC<SelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder,
  helperText,
  invalid = false,
  invalidMessage,
  optionalLabel,
  disabled = false,
  className,
  id,
}) => {
  const { input: inputTheme } = useTheme().theme
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div className={classNames('flex flex-col gap-2', className)}>
      {label && (
        <div className='flex items-center justify-between gap-2'>
          <span className={inputTheme.label}>{label}</span>
          {optionalLabel && (
            <span className='text-sm font-normal leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
              {optionalLabel}
            </span>
          )}
        </div>
      )}

      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {({ open }) => (
          <div className='relative'>
            <ListboxButton
              id={id}
              className={classNames(
                invalid
                  ? 'ring-rose-300 focus:ring-rose-500 dark:ring-rose-400'
                  : 'ring-gray-300 dark:ring-gray-600 focus:ring-primary dark:focus:ring-primaryDark',
                'relative min-h-9 w-full cursor-default rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-left text-base text-gray-900 shadow-sm ring-1 ring-inset transition-colors duration-200 hover:bg-gray-200/70 focus:outline-none focus:ring-2 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm sm:leading-6 dark:bg-gray-950 dark:text-gray-50 dark:hover:bg-gray-600/30',
                !selectedOption && 'text-placeHolderInputText dark:text-placeHolderInputTextDark',
              )}
            >
              <span className='block truncate'>{selectedOption?.label || placeholder}</span>
              <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                <FontAwesomeIcon icon={faChevronDown} className='h-4 w-4' aria-hidden='true' />
              </span>
            </ListboxButton>

            <Transition
              show={open}
              as={Fragment}
              leave='transition ease-in duration-100'
              leaveFrom='opacity-100'
              leaveTo='opacity-0'
            >
              <ListboxOptions className='absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-gray-500/5 focus:outline-none sm:text-sm dark:bg-gray-950'>
                {options.map((option) => (
                  <ListboxOption
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className='relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 dark:text-gray-100 data-[focus]:cursor-pointer data-[focus]:bg-gray-100 data-[focus]:text-gray-950 data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-500 data-[focus]:dark:bg-gray-800 data-[focus]:dark:text-gray-100'
                  >
                    {({ selected }) => (
                      <>
                        <div className='block truncate'>
                          <span className={classNames('truncate', selected && 'font-semibold')}>
                            {option.label}
                          </span>
                          {option.description && (
                            <span className='ml-2.5 truncate text-gray-500 dark:text-gray-400'>
                              {option.description}
                            </span>
                          )}
                        </div>
                        {selected && (
                          <span className='absolute inset-y-0 right-0 flex items-center pr-4 text-primary dark:text-primaryDark'>
                            <FontAwesomeIcon
                              icon={faCheck}
                              className='h-4 w-4 shrink-0'
                              aria-hidden='true'
                            />
                          </span>
                        )}
                      </>
                    )}
                  </ListboxOption>
                ))}
              </ListboxOptions>
            </Transition>
          </div>
        )}
      </Listbox>

      {invalid && invalidMessage && (
        <div className={classNames(inputTheme.helper.base, inputTheme.helper.color.error)}>
          {invalidMessage}
        </div>
      )}
      {helperText && (
        <p className='text-xs leading-4 text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
          {helperText}
        </p>
      )}
    </div>
  )
}

Select.displayName = 'Select'
