// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * A multi-select combobox: selected values are shown as dismissable chips inside
 * the trigger box, with an inline search field and a dropdown of options that
 * toggles selection (NeMultiselectCombobox-style).
 *
 * @param options - The available options.
 * @param selected - The currently selected options.
 * @param onChange - Called with the next selection on toggle/remove.
 * @param placeholder - The placeholder shown when nothing is selected.
 * @param noOptionsText - The text shown when the filtered list is empty.
 * @param optionIcon - Optional icon rendered on the left of every option.
 * @param error - When true, the box uses the invalid (rose) border/ring.
 * @param disabled - Disables interaction.
 * @param searchable - Whether the inline search field is shown (default true).
 * @param removeLabel - Builds the aria-label for a chip's remove button.
 *
 */

import { FC, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-common-types'
import { customScrollbarClass } from '../../lib/utils'

export interface MultiSelectComboboxProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  noOptionsText?: string
  optionIcon?: IconDefinition
  error?: boolean
  disabled?: boolean
  searchable?: boolean
  id?: string
  removeLabel?: (option: string) => string
  className?: string
}

export const MultiSelectCombobox: FC<MultiSelectComboboxProps> = ({
  options,
  selected,
  onChange,
  placeholder = '',
  noOptionsText = '',
  optionIcon,
  error = false,
  disabled = false,
  searchable = true,
  id,
  removeLabel,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef() as React.MutableRefObject<HTMLDivElement>
  const inputRef = useRef() as React.MutableRefObject<HTMLInputElement>

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((current) => current !== option)
        : [...selected, option],
    )
  }

  const openDropdown = () => {
    if (disabled) {
      return
    }
    setIsOpen(true)
    inputRef.current?.focus()
  }

  return (
    <div className={classNames('relative', className)} ref={containerRef}>
      <div
        className={classNames(
          'relative flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-md border bg-bgInput px-3 py-1.5 pr-10 shadow-sm transition dark:bg-bgInputDark',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text',
          error
            ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500'
            : 'border-gray-300 hover:border-primaryLight focus-within:border-primaryLight focus-within:ring-1 focus-within:ring-primaryLight dark:border-gray-600 dark:hover:border-primaryDark dark:focus-within:border-primaryDark dark:focus-within:ring-primaryDark',
        )}
        onClick={openDropdown}
      >
        {selected.map((option) => (
          <span
            key={option}
            className='inline-flex w-fit items-center gap-x-1 rounded bg-gray-200 px-2.5 py-0.5 text-sm font-medium text-gray-800 dark:bg-gray-600 dark:text-gray-100'
          >
            {option}
            {!disabled && (
              <button
                type='button'
                aria-label={removeLabel ? removeLabel(option) : `Remove ${option}`}
                className='ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10'
                onClick={(event) => {
                  event.stopPropagation()
                  toggleOption(option)
                }}
              >
                <FontAwesomeIcon icon={faXmark} className='h-3 w-3' aria-hidden='true' />
              </button>
            )}
          </span>
        ))}
        {searchable ? (
          <input
            ref={inputRef}
            id={id}
            type='text'
            disabled={disabled}
            className='min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-placeHolderInputText focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-gray-100 dark:placeholder:text-placeHolderInputTextDark'
            placeholder={selected.length === 0 ? placeholder : ''}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && search === '' && selected.length > 0) {
                toggleOption(selected[selected.length - 1])
              }
            }}
          />
        ) : (
          selected.length === 0 && (
            <span className='flex-1 text-sm text-placeHolderInputText dark:text-placeHolderInputTextDark'>
              {placeholder}
            </span>
          )
        )}
        <span className='pointer-events-none absolute inset-y-0 right-3 flex items-center'>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={classNames('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
            aria-hidden='true'
          />
        </span>
      </div>
      {isOpen && (
        <div
          className={classNames(
            'absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900',
            customScrollbarClass,
          )}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = selected.includes(option)

              return (
                <button
                  key={option}
                  type='button'
                  className='flex w-full items-center gap-3 py-2 pl-3 pr-3 text-left text-sm text-secondaryNeutral transition hover:bg-gray-100 dark:text-secondaryNeutralDark dark:hover:bg-gray-800'
                  onClick={() => {
                    toggleOption(option)
                    setSearch('')
                    inputRef.current?.focus()
                  }}
                >
                  {optionIcon && (
                    <FontAwesomeIcon
                      icon={optionIcon}
                      className='h-3.5 w-3.5 shrink-0 text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
                      aria-hidden='true'
                    />
                  )}
                  <span className='truncate'>{option}</span>
                  {isSelected && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className='ml-auto h-3.5 w-3.5 shrink-0 text-iconPrimary dark:text-primaryDark'
                      aria-hidden='true'
                    />
                  )}
                </button>
              )
            })
          ) : (
            <p className='px-3 py-2 text-sm text-gray-500 dark:text-gray-400'>{noOptionsText}</p>
          )}
        </div>
      )}
    </div>
  )
}
