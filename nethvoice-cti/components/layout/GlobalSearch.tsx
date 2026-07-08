// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { ComponentProps, Fragment, useEffect, useMemo, useRef } from 'react'
import { FC, useState } from 'react'
import classNames from 'classnames'
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass,
  faAngleRight,
  faPhone,
  faSearch,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons'
import { RootState, store } from '../../store'
import { useSelector } from 'react-redux'
import { cloneDeep, debounce } from 'lodash'
import { Avatar, EmptyState, InlineNotification } from '../common'
import { getUserGroups, openShowOperatorDrawer } from '../../lib/operators'
import { getPhonebook, mapPhonebookResponse, openShowContactDrawer } from '../../lib/phonebook'
import {
  callPhoneNumber,
  isMobileDevice,
  sortByProperty,
  transferCallToExtension,
} from '../../lib/utils'
import { OperatorSummary } from '../operators/OperatorSummary'
import { ContactSummary } from '../phonebook/ContactSummary'
import { openAddToPhonebookDrawer } from '../../lib/history'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { customScrollbarClass } from '../../lib/utils'

interface GlobalSearchProps extends ComponentProps<'div'> {}

export const GlobalSearch: FC<GlobalSearchProps> = () => {
  const [query, setQuery] = useState('')
  const globalSearchStore = useSelector((state: RootState) => state.globalSearch)
  const [results, setResults]: any[] = useState([])
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const [isLoaded, setLoaded]: any[] = useState(true)
  const [phonebookError, setPhonebookError] = useState('')
  const authStore = useSelector((state: RootState) => state.authentication)
  const { username } = store.getState().user
  const allowedGroupsIds = store.select.user.allowedOperatorGroupsIds(store.getState())
  const presencePanelPermissions = store.select.user.presencePanelPermissions(store.getState())

  // Ref to track the current input value immediately without debounce
  const currentInputValue = useRef('')

  const userGroups = useMemo(() => {
    return getUserGroups(
      allowedGroupsIds,
      operatorsStore.groups,
      presencePanelPermissions?.['all_groups']?.value,
      username,
    )
  }, [allowedGroupsIds, operatorsStore.groups, presencePanelPermissions, username])
  const { t } = useTranslation()

  const searchOperators = (cleanQuery: string, cleanRegex: RegExp) => {
    store.dispatch.globalSearch.setCustomerCardsRedirect(false)
    // show only operators that are in the same groups as the user (or users that the user has permissions to see)
    const visibleOperators = Object.values(operatorsStore.operators).filter((op: any) => {
      return userGroups.some((g) => op.groups?.includes(g))
    })
    let operatorsResults = Object.values(visibleOperators).filter((op: any) => {
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
            const extensionNoSpaces = contact.extension?.replace(/\s/g, '')
            const workphoneNoSpaces = contact.workphone?.replace(/\s/g, '')
            const cellphoneNoSpaces = contact.cellphone?.replace(/\s/g, '')
            const queryNoSpaces = query.replace(/\s/g, '')

            if ([extensionNoSpaces, workphoneNoSpaces, cellphoneNoSpaces].includes(queryNoSpaces)) {
              isNumberInPhonebook = true
            }
          }
        })
      }

      if (isQueryPhoneNumber && !isNumberInPhonebook) {
        // suggest to add number to phonebook
        const addToPhonebookResult = { resultType: 'addToPhonebook', phoneNumber: query.trim() }
        phonebookResults.unshift(addToPhonebookResult)
      }
      return phonebookResults
    } catch (e) {
      console.error(e)
      setPhonebookError('Cannot retrieve phonebook contacts')
      return []
    }
  }

  const handleInputChange = (event: any) => {
    const value = event.target.value
    // Update ref immediately for Enter key handler
    currentInputValue.current = value
    // Call debounced search function
    debouncedSearch(value)
  }

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (globalSearchStore?.isRightSideTitleClicked) {
          store.dispatch.globalSearch.setRightSideTitleClicked(false)
        }
        setQuery(query)
        setResults([])
        store.dispatch.globalSearch.setOpen(false)
        store.dispatch.globalSearch.setFocused(true)
        const cleanRegex = /[^a-zA-Z0-9]/g
        const cleanQuery = query.replace(cleanRegex, '')

        if (cleanQuery.length == 0) {
          return
        }

        let results: any[] = []
        setLoaded(false)
        let isPhoneNumber = false

        // is it a phone number?
        if (/^\+?[0-9|\s]+$/.test(cleanQuery)) {
          // show "Call phone number" result
          isPhoneNumber = true
          const callPhoneNumberResult = { resultType: 'callPhoneNumber', phoneNumber: query.trim() }
          results.push(callPhoneNumberResult)
          store.dispatch.globalSearch.setOpen(true)
        }

        if (query.length > 2) {
          store.dispatch.globalSearch.setOpen(true)
          const operatorsResults = searchOperators(cleanQuery, cleanRegex)
          const phonebookResults = await searchPhonebook(query.trim(), isPhoneNumber)
          results = results.concat(operatorsResults, phonebookResults)
        }
        setResults(results)
        setLoaded(true)
      }, 400),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operatorsStore?.operators],
  )

  // Stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  const resultSelected = (result: any) => {
    if (!result) {
      return
    }

    switch (result?.resultType) {
      case 'callPhoneNumber':
        if (
          operatorsStore?.operators[authStore?.username]?.mainPresence &&
          operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
        ) {
          transferCallToExtension(result?.phoneNumber)
        } else if (
          operatorsStore?.operators[authStore?.username]?.endpoints?.mainextension?.[0]?.id !==
          result?.phoneNumber
        ) {
          callPhoneNumber(result?.phoneNumber)
        }
        break
      case 'addToPhonebook':
        openAddToPhonebookDrawer(result?.phoneNumber)
        break
      case 'operator':
        openShowOperatorDrawer(result)
        break
      case 'contact':
        openShowContactDrawer(result)
        break
      default:
        break
    }

    // close global search
    setTimeout(() => {
      store.dispatch.globalSearch.setOpen(false)
      store.dispatch.globalSearch.setFocused(false)
    }, 100)
  }

  const focusGlobalSearch = () => {
    store.dispatch.globalSearch.setFocused(true)
    const globalSearchInput: any = document.querySelector('#globalSearch input')
    if (globalSearchInput) {
      globalSearchInput.focus()
    }
  }

  // global keyborad shortcut
  useHotkeys('ctrl+shift+f', () => focusGlobalSearch(), [])

  const removeFocus = () => {
    store.dispatch.globalSearch.setFocused(false)
    store.dispatch.globalSearch.setOpen(false)
    store.dispatch.globalSearch.setRightSideTitleClicked(false)
  }

  // remove focus on globals search
  useHotkeys('esc', () => removeFocus(), [])

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        inputRef.current?.focus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <>
      {globalSearchStore?.isFocused && !globalSearchStore?.isCustomerCardsRedirect && (
        <>
          {/* Blur effect */}
          {/* If right side drawer is just been opened avoid to show blur effect */}
          <div
            className={`bg-opacity-75 dark:bg-opacity-75 fixed left-0 md:left-20 top-16 right-0 bottom-0 opacity-100 transition-opacity ${
              globalSearchStore?.isRightSideTitleClicked ? '' : 'bg-gray-500 dark:bg-gray-500'
            }`}
          />
          {/* Scrollbar */}
          <div
            className={`fixed left-0 md:left-20 top-16 right-0 bottom-0 z-50 ${customScrollbarClass}`}
          />
        </>
      )}
      <div
        id='globalSearch'
        className={classNames(
          'absolute left-[53px] md:left-0 sm:w-[70%] md:w-[75%] 2xl:w-[50vw] transform divide-y overflow-hidden transition-all rounded-lg z-[60] bg-topbar dark:bg-topbarDark divide-gray-200  dark:divide-gray-700',
          globalSearchStore?.isFocused ? 'w-[calc(100vw - 52px)]' : 'w-[50%]',
        )}
      >
        <Combobox onChange={resultSelected}>
          {({ activeOption }: any) => (
            <>
              <div className='relative flex items-center'>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className='pointer-events-none absolute left-4 h-5 w-5 text-topBarText dark:text-topBarTextDark'
                  aria-hidden='true'
                />
                <ComboboxInput
                  className='h-[63px] w-full border-0 bg-transparent pl-12 pr-4 focus:ring-0 sm:text-sm text-gray-800 dark:text-gray-100 placeholder-topBarText  dark:placeholder-topBarTextDark'
                  placeholder={t('Devices.Search or compose') + '...' || ''}
                  onChange={handleInputChange}
                  onKeyDown={(e: any) => {
                    if (!globalSearchStore?.isOpen && e.key === 'Enter') {
                      // Use the ref value instead of e.target.value to avoid race condition
                      let numberToCall = currentInputValue.current.trim().replace(/\s/g, '')
                      if (/^[\d*]+$/.test(numberToCall)) {
                        callPhoneNumber(numberToCall)
                      } else {
                        e.preventDefault()
                      }
                    }
                    // work aroud to move cursor to the end of the input or at the beginning
                    if (e.key === 'Home') {
                      e.preventDefault()
                      e?.target.setSelectionRange(0, 0)
                    } else if (e?.key === 'End') {
                      e?.preventDefault()
                      const length = e?.target?.value?.length
                      e?.target?.setSelectionRange(length, length)
                    }
                  }}
                />
              </div>

              {globalSearchStore?.isOpen && (
                <ComboboxOptions
                  as='div'
                  static
                  hold
                  className='flex divide-x border divide-gray-100 dark:divide-gray-800 dark:border-gray-700'
                >
                  <div
                    className={classNames(
                      `max-h-96 min-w-0 flex-auto scroll-py-4 ${customScrollbarClass} px-6 py-4`,
                    )}
                  >
                    <div className='-mx-2 text-sm text-gray-700 dark:text-gray-200'>
                      {/* phonebook error */}
                      {phonebookError && (
                        <InlineNotification
                          type='warning'
                          title={t('Common.Warning') || ''}
                          className='mb-4'
                        >{phonebookError}</InlineNotification>
                      )}
                      {/* skeleton */}
                      {!isLoaded &&
                        Array.from(Array(4)).map((e, index) => (
                          <ComboboxOption
                            as='div'
                            key={index}
                            value={index}
                            className={classNames(
                              'flex cursor-default select-none items-center rounded-md p-2 h-14',
                            )}
                          >
                            <div className='animate-pulse rounded-full h-8 w-8 bg-gray-300 dark:bg-gray-600'></div>
                            <div className='ml-2 animate-pulse h-3 rounded w-[40%] bg-gray-300 dark:bg-gray-600'></div>
                          </ComboboxOption>
                        ))}
                      {/* no search results */}
                      {isLoaded && !results.length && query.length > 2 && (
                        <ComboboxOption
                          as='div'
                          value={''}
                          className={classNames(
                            'flex justify-center cursor-default select-none items-center rounded-md p-2',
                          )}
                        >
                          <EmptyState
                            title={t('Phonebook.No results') || ''}
                            description={t('Devices.Try changing your search query') || ''}
                            icon={
                              <FontAwesomeIcon
                                icon={faSearch}
                                className='mx-auto h-14 w-14'
                                aria-hidden='true'
                              />
                            }
                          />
                        </ComboboxOption>
                      )}
                      {/* results */}
                      {isLoaded &&
                        !!results?.length &&
                        results.map((result: any, index: number) => (
                          <ComboboxOption as={Fragment} key={`result-${index}`} value={result}>
                            {({ active }: any) => (
                              <div
                                className={clsx(
                                  'flex select-none items-center rounded-md p-2 h-14 cursor-pointer',
                                  active &&
                                    'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
                                )}
                              >
                                {/* Call phone number */}
                                {result?.resultType === 'callPhoneNumber' && (
                                  <>
                                    <div className='w-10 text-center'>
                                      <FontAwesomeIcon
                                        icon={faPhone}
                                        className='h-4 w-4 text-gray-500 dark:text-gray-400'
                                      />
                                    </div>
                                    <span className='ml-2 flex-auto truncate'>
                                      Call {result.phoneNumber}
                                    </span>
                                  </>
                                )}

                                {/* Add to phonebook */}
                                {result?.resultType === 'addToPhonebook' && (
                                  <>
                                    <div className='w-10 text-center'>
                                      <FontAwesomeIcon
                                        icon={faUserPlus}
                                        className='h-4 w-4 text-gray-500 dark:text-gray-400'
                                      />
                                    </div>
                                    <span className='ml-2 flex-auto truncate'>
                                      Add {result.phoneNumber} to phonebook
                                    </span>
                                  </>
                                )}

                                {/* Operator */}
                                {result?.resultType === 'operator' && (
                                  <>
                                    <Avatar
                                      rounded='full'
                                      src={result?.avatarBase64}
                                      placeholderType='operator'
                                      size='base'
                                      status={result?.mainPresence}
                                      star={result?.favorite}
                                    />
                                    <span className='ml-2 flex-auto truncate'>{result?.name}</span>
                                  </>
                                )}

                                {/* Phonebook contact */}
                                {result?.resultType === 'contact' && (
                                  <>
                                    <Avatar placeholderType={result.kind} size='base' />
                                    <span className='ml-2 flex-auto truncate'>
                                      {result?.displayName?.trim() ||
                                        result?.name?.trim() ||
                                        result?.company?.trim() ||
                                        '-'}
                                    </span>
                                  </>
                                )}

                                {/* Icon when active */}
                                {active && (
                                  <FontAwesomeIcon
                                    icon={faAngleRight}
                                    className='mr-2 h-3 w-3 flex-none text-gray-400 dark:text-gray-500'
                                    aria-hidden='true'
                                  />
                                )}
                              </div>
                            )}
                          </ComboboxOption>
                        ))}
                    </div>
                  </div>
                  {/* right frame */}
                  {!isMobileDevice() &&
                    isLoaded &&
                    activeOption &&
                    activeOption.resultType &&
                    ['operator', 'contact'].includes(activeOption.resultType) && (
                      <div
                        className={`hidden h-96 w-1/2 flex-none flex-col ${customScrollbarClass} md:flex p-5`}
                      >
                        {/* operator */}
                        {activeOption.resultType === 'operator' && (
                          <OperatorSummary
                            operator={activeOption}
                            isShownFavorite={false}
                            isShownSideDrawerLink={true}
                          />
                        )}
                        {/* phonebook contact */}
                        {activeOption.resultType === 'contact' && (
                          <ContactSummary
                            contact={activeOption}
                            isShownContactMenu={false}
                            isShownSideDrawerLink={true}
                            isGlobalSearch={true}
                          />
                        )}
                      </div>
                    )}
                </ComboboxOptions>
              )}
            </>
          )}
        </Combobox>
      </div>
    </>
  )
}
