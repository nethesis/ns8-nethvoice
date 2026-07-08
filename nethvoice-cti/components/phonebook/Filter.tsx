// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useRef } from 'react'
import classNames from 'classnames'
import { Button, TextInput } from '../common'
import { useState, useEffect } from 'react'
import { PopoverGroup } from '@headlessui/react'
import { faCircleXmark, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MobileFilterDrawer,
  FilterDisclosure,
  FilterPopover,
  ActiveFilters,
} from '../common/FilterComponents'
import {
  DEFAULT_CONTACT_TYPE_FILTER,
  DEFAULT_VISIBILITY_FILTER,
  DEFAULT_SORT_BY,
  canCreatePhonebookContacts,
  getFilterValues,
  openCreateContactDrawer,
} from '../../lib/phonebook'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { savePreference } from '../../lib/storage'
import { useTranslation } from 'react-i18next'
import { customScrollbarClass } from '../../lib/utils'

const sortFilter = {
  id: 'sort',
  name: 'Sort by',
  options: [
    { value: 'name', label: 'Name' },
    { value: 'company', label: 'Company' },
  ],
}

const contactTypeFilter = {
  id: 'kind',
  name: 'Contact type',
  options: [
    { value: 'all', label: 'All' },
    { value: 'person', label: 'Person' },
    { value: 'company', label: 'Company' },
  ],
}

const visibilityFilter = {
  id: 'visibility',
  name: 'Visibility',
  options: [
    { value: 'all', label: 'All' },
    { value: 'public', label: 'Public' },
    { value: 'private', label: 'Private' },
    { value: 'group', label: 'Group' },
  ],
}

export interface FilterProps extends ComponentPropsWithRef<'div'> {
  updateTextFilter: Function
  updateContactTypeFilter: Function
  updateVisibilityFilter: Function
  updateSort: Function
}

