import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { t } from 'i18next'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

interface ComboboxNumberProps {
  maxNumber: number
  onSelect: (selectedNumber: number) => void
  defaultValue?: number
  missingkeyError?: boolean
}

export default function ComboboxNumber({
  maxNumber,
  onSelect,
  defaultValue,
  missingkeyError,
}: ComboboxNumberProps) {
  const [query, setQuery] = useState('')
  const [selectedNumber, setSelectedNumber] = useState<number | null>(defaultValue || null)

  useEffect(() => {
    if (defaultValue !== undefined) {
      onSelect(defaultValue)
    }
  }, [defaultValue, onSelect])

  const numbers = Array.from({ length: maxNumber }, (_, index) => index + 1)

  const filteredNumbers =
    query === ''
      ? numbers
      : numbers.filter((number) => {
          return number.toString().toLowerCase().includes(query.toLowerCase())
        })

  const test = (value: any) => {
    setSelectedNumber(value as number)
    onSelect(value as number)
  }
  return (
    <Combobox
      as='div'
      value={selectedNumber}
      onChange={(value: any) => {
        test(value)
        onSelect(value)
      }}
    >
      <div className='relative mt-2 mb-4'>
        <ComboboxInput
          className={classNames(
            missingkeyError
              ? 'border-2 rounded-lg border-rose-500'
              : 'ring-gray-300 dark:ring-gray-400',
            'w-full rounded-md border-0 bg-white dark:bg-gray-600 py-1.5 pl-3 pr-12 text-gray-900 dark:text-gray-200 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 placeholder:dark:text-gray-200',
          )}
          onChange={(event) => setQuery(event?.target?.value)}
          displayValue={(number: any) => number?.toString()}
          placeholder={`${t('Devices.Search physical phone index placeholder message', {
            maxNumber,
          })}`}
        />
        <ComboboxButton
          className={classNames(
            missingkeyError ? 'inset-y-2 mb-[1.5rem]' : 'inset-y-0',
            'absolute right-0 flex items-center rounded-r-md px-2 focus:outline-none',
          )}
        >
          <FontAwesomeIcon
            icon={faChevronDown}
            className='h-4 w-4 mr-1 flex items-center'
            aria-hidden='true'
          />
        </ComboboxButton>

        {missingkeyError && (
          <div className='text-rose-500 text-sm mt-1 ml-2'>
            {t('Devices.Number selection is required')}.
          </div>
        )}
        {filteredNumbers.length > 0 && (
          <ComboboxOptions className='absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-600 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm'>
            {filteredNumbers.map((number) => (
              <ComboboxOption
                key={number}
                value={number}
                className='relative cursor-default select-none py-2 pl-8 pr-4 data-[focus]:bg-primary data-[focus]:text-white data-[focus]:dark:text-gray-900 text-gray-900 dark:text-gray-200'
              >
                {({ selected }) => (
                  <>
                    <span className={`${selected ? 'block truncate font-semibold' : ''} `}>
                      {number}
                    </span>

                    {selected && (
                      <span className='absolute inset-y-0 left-0 flex items-center pl-1.5 data-[focus]:text-white text-emerald-600'>
                        <FontAwesomeIcon
                          icon={faCheck}
                          className='h-4 w-4 mr-3 text-primary dark:text-primaryDark flex items-center tooltip-configure-key-position-information'
                          aria-hidden='true'
                        />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        )}
      </div>
    </Combobox>
  )
}
