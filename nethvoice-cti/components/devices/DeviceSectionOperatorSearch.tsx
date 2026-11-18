// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useEffect, useMemo, useState } from 'react'
import { t } from 'i18next'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBuilding,
  faCircleUser,
  faMagnifyingGlass,
  faPhone,
} from '@fortawesome/free-solid-svg-icons'
import { cloneDeep, debounce } from 'lodash'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import classNames from 'classnames'
import { sortByProperty } from '../../lib/utils'
import { getPhonebook, mapPhonebookResponse } from '../../lib/phonebook'
import { Avatar, EmptyState, Skeleton } from '../common'
import { useTheme } from '../../theme/Context'

interface DeviceSectionOperatorSearchProps {
  typeSelected: string
  value?: string
  label?: string
  onChange: (key: { value: string; label: string | null; isCustom: boolean }) => void
  placeholder?: string
}

const isPhoneNumberText = (text: string) => /^\+?[0-9\s]+$/.test(text.trim())

export const DeviceSectionOperatorSearch: FC<DeviceSectionOperatorSearchProps> = ({
  typeSelected,
  value,
  label,
  onChange,
  placeholder,
}) => {
  const { input: inputTheme } = useTheme().theme
  const [query, setQuery] = useState('')
  const [results, setResults]: any[] = useState([])
  const [isLoaded, setLoaded]: any[] = useState(true)

  const operators: any = useSelector((state: RootState) => state.operators)

  const [inputText, setInputText] = useState<string>(() => {
    if (label && value) {
      return `${label} (${value})`
    }
    return label || value || ''
  })

  const [phonebookError, setPhonebookError] = useState('')

  const searchPhonebook = async (query: string) => {
    setPhonebookError('')

    try {
      //remove space and slash characters
      let noSlashCharactersQuery = query.replace(/\//g, '')
      const res = await getPhonebook(1, noSlashCharactersQuery, 'all', 'displayname')

      let phonebookResults = mapPhonebookResponse(res).rows

      phonebookResults.forEach((contact: any) => {
        contact.resultType = 'contact'
      })

      return phonebookResults
    } catch (e) {
      console.error(e)
      setPhonebookError('Cannot retrieve phonebook contacts')
      return []
    }
  }

  const searchOperators = (cleanQuery: string, cleanRegex: RegExp) => {
    let operatorsResults = Object.values(operators?.operators || {}).filter((op: any) => {
      return (
        new RegExp(cleanQuery, 'i').test(op.name.replace(cleanRegex, '')) ||
        new RegExp(cleanQuery, 'i').test(op.endpoints?.mainextension?.[0]?.id)
      )
    })

    if (operatorsResults.length) {
      operatorsResults = cloneDeep(operatorsResults)

      operatorsResults.forEach((op: any) => {
        op.resultType = 'operator'
      })
    }
    operatorsResults.sort(sortByProperty('name'))
    return operatorsResults
  }

  const debouncedChangeQuery: any = useMemo(
    () =>
      debounce(async (event: any) => {
        const query = event.target.value
        setQuery(query)
        setResults([])
        const cleanRegex = /[^a-zA-Z0-9]/g
        const cleanQuery = query.replace(cleanRegex, '')

        if (cleanQuery.length === 0) {
          return
        }

        let results: any[] = []
        setLoaded(false)

        if (typeSelected === 'speed_dial') {
          const operatorsResults = searchOperators(cleanQuery, cleanRegex)
          const phonebookResults = await searchPhonebook(query.trim())

          results = results?.concat(operatorsResults, explodePhonebookResults(phonebookResults))
        } else {
          const operatorsResults = searchOperators(cleanQuery, cleanRegex)
          results = results.concat(operatorsResults)
        }

        setResults(results)
        setLoaded(true)
      }, 400),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operators?.operators, typeSelected],
  )

  const explodePhonebookResults = (results: any[]) => {
    const exploded: any[] = []

    results.forEach((result, index) => {
      if (result.cellphone) {
        exploded.push({
          ...result,
          number: result.cellphone,
          description: 'Cellphone',
          id: `${result.id || 'contact'}-cellphone-${index}`,
        })
      }

      if (result.workphone) {
        exploded.push({
          ...result,
          number: result.workphone,
          description: 'Workphone',
          id: `${result.id || 'contact'}-workphone-${index}`,
        })
      }

      if (result.homephone) {
        exploded.push({
          ...result,
          number: result.homephone,
          description: 'Homephone',
          id: `${result.id || 'contact'}-homephone-${index}`,
        })
      }

      if (!result.cellphone && !result.workphone && !result.homephone) {
        exploded.push({
          ...result,
          id: `${result.id || 'contact'}-no-phone-${index}`,
        })
      }
    })

    return exploded
  }

  // Stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedChangeQuery.cancel()
    }
  }, [debouncedChangeQuery])
  const allowsCustomNumber = typeSelected !== 'blf'

  const resultSelected = (result: any) => {
    if (!result) {
      return
    }
    const phoneProps = ['extension', 'cellphone', 'homephone', 'workphone']

    if (result.resultType === 'manual') {
      applyFreeText(query)
      return
    }

    const operatorId =
      result.resultType === 'operator' ? result?.endpoints?.mainextension?.[0]?.id : ''
    const numberTypeFromId = result?.id?.split('-')?.[1]
    const selectedNumber =
      numberTypeFromId && phoneProps.includes(numberTypeFromId)
        ? result[numberTypeFromId] || ''
        : operatorId || phoneProps.map((prop) => result[prop]).find((prop) => prop) || ''
    const contactName = result?.name?.trim() === '-' ? '' : result?.name?.trim()
    const selectedName = contactName || result?.displayName?.trim() || result?.company?.trim() || ''

    setInputText(
      selectedNumber ? `${selectedName || selectedNumber} (${selectedNumber})` : selectedName,
    )
    setQuery('')
    onChange({
      value: selectedNumber,
      label: selectedName || selectedNumber,
      isCustom: false,
    })
  }

  const applyFreeText = (text: string) => {
    const trimmedText = text.trim()
    if (trimmedText === '') {
      onChange({ value: '', label: '', isCustom: false })
      return
    }

    const nameAndNumber = trimmedText.match(/^(.*)\((\+?[0-9\s]+)\)$/)
    if (nameAndNumber) {
      onChange({
        value: nameAndNumber[2].replace(/\s/g, ''),
        label: nameAndNumber[1].trim() || null,
        isCustom: false,
      })
      return
    }

    if (allowsCustomNumber && isPhoneNumberText(trimmedText)) {
      onChange({ value: trimmedText.replace(/\s/g, ''), label: null, isCustom: true })
      return
    }

    onChange({ value: '', label: null, isCustom: false })
  }

  const canUseManualNumber =
    allowsCustomNumber && query.trim().length > 0 && isPhoneNumberText(query)
  const hasNoResults = isLoaded && query.length > 0 && results.length === 0

  return (
    <Combobox as='div' value={null} onChange={resultSelected}>
      <div className='relative'>
        <ComboboxInput
          className={classNames(
            inputTheme.base,
            inputTheme.rounded.base,
            inputTheme.size.base,
            inputTheme.colors.gray,
            inputTheme.placeholder.base,
            'pr-12',
          )}
          value={inputText}
          onChange={(e) => {
            const text = e.target.value
            setInputText(text)
            setQuery(text)
            setLoaded(text.trim().length === 0)
            applyFreeText(text)
            debouncedChangeQuery(e)
          }}
          placeholder={placeholder || t('Devices.Type to search') || ''}
        />

        {query?.length > 0 && (
          <ComboboxOptions className='absolute left-0 right-0 top-full z-50 mt-1 rounded-md bg-white dark:bg-gray-950 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-600 focus:outline-none sm:text-sm'>
            <div
              className={classNames(
                'max-h-60 min-w-0 flex-auto scroll-py-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25',
              )}
            >
              {!isLoaded &&
                Array.from(Array(4)).map((_, index) => (
                  <ComboboxOption
                    as='div'
                    key={index}
                    value={index}
                    className='flex select-none items-center rounded-md p-2 h-14 cursor-pointer'
                  >
                    <Skeleton variant='circular' width={32} height={32} />
                    <Skeleton variant='rectangular' height={12} width='40%' className='ml-2' />
                  </ComboboxOption>
                ))}
              {hasNoResults && canUseManualNumber && (
                <ComboboxOption
                  value={{ name: query, resultType: 'manual' }}
                  className='flex select-none items-center rounded-md p-2 h-14 cursor-pointer data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:dark:bg-gray-800 data-[focus]:dark:text-gray-100'
                >
                  <div className='flex items-center px-2'>
                    <FontAwesomeIcon
                      icon={faPhone}
                      className='h-6 w-6 text-gray-500 dark:text-gray-400'
                    />
                    <div className='ml-4 flex flex-col items-start justify-center'>
                      <span className='truncate'>{t('Devices.Use number', { number: query })}</span>
                      <span className='text-gray-500 text-sm truncate'>
                        {t('Devices.No matching contact')}
                      </span>
                    </div>
                  </div>
                </ComboboxOption>
              )}
              {hasNoResults && !canUseManualNumber && (
                <div className='select-none p-2'>
                  <EmptyState
                    title={t('Phonebook.No contacts found') || ''}
                    description={t('Devices.Type a number to use it directly') || ''}
                    icon={
                      <FontAwesomeIcon
                        icon={faMagnifyingGlass}
                        className='mx-auto h-8 w-8'
                        aria-hidden='true'
                      />
                    }
                  />
                </div>
              )}
              {results.map((result: any, index: number) => (
                <ComboboxOption
                  key={result.id || `${index}`}
                  value={result}
                  className='flex select-none items-center rounded-md p-2 h-14 cursor-pointer data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:dark:bg-gray-800 data-[focus]:dark:text-gray-100'
                >
                  {({ selected }) => (
                    <>
                      <div className='flex items-center px-2'>
                        {result?.resultType === 'operator' ? (
                          <Avatar
                            size='extra_small'
                            placeholderType='person'
                            src={operators?.avatars[result?.username]}
                            status={operators?.operators[result?.username]?.mainPresence}
                          />
                        ) : (
                          <div className='flex items-center text-center'>
                            <FontAwesomeIcon
                              icon={
                                result?.name !== '' &&
                                result?.name !== ' ' &&
                                result?.name !== '-' &&
                                result?.name !== null
                                  ? faCircleUser
                                  : faBuilding
                              }
                              className='h-6 w-6 text-gray-500 dark:text-gray-400'
                            />
                          </div>
                        )}
                        <div className='ml-4 flex flex-col items-start justify-center'>
                          <span className='flex items-center truncate'>
                            {(result?.name !== '-' && result?.name) ||
                              result?.displayName ||
                              result?.company ||
                              query ||
                              '-'}
                          </span>
                          <span className='text-gray-500 text-sm truncate'>
                            {result?.number || result?.endpoints?.extension[0]?.id || '-'}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </ComboboxOption>
              ))}
            </div>
          </ComboboxOptions>
        )}
      </div>
    </Combobox>
  )
}
