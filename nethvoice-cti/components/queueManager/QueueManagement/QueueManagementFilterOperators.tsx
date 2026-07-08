// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useRef } from 'react'
import classNames from 'classnames'
import { TextInput, SideDrawerCloseIcon } from '../../common'
import { Fragment, useState, useEffect } from 'react'
import { Dialog, DialogPanel, Disclosure, DisclosureButton, DisclosurePanel, Popover, PopoverButton, PopoverGroup, PopoverPanel, Transition, TransitionChild } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faCircleXmark, faXmark } from '@fortawesome/free-solid-svg-icons'
import {
  DEFAULT_SORT_BY_QUEUE_MANAGEMENT,
  DEFAULT_STATUS_FILTER_QUEUE_MANAGEMENT,
  getFilterValuesQueuesManagement,
} from '../../../lib/queueManager'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { savePreference } from '../../../lib/storage'
import { useTranslation } from 'react-i18next'
import { customScrollbarClass } from '../../../lib/utils'

export interface QueueManagementFilterOperatorsProps extends ComponentPropsWithRef<'div'> {
  updateTextFilter: Function
  updateStatusFilter: Function
  updateSort: Function
}

export const QueueManagementFilterOperators = forwardRef<
  HTMLButtonElement,
  QueueManagementFilterOperatorsProps