export const Filter = forwardRef<HTMLButtonElement, FilterProps>(
  (
    { updateTextFilter, updateContactTypeFilter, updateVisibilityFilter, updateSort, className, ...props },
    ref,
  ) => {
    const { t } = useTranslation()
    const auth = useSelector((state: RootState) => state.authentication)
    const { profile } = useSelector((state: RootState) => state.user)
    const canCreateContact = canCreatePhonebookContacts(profile)
    const [open, setOpen] = useState(false)

    const handleCreateContantButtonMobileView = () => {
      setOpen(false)
      setTimeout(() => {
        openCreateContactDrawer()
      }, 5)
    }

    const [textFilter, setTextFilter] = useState('')
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
    function changeTextFilter(event: any) {
      const newTextFilter = event.target.value
      setTextFilter(newTextFilter)

      // update phonebook (notify parent component)
      updateTextFilter(newTextFilter)
    }

    const clearTextFilter = () => {
      setTextFilter('')
      updateTextFilter('')
      textFilterRef.current.focus()
    }

    const [contactType, setContactType] = useState('all')
    function changeContactType(event: any) {
      const newContactType = event.target.id
      setContactType(newContactType)
      savePreference('phonebookContactTypeFilter', newContactType, auth.username)

      // update phonebook (notify parent component)
      updateContactTypeFilter(newContactType)
    }

    const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY_FILTER)
    function changeVisibility(event: any) {
      const newVisibility = event.target.id
      setVisibility(newVisibility)
      savePreference('phonebookVisibilityFilter', newVisibility, auth.username)

      updateVisibilityFilter(newVisibility)
    }

    const [sortBy, setSortBy]: any = useState('name')
    function changeSortBy(event: any) {
      const newSortBy = event.target.id
      setSortBy(newSortBy)
      savePreference('phonebookSortBy', newSortBy, auth.username)

      // update phonebook (notify parent component)
      updateSort(newSortBy)
    }

    // contact type label

    const [contactTypeLabel, setContactTypeLabel] = useState('')
    useEffect(() => {
      const found = contactTypeFilter.options.find((option) => option.value === contactType)

      if (found) {
        setContactTypeLabel(found.label)
      }
    }, [contactType])

    const [visibilityLabel, setVisibilityLabel] = useState('')
    useEffect(() => {
      const found = visibilityFilter.options.find((option) => option.value === visibility)

      if (found) {
        setVisibilityLabel(found.label)
      }
    }, [visibility])
    // sort by label

    const [sortByLabel, setSortByLabel] = useState('')
    useEffect(() => {
      const found = sortFilter.options.find((option) => option.value === sortBy)

      if (found) {
        setSortByLabel(found.label)
      }
    }, [sortBy])

    // retrieve filter values from local storage

    useEffect(() => {
      const filterValues = getFilterValues(auth.username)
      setContactType(filterValues.contactType)
      setVisibility(filterValues.visibility)
      setSortBy(filterValues.sortBy)

      updateContactTypeFilter(filterValues.contactType)
      updateVisibilityFilter(filterValues.visibility)
      updateSort(filterValues.sortBy)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const resetFilters = () => {
      setTextFilter('')
      setContactType(DEFAULT_CONTACT_TYPE_FILTER)
      setVisibility(DEFAULT_VISIBILITY_FILTER)
      setSortBy(DEFAULT_SORT_BY)
      savePreference('phonebookContactTypeFilter', DEFAULT_CONTACT_TYPE_FILTER, auth.username)
      savePreference('phonebookVisibilityFilter', DEFAULT_VISIBILITY_FILTER, auth.username)
      savePreference('phonebookSortBy', DEFAULT_SORT_BY, auth.username)

      // notify parent component
      updateTextFilter('')
      updateContactTypeFilter(DEFAULT_CONTACT_TYPE_FILTER)
      updateVisibilityFilter(DEFAULT_VISIBILITY_FILTER)
      updateSort(DEFAULT_SORT_BY)
    }

    const translatedContactTypeOptions = contactTypeFilter.options.map((o) => ({
      ...o,
      label: t(`Phonebook.${o.label}`),
    }))

    const translatedVisibilityOptions = visibilityFilter.options.map((o) => ({
      ...o,
      label: t(`Phonebook.${o.label}`),
    }))

    return (
      <div className={classNames(className)} {...props}>
        <div>
          {/* Mobile filter dialog */}
          <MobileFilterDrawer open={open} setOpen={setOpen}>
            <form className='mt-4'>
              <FilterDisclosure
                name={t(`Phonebook.${contactTypeFilter.name}`)}
                filterId={contactTypeFilter.id}
                options={translatedContactTypeOptions}
                selectedValue={contactType}
                onChange={changeContactType}
              />
              <FilterDisclosure
                name={t(`Phonebook.${visibilityFilter.name}`)}
                filterId={visibilityFilter.id}
                options={translatedVisibilityOptions}
                selectedValue={visibility}
                onChange={changeVisibility}
              />
              {/* sort by filter (mobile) */}
              {/* //// sort by company is currently not implemented on CTI server */}
            </form>
          </MobileFilterDrawer>

          {/* pc view filters */}
          <div className='mx-auto text-center'>
            <section aria-labelledby='filter-heading' className='pb-8'>
              <h2 id='filter-heading' className='sr-only'>
                {t('Phonebook.Phonebook filters')}
              </h2>

              <div className='flex flex-col-reverse sm:flex-row justify-between sm:items-center'>
                {/* First container to manage text input and filter */}
                <div className='flex items-center'>
                  <div className='items-center'>
                    <TextInput
                      placeholder={t('Phonebook.Filter contacts') || ''}
                      className='max-w-sm'
                      value={textFilter}
                      onChange={changeTextFilter}
                      ref={textFilterRef}
                      icon={textFilter.length ? faCircleXmark : undefined}
                      onIconClick={() => clearTextFilter()}
                      trailingIcon={true}
                    />
                  </div>

                  <div className='flex ml-4'>
                    <PopoverGroup className='hidden sm:flex sm:items-baseline sm:space-x-4'>
                      <FilterPopover
                        name={t(`Phonebook.${contactTypeFilter.name}`)}
                        filterId={contactTypeFilter.id}
                        options={translatedContactTypeOptions}
                        selectedValue={contactType}
                        onChange={changeContactType}
                      />
                      <FilterPopover
                        name={t(`Phonebook.${visibilityFilter.name}`)}
                        filterId={visibilityFilter.id}
                        options={translatedVisibilityOptions}
                        selectedValue={visibility}
                        onChange={changeVisibility}
                      />
                      {/* sort by filter */}
                      {/* //// sort by company is currently not implemented on CTI server */}
                    </PopoverGroup>

                    <button
                      type='button'
                      className='inline-block text-sm font-medium sm:hidden text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100'
                      onClick={() => setOpen(true)}
                    >
                      {t('Common.Filters')}
                    </button>
                  </div>
                </div>
                {/* Container for add announcement button  */}
                {canCreateContact && (
                  <div className='text-left pb-6 sm:pb-0'>
                    <Button variant='primary' onClick={() => openCreateContactDrawer()}>
                      <FontAwesomeIcon icon={faUserPlus} className='mr-2 h-4 w-4' />
                      <span>{t('Phonebook.Create contact')}</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Active filters */}
              <ActiveFilters
                filters={[
                  {
                    label: t('Phonebook.Contact type'),
                    value: contactTypeLabel ? t(`Phonebook.${contactTypeLabel}`) : '',
                  },
                  {
                    label: t('Phonebook.Visibility'),
                    value: visibilityLabel ? t(`Phonebook.${visibilityLabel}`) : '',
                  },
                ]}
                onReset={resetFilters}
              />
            </section>
          </div>
        </div>
      </div>
    )
  },
)

Filter.displayName = 'Filter'
