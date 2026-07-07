// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useEffect, useMemo, useState } from 'react'
import { t } from 'i18next'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBuilding, faCircleUser } from '@fortawesome/free-solid-svg-icons'
import { cloneDeep, debounce } from 'lodash'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import classNames from 'classnames'
import { sortByProperty } from '../../lib/utils'
import { getPhonebook, mapPhonebookResponse } from '../../lib/phonebook'
import { Avatar } from '../common'

interface DeviceSectionOperatorSearchProps {
  typeSelected: string
  updateSelectedUserNumber: Function
  updateSelectedUserName: Function
  // Check if row is not empty
  defaultValue?: any
  //check if a user is a operator or a contact
  updatePhonebookContactInformation: Function
}

export const DeviceSectionOperatorSearch: FC<DeviceSectionOperatorSearchProps> = ({
  typeSelected,
  updateSelectedUserNumber,
  updateSelectedUserName,
  defaultValue,
  updatePhonebookContactInformation,
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults]: any[] = useState([])
  const [isLoaded, setLoaded]: any[] = useState(true)

  const operators: any = useSelector((state: RootState) => state.operators)

  const [selectedInformationUser, setSelectedInformationUser] = useState<any>([])

  const [phonebookError, setPhonebookError] = useState('')

  const searchPhonebook = async (query: string, isQueryPhoneNumber: boolean) => {
    setPhonebookError('')

    try {
      //remove space and slash characters
      let noSlashCharactersQuery = query.replace(/\//g, '')
      const res = await getPhonebook(1, noSlashCharactersQuery, 'all', 'name')

      let phonebookResults = mapPhonebookResponse(res).rows
      let isNumberInPhonebook = false

      if (phonebookResults.length) {
        phonebookResults.forEach((contact: any) => {
          // set result type
          contact.resultType = 'contact'
          if (isQueryPhoneNumber) {
            // check if contact has the queried number
            const extensionNoSpaces = contact?.extension?.replace(/\s/g, '')
            const workphoneNoSpaces = contact?.workphone?.replace(/\s/g, '')
            const cellphoneNoSpaces = contact?.cellphone?.replace(/\s/g, '')
            const queryNoSpaces = query.replace(/\s/g, '')

            if ([extensionNoSpaces, workphoneNoSpaces, cellphoneNoSpaces].includes(queryNoSpaces)) {
              isNumberInPhonebook = true
            }
          }
        })
      }

      return phonebookResults
    } catch (e) {
      console.error(e)
      setPhonebookError('Cannot retrieve phonebook contacts')
      return []
    }
  }

  const searchOperators = (cleanQuery: string, cleanRegex: RegExp) => {
    let operatorsResults = Object.values(operators?.operators).filter((op: any) => {
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
        let isPhoneNumber = false

        if (typeSelected === 'speed_dial') {
          // is it a phone number?
          if (/^\+?[0-9|\s]+$/.test(cleanQuery)) {
            // show "Call phone number" result
            isPhoneNumber = true
          }

          const operatorsResults = searchOperators(cleanQuery, cleanRegex)
          const phonebookResults = await searchPhonebook(query.trim(), isPhoneNumber)

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

  const [showUserList, setShowUserList] = useState(false)
  const [userFullInformation, setUserFullInformation] = useState<any>(null)

  const resultSelected = (result: any) => {
    const phoneProps = ['extension', 'cellphone', 'homephone', 'workphone']
    let selectedName = ''
    let selectNumber = ''
    let selectedContactsPhonebook = ''

    if (result?.name) {
      selectedName = result?.name
    }

    if (result) {
      const operatorId =
        result?.resultType === 'operator' ? result?.endpoints?.mainextension?.[0]?.id : ''

      const numberTypeFromId = result?.id?.split('-')?.[1]

      if (numberTypeFromId && phoneProps.includes(numberTypeFromId)) {
        selectNumber = result[numberTypeFromId] || ''
      } else {
        selectNumber =
          operatorId || phoneProps.map((prop) => result[prop]).find((value) => value) || ''
      }

      if (result?.resultType === 'contact') {
        selectedContactsPhonebook =
          result?.name?.trim() || result?.displayName?.trim() || result?.company?.trim() || '-'
      }
    }
    if (selectNumber !== '') {
      updateSelectedUserNumber(selectNumber)
    }
    let fullInformation = ''

    // check if selected user is an operator or a contact
    if (selectNumber && selectedName && result?.resultType === 'operator') {
      fullInformation = `${selectedName} (${selectNumber.toString()})`
      updatePhonebookContactInformation(false)
    } else if (selectNumber && selectedContactsPhonebook && result?.resultType === 'contact') {
      fullInformation = `${selectedContactsPhonebook}`
      updatePhonebookContactInformation(true)
      setUserFullInformation(selectedContactsPhonebook)
      updateSelectedUserName(fullInformation)
    } else if (defaultValue !== '') {
      fullInformation = defaultValue
    }

    // in case of missing name match
    if (query && result?.resultType === 'manual') {
      updateSelectedUserNumber(query)
      fullInformation = `${query.toString()}`
      updateSelectedUserName(fullInformation)
    }
    return fullInformation
  }

  return (
    <Combobox
      as='div'
      value={selectedInformationUser}
      onChange={(result) => setSelectedInformationUser(resultSelected(result))}
    >
      <div className='relative mt-2 mb-4'>
        <ComboboxInput
          className='w-full rounded-md border-0 bg-white dark:bg-gray-600 py-1.5 pl-3 pr-12 text-gray-900 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 placeholder:dark:text-gray-200'
          onChange={(e) => {
            const value = e.target.value
            setQuery(value)
            debouncedChangeQuery(e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query) {
              const manualSelection = {
                name: query,
                resultType: 'manual',
              }
              setSelectedInformationUser(resultSelected(manualSelection))
            }
          }}
          displayValue={(informationUser: any) => {
            return selectedInformationUser || query || ''
          }}
          placeholder={t('Devices.Type to search') || ''}
        />

        {query?.length > 0 && (
          <ComboboxOptions className='mt-1 w-full rounded-md bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm relative z-1000'>
            <div
              className={classNames(
                'max-h-60 min-w-0 flex-auto scroll-py-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25',
              )}
            >
              {/* {/* skeleton */}
              {!isLoaded &&
                Array.from(Array(4)).map((_, index) => (
                  <ComboboxOption
                    as='div'
                    key={index}
                    value={index}
                    className='flex select-none items-center rounded-md p-2 h-14 cursor-pointer'
                  >
                    <div className='animate-pulse rounded-full h-8 w-8 bg-gray-300 dark:bg-gray-600'></div>
                    <div className='ml-2 animate-pulse h-3 rounded w-[40%] bg-gray-300 dark:bg-gray-600'></div>
                  </ComboboxOption>
                ))}
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
                                result?.name !== '' && result?.name !== ' ' && result?.name !== null
                                  ? faCircleUser
                                  : faBuilding
                              }
                              className='h-6 w-6 text-gray-500 dark:text-gray-400'
                            />
                          </div>
                        )}
                        <div className='ml-4 flex flex-col items-start justify-center'>
                          <span className='flex items-center truncate'>
                            {result?.name || result?.displayName || result?.company || query || '-'}
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