>(({ className, updateTextFilter, updateStatusFilter, updateSort, ...props }, ref) => {
  const { t } = useTranslation()

  const sortFilter = {
    id: 'sort',
    name: t('Operators.Sort by'),
    options: [
      { value: 'name', label: 'Name' },
      { value: 'status', label: 'Status' },
    ],
  }

  const statusFilter = {
    id: 'status',
    name: t('Operators.Status'),
    options: [
      { value: 'all', label: 'All' },
      { value: 'connected', label: 'Connected' },
      { value: 'disconnected', label: 'Disconnected' },
    ],
  }

  const auth = useSelector((state: RootState) => state.authentication)

  const [open, setOpen] = useState(false)

  const [textFilter, setTextFilter] = useState('')
  const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
  function changeTextFilter(event: any) {
    const newTextFilter = event.target.value
    setTextFilter(newTextFilter)

    // update operators (notify parent component)
    updateTextFilter(newTextFilter)
  }

  const [status, setStatus] = useState('')
  function changeStatus(event: any) {
    const newStatus = event.target.id.split('status-')[1]
    setStatus(newStatus)
    savePreference('queueManagementStatusFilter', newStatus, auth.username)

    // update operators (notify parent component)
    updateStatusFilter(newStatus)
  }

  const [sortBy, setSortBy]: any = useState('')
  function changeSortBy(event: any) {
    const newSortBy = event.target.id.split('sort-')[1]
    setSortBy(newSortBy)
    savePreference('queueManagementSortBy', newSortBy, auth.username)

    // update operators (notify parent component)
    updateSort(newSortBy)
  }

  // retrieve filter values from local storage

  useEffect(() => {
    const filterValues = getFilterValuesQueuesManagement(auth.username)
    setStatus(filterValues.status)
    setSortBy(filterValues.sortBy)

    updateStatusFilter(filterValues.status)
    updateSort(filterValues.sortBy)
  }, [])

  // status label

  const [statusLabel, setStatusLabel] = useState('')
  useEffect(() => {
    const found = statusFilter.options.find((option) => option.value === status)

    if (found) {
      setStatusLabel(found.label)
    }
  }, [status])

  // sort by label

  const [sortByLabel, setSortByLabel] = useState('')
  useEffect(() => {
    const found = sortFilter.options.find((option) => option.value === sortBy)

    if (found) {
      setSortByLabel(found.label)
    }
  }, [sortBy])

  const resetFilters = () => {
    setTextFilter('')
    setStatus(DEFAULT_STATUS_FILTER_QUEUE_MANAGEMENT)
    setSortBy(DEFAULT_SORT_BY_QUEUE_MANAGEMENT)
    savePreference(
      'queueManagementStatusFilter',
      DEFAULT_STATUS_FILTER_QUEUE_MANAGEMENT,
      auth.username,
    )
    savePreference('queueManagementSortBy', DEFAULT_SORT_BY_QUEUE_MANAGEMENT, auth.username)

    // notify parent component
    updateTextFilter('')
    updateStatusFilter(DEFAULT_STATUS_FILTER_QUEUE_MANAGEMENT)
    updateSort(DEFAULT_SORT_BY_QUEUE_MANAGEMENT)
  }

  const clearTextFilter = () => {
    setTextFilter('')
    updateTextFilter('')
    textFilterRef.current.focus()
  }

  return (
    <div className={classNames(className)} {...props}>
      <div className=''>
        {/* Mobile filter dialog */}
        <Transition show={open} as={Fragment}>
          <Dialog as='div' className='relative z-40 sm:hidden' onClose={setOpen}>
            <TransitionChild
              as={Fragment}
              enter='transition-opacity ease-linear duration-300'
              enterFrom='opacity-0'
              enterTo='opacity-100'
              leave='transition-opacity ease-linear duration-300'
              leaveFrom='opacity-100'
              leaveTo='opacity-0'
            >
              <div className='fixed inset-0 bg-black bg-opacity-25 dark:bg-black dark:bg-opacity-25' />
            </TransitionChild>

            <div className='fixed inset-0 z-40 flex'>
              <TransitionChild
                as={Fragment}
                enter='transition ease-in-out duration-300 transform'
                enterFrom='translate-x-full'
                enterTo='translate-x-0'
                leave='transition ease-in-out duration-300 transform'
                leaveFrom='translate-x-0'
                leaveTo='translate-x-full'
              >
                <DialogPanel className={`relative ml-auto flex h-full w-full max-w-xs flex-col ${customScrollbarClass} py-4 pb-6 shadow-xl bg-white dark:bg-gray-900`}>
                  <div className='flex items-center justify-between px-4'>
                    <h2 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                      Filters
                    </h2>
                    <button
                      type='button'
                      className='-mr-2 flex h-10 w-10 items-center justify-center rounded-md focus:outline-none focus:ring-2 p-2 bg-white text-gray-400 hover:bg-gray-50 focus:ring-primaryLight dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-primaryDark'
                      onClick={() => setOpen(false)}
                    >
                      <span className='sr-only'>Close menu</span>
                      <FontAwesomeIcon icon={faXmark} className='h-5 w-5' aria-hidden='true' />
                    </button>
                  </div>

                  {/* Filters (mobile) */}
                  <form className='mt-4'>
                    {/* status filter (mobile) */}
                    <Disclosure
                      as='div'
                      key={statusFilter.name}
                      className='border-t px-4 py-6 border-gray-200 dark:border-gray-700'
                    >
                      {({ open }) => (
                        <>
                          <h3 className='-mx-2 -my-3 flow-root'>
                            <DisclosureButton className='flex w-full items-center justify-between px-2 py-3 text-sm bg-white text-gray-400 dark:bg-gray-900 dark:text-gray-500'>
                              <span className='font-medium text-gray-900 dark:text-gray-100'>
                                {statusFilter.name}
                              </span>
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
                            <fieldset>
                              <legend className='sr-only'>{statusFilter.name}</legend>
                              <div className='space-y-4'>
                                {statusFilter.options.map((option) => (
                                  <div key={option.value} className='flex items-center'>
                                    <input
                                      id={`status-${option.value}`}
                                      name={`filter-${statusFilter.id}`}
                                      type='radio'
                                      defaultChecked={option.value === status}
                                      onChange={changeStatus}
                                      className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                                    />
                                    <label
                                      htmlFor={`status-${option.value}`}
                                      className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                                    >
                                      {option.label}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </fieldset>
                          </DisclosurePanel>
                        </>
                      )}
                    </Disclosure>
                    {/* sort by filter (mobile) */}
                    <Disclosure
                      as='div'
                      key={sortFilter.name}
                      className='border-t px-4 py-6 border-gray-200 dark:border-gray-700'
                    >
                      {({ open }) => (
                        <>
                          <h3 className='-mx-2 -my-3 flow-root'>
                            <DisclosureButton className='flex w-full items-center justify-between px-2 py-3 text-sm bg-white text-gray-400 dark:bg-gray-900 dark:text-gray-500'>
                              <span className='font-medium text-gray-900 dark:text-gray-100'>
                                {sortFilter.name}
                              </span>
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
                            <fieldset>
                              <legend className='sr-only'>{sortFilter.name}</legend>
                              <div className='space-y-4'>
                                {sortFilter.options.map((option) => (
                                  <div key={option.value} className='flex items-center'>
                                    <input
                                      id={`sort-${option.value}`}
                                      name={`filter-${sortFilter.id}`}
                                      type='radio'
                                      defaultChecked={option.value === sortBy}
                                      onChange={changeSortBy}
                                      className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                                    />
                                    <label
                                      htmlFor={`sort-${option.value}`}
                                      className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                                    >
                                      {option.label}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </fieldset>
                          </DisclosurePanel>
                        </>
                      )}
                    </Disclosure>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </Dialog>
        </Transition>

        <div className='mx-auto text-center'>
          <section aria-labelledby='filter-heading' className='pb-6'>
            <h2 id='filter-heading' className='sr-only'>
              Operators filters
            </h2>

            <div className='flex items-center space-x-8'>
              <div className='flex items-center'>
                <TextInput
                  placeholder={t('Operators.Filter operators') || ""}
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
                  {/* status filter */}
                  <Popover
                    as='div'
                    key={statusFilter.name}
                    id={`desktop-menu-${statusFilter.id}`}
                    className='relative inline-block text-left shrink-0'
                  >
                    <div>
                      <PopoverButton className='px-3 py-2 text-sm leading-4 p-2 rounded border shadow-sm border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-primaryLight dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-primaryDark group inline-flex items-center justify-center font-medium  hover:text-gray-900 dark:hover:text-gray-100'>
                        <span>{statusFilter.name}</span>
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
                      <PopoverPanel className='absolute right-0 z-10 mt-2 origin-top-right rounded-md min-w-max p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-700'>
                        <form className='space-y-4'>
                          {statusFilter.options.map((option) => (
                            <div key={option.value} className='flex items-center'>
                              <input
                                id={`status-${option.value}`}
                                name={`filter-${statusFilter.id}`}
                                type='radio'
                                defaultChecked={option.value === status}
                                onChange={changeStatus}
                                className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                              />
                              <label
                                htmlFor={`status-${option.value}`}
                                className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                              >
                                {option.label}
                              </label>
                            </div>
                          ))}
                        </form>
                      </PopoverPanel>
                    </Transition>
                  </Popover>

                  {/* sort by filter */}
                  <Popover
                    as='div'
                    key={sortFilter.name}
                    id={`desktop-menu-${sortFilter.id}`}
                    className='relative inline-block text-left shrink-0'
                  >
                    <div>
                      <PopoverButton className='px-3 py-2 text-sm leading-4 p-2 rounded border shadow-sm border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-primaryLight dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-primaryDark group inline-flex items-center justify-center font-medium  hover:text-gray-900 dark:hover:text-gray-100'>
                        <span>{sortFilter.name}</span>
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
                      <PopoverPanel className='absolute right-0 z-10 mt-2 origin-top-right rounded-md p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-600'>
                        <form className='space-y-4'>
                          {sortFilter.options.map((option) => (
                            <div key={option.value} className='flex items-center'>
                              <input
                                id={`sort-${option.value}`}
                                name={`filter-${sortFilter.id}`}
                                type='radio'
                                defaultChecked={option.value === sortBy}
                                onChange={changeSortBy}
                                className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                              />
                              <label
                                htmlFor={`sort-${option.value}`}
                                className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                              >
                                {option.label}
                              </label>
                            </div>
                          ))}
                        </form>
                      </PopoverPanel>
                    </Transition>
                  </Popover>
                </PopoverGroup>

                <button
                  type='button'
                  className='inline-block text-sm font-medium sm:hidden text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100'
                  onClick={() => setOpen(true)}
                >
                  Filters
                </button>
              </div>
            </div>

            {/* Active filters */}
            <div>
              <div className='mx-auto pt-3 flex flex-wrap items-center gap-y-2 gap-x-4'>
                <h3 className='text-sm font-medium text-gray-500 dark:text-gray-400 text-left sm:text-center'>
                  {t('Common.Active filters')}
                </h3>
                {/* separator */}
                <div aria-hidden='true' className='h-5 w-px block bg-gray-300 dark:bg-gray-600' />
                {/* status */}
                <div className='mt-0'>
                  <div className='-m-1 flex flex-wrap items-center'>
                    <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm font-medium border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-100'>
                      <span>
                        <span className='text-gray-600 dark:text-gray-300'>
                          {t('Phonebook.Status')}:
                        </span>{' '}
                        {statusLabel}
                      </span>
                    </span>
                  </div>
                </div>
                {/* sort by */}
                <div className='mt-0'>
                  <div className='-m-1 flex flex-wrap  items-center'>
                    <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm font-medium border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-100'>
                      <span>
                        <span className='text-gray-600 dark:text-gray-300'>
                          {t('Phonebook.Sort by')}:
                        </span>{' '}
                        {sortByLabel}
                      </span>
                    </span>
                  </div>
                </div>
                {/* separator */}
                <div
                  aria-hidden='true'
                  className='h-5 w-px sm:block bg-gray-300 dark:bg-gray-600'
                />
                {/* reset filters */}
                <div className='mt-0 text-center'>
                  <button
                    type='button'
                    onClick={() => resetFilters()}
                    className='text-sm hover:underline text-primary dark:text-primaryDark'
                  >
                    {t('Common.Reset filters')}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
})

QueueManagementFilterOperators.displayName = 'QueueManagementFilterOperators'
