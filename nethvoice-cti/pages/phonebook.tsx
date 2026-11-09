// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { Filter } from '../components/phonebook/Filter'
import { Avatar, Badge, Button, InlineNotification } from '../components/common'
import { Pagination } from '../components/common/Pagination'
import { useState, useEffect, useMemo } from 'react'
import {
  getPhonebook,
  openShowContactDrawer,
  PAGE_SIZE,
  openCreateContactDrawer,
  mapPhonebookResponse,
  getContactVisibilityKind,
  canCreatePhonebookContacts,
  DEFAULT_VISIBILITY_FILTER,
} from '../lib/phonebook'
import { RootState } from '../store'
import { useSelector } from 'react-redux'
import { debounce } from 'lodash'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPhone,
  faSuitcase,
  faAddressBook,
  faMobileScreenButton,
  faAngleRight,
  faUserGroup,
  faUserLock,
  faCirclePlus,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'
import { callPhoneNumber, transferCallToExtension } from '../lib/utils'
import { useTranslation } from 'react-i18next'
import { MissingPermission } from '../components/common/MissingPermissionsPage'
import { Table } from '../components/common/Table'

const Phonebook: NextPage = () => {
  const [isPhonebookLoaded, setPhonebookLoaded] = useState(false)
  const [phonebook, setPhonebook]: any = useState({})
  const [pageNum, setPageNum]: any = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const authStore = useSelector((state: RootState) => state.authentication)

  const { t } = useTranslation()

  const [textFilter, setTextFilter]: any = useState('')
  // incremented by the "Reset filters" button of the empty state
  const [resetFiltersTrigger, setResetFiltersTrigger] = useState(0)

  const updateTextFilter = (newTextFilter: string) => {
    setPageNum(1)
    setTextFilter(newTextFilter)
    setPhonebookLoaded(false)
  }

  const debouncedUpdateTextFilter = useMemo(() => debounce(updateTextFilter, 400), [])

  // Stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter.cancel()
    }
  }, [debouncedUpdateTextFilter])

  const [contactType, setContactType]: any = useState('')
  const updateContactTypeFilter = (newContactType: string) => {
    setPageNum(1)
    setContactType(newContactType)
    setPhonebookLoaded(false)
  }

  const [visibility, setVisibility]: any = useState(DEFAULT_VISIBILITY_FILTER)
  const updateVisibilityFilter = (newVisibility: string) => {
    setPageNum(1)
    setVisibility(newVisibility)
    setPhonebookLoaded(false)
  }

  const [sortBy, setSortBy]: any = useState('')
  const updateSort = (newSortBy: string) => {
    setSortBy(newSortBy)
    setPhonebookLoaded(false)
  }

  // retrieve phonebook
  useEffect(() => {
    async function fetchPhonebook() {
      if (!isPhonebookLoaded && contactType && visibility && sortBy) {
        try {
          setPhonebookError('')
          const res = await getPhonebook(
            pageNum,
            textFilter,
            contactType,
            sortBy,
            pageSize,
            visibility,
          )
          setPhonebook(mapPhonebookResponse(res, pageSize))
        } catch (e) {
          console.error(e)
          setPhonebookError('Cannot retrieve phonebook')
        }
        setPhonebookLoaded(true)
      }
    }
    fetchPhonebook()
  }, [isPhonebookLoaded, phonebook, pageNum, pageSize, textFilter, contactType, visibility, sortBy])

  const phonebookStore = useSelector((state: RootState) => state.phonebook)

  useEffect(() => {
    // reload phonebook
    setPhonebookLoaded(false)
  }, [phonebookStore])

  function goToPreviousPage() {
    if (pageNum > 1) {
      setPhonebookLoaded(false)
      setPageNum(pageNum - 1)
    }
  }

  function goToNextPage() {
    if (pageNum < phonebook.totalPages) {
      setPhonebookLoaded(false)
      setPageNum(pageNum + 1)
    }
  }

  const [phonebookError, setPhonebookError] = useState('')

  const { profile } = useSelector((state: RootState) => state.user)
  const canCreateContact = canCreatePhonebookContacts(profile)

  const getVisibilityIcon = (contact: any) => {
    const visibilityKind = getContactVisibilityKind(contact)

    if (visibilityKind === 'private') {
      return faUserLock
    }

    if (visibilityKind === 'group') {
      return faUserGroup
    }

    return null
  }

  const getVisibilityLabel = (contact: any) => {
    const visibilityKind = getContactVisibilityKind(contact)

    if (visibilityKind === 'private') {
      return t('Phonebook.Private')
    }

    if (visibilityKind === 'group') {
      return t('Phonebook.Group')
    }

    return ''
  }

  const columns = [
    {
      header: t('Phonebook.Full name/Company'),
      cell: (contact: any) => (
        <div className='flex items-center'>
          <div className='h-10 w-10 flex-shrink-0'>
            {contact?.kind === 'person' ? (
              <Avatar className='cursor-pointer' placeholderType='person' />
            ) : (
              <Avatar className='cursor-pointer' placeholderType='company' />
            )}
          </div>
          <div className='ml-4'>
            <div className='flex items-center gap-2 font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
              <span className='cursor-pointer hover:underline'>{contact?.displayName}</span>
              {getVisibilityIcon(contact) && (
                <FontAwesomeIcon
                  icon={getVisibilityIcon(contact)!}
                  className='h-3.5 w-3.5 text-iconIndigo dark:text-iconIndigoDark'
                  title={getVisibilityLabel(contact)}
                  aria-label={getVisibilityLabel(contact)}
                  role='img'
                />
              )}
            </div>
            {contact.extension && (
              <div className='mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400'>
                <FontAwesomeIcon
                  icon={faPhone}
                  className='mr-2 h-4 w-4 flex-shrink-0 text-secondaryNeutral dark:text-secondaryNeutralDark'
                  aria-hidden='true'
                />
                <span
                  className={`${
                    contact?.extension !==
                    operatorsStore?.operators[authStore?.username]?.endpoints?.mainextension?.[0]
                      ?.id
                      ? 'cursor-pointer hover:underline text-iconPrimary dark:text-iconPrimaryDark'
                      : 'text-secondaryNeutral dark:text-secondaryNeutralDark'
                  } truncate`}
                  onClick={(e) => {
                    e.stopPropagation()
                    operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
                      ? transferCallToExtension(contact?.extension)
                      : contact?.extension !==
                        operatorsStore?.operators[authStore?.username]?.endpoints
                          ?.mainextension?.[0]?.id
                      ? callPhoneNumber(contact?.extension)
                      : ''
                  }}
                >
                  {contact?.extension}
                </span>
              </div>
            )}
            {contact?.kind === 'person' && contact?.company && !contact?.extension && (
              <div className='mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400'>
                <FontAwesomeIcon
                  icon={faSuitcase}
                  className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                  aria-hidden='true'
                />
                <span className='truncate'>{contact?.company}</span>
              </div>
            )}
          </div>
        </div>
      ),
      className:
        'py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-100 sm:pl-6',
    },
    {
      header: t('Phonebook.Primary phone'),
      cell: (contact: any) => (
        <div>
          {contact?.workphone ? (
            <div className='mt-1 flex items-center text-sm font-normal text-iconPrimary dark:text-iconPrimaryDark'>
              <FontAwesomeIcon
                icon={faPhone}
                className='mr-2 h-4 w-4 flex-shrink-0 text-secondaryNeutral dark:text-secondaryNeutralDark'
                aria-hidden='true'
              />
              <span
                className={`${
                  contact?.workphone !==
                  operatorsStore?.operators[authStore?.username]?.endpoints?.mainextension?.[0]?.id
                    ? 'cursor-pointer hover:underline'
                    : 'text-gray-700 dark:text-gray-200'
                } truncate`}
                onClick={(e) => {
                  e.stopPropagation()
                  operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
                    ? transferCallToExtension(contact?.workphone)
                    : contact?.workphone !==
                      operatorsStore?.operators[authStore?.username]?.endpoints?.mainextension?.[0]
                        ?.id
                    ? callPhoneNumber(contact?.workphone)
                    : ''
                }}
              >
                {contact?.workphone}
              </span>
            </div>
          ) : (
            '-'
          )}
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-100',
    },
    {
      header: t('Phonebook.Mobile phone'),
      cell: (contact: any) => (
        <div>
          {contact?.cellphone ? (
            <div className='mt-1 flex items-center text-sm font-normal text-iconPrimary dark:text-iconPrimaryDark'>
              <FontAwesomeIcon
                icon={faMobileScreenButton}
                className='mr-2 h-4 w-4 flex-shrink-0 text-secondaryNeutral dark:text-secondaryNeutralDark'
                aria-hidden='true'
              />
              <span
                className='truncate cursor-pointer hover:underline'
                onClick={(e) => {
                  e.stopPropagation()
                  callPhoneNumber(contact?.cellphone)
                }}
              >
                {contact?.cellphone}
              </span>
            </div>
          ) : (
            '-'
          )}
        </div>
      ),
      className: 'px-3 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-100',
    },
    {
      header: '',
      cell: () => (
        <div className='flex items-center justify-end'>
          <FontAwesomeIcon
            icon={faAngleRight}
            className='h-4 w-4 text-secondaryNeutral dark:text-secondaryNeutralDark cursor-pointer'
            aria-hidden='true'
          />
        </div>
      ),
      className:
        'px-8 py-3.5 text-right text-sm font-semibold text-gray-700 dark:text-gray-100 sm:pr-6',
    },
  ]

  const filteredContacts =
    isPhonebookLoaded && phonebook?.rows
      ? phonebook.rows.filter(
          (contact: any) =>
            contact?.displayName !== undefined &&
            contact?.displayName !== null &&
            contact?.displayName !== '',
        )
      : []

  return (
    <>
      {profile?.macro_permissions?.phonebook?.value ? (
        <div>
          <h1 className='text-2xl font-medium mb-6 text-primaryNeutral dark:text-primaryNeutralDark'>
            {t('Phonebook.Phonebook')}
          </h1>
          <Filter
            resetTrigger={resetFiltersTrigger}
            updateTextFilter={debouncedUpdateTextFilter}
            updateContactTypeFilter={updateContactTypeFilter}
            updateVisibilityFilter={updateVisibilityFilter}
            updateSort={updateSort}
          />
          {/* phonebook error */}
          {phonebookError && (
            <InlineNotification type='error' title={phonebookError}></InlineNotification>
          )}

          {!phonebookError && (
            <div className='mx-auto'>
              <div className='flex flex-col'>
                <div className='-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8'>
                  <div className='inline-block min-w-full py-2 align-middle px-2 md:px-6 lg:px-8'>
                    <Table
                      columns={columns}
                      data={filteredContacts}
                      isLoading={!isPhonebookLoaded}
                      emptyState={
                        !textFilter?.length
                          ? {
                              // no items configured: icon, title and the create action
                              title: t('Phonebook.No contacts'),
                              icon: <FontAwesomeIcon icon={faAddressBook} aria-hidden='true' />,
                              action: canCreateContact ? (
                                <Button variant='primary' size='large' onClick={() => openCreateContactDrawer()}>
                                  <FontAwesomeIcon icon={faCirclePlus} className='mr-2 h-4 w-4' />
                                  <span>{t('Phonebook.Create contact')}</span>
                                </Button>
                              ) : undefined,
                            }
                          : {
                              title: t('Phonebook.No contacts found'),
                              description: t('Common.Try changing your search filters') || '',
                              icon: <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden='true' />,
                              action: (
                                <Button variant='ghost' size='large'
                                  onClick={() => setResetFiltersTrigger((n) => n + 1)}
                                >
                                  {t('Common.Reset filters')}
                                </Button>
                              ),
                            }
                      }
                      onRowClick={(contact) => openShowContactDrawer(contact)}
                      rowKey={(contact) => contact?.id || contact?.displayName}
                      trClassName='h-[84px]'
                      scrollable={true}
                      footer={
                        phonebook?.rows?.length > 0 ? (
                          <Pagination
                            currentPage={pageNum}
                            totalPages={phonebook?.totalPages}
                            totalItems={phonebook?.count || 0}
                            pageSize={pageSize}
                            onPreviousPage={goToPreviousPage}
                            onNextPage={goToNextPage}
                            onSelectPage={(page) => {
                              setPageNum(page)
                              setPhonebookLoaded(false)
                            }}
                            onSelectPageSize={(size) => {
                              setPageSize(size)
                              setPageNum(1)
                              setPhonebookLoaded(false)
                            }}
                            isLoading={!isPhonebookLoaded}
                            itemsName={t('Phonebook.contacts') || ''}
                            className='!mb-0 !px-6'
                          />
                        ) : undefined
                      }
                    />

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // the profile is empty on the first render: the missing permission page
        // must not flash before it arrives
        typeof profile?.macro_permissions?.phonebook?.value === 'undefined' ? (
          <></>
        ) : (
          <MissingPermission />
        )
      )}
    </>
  )
}

export default Phonebook
