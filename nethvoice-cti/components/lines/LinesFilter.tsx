// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useRef } from 'react'
import classNames from 'classnames'
import { TextInput } from '../common'
import { Fragment, useState, useEffect } from 'react'
import {
  Dialog,
  Popover,
  Transition,
  Disclosure,
  TransitionChild,
  DialogPanel,
  DisclosureButton,
  DisclosurePanel,
  PopoverGroup,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleXmark, faXmark, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SORT_BY, getFilterValues, DEFAULT_CONFIGURATION_TYPE } from '../../lib/lines'
import { savePreference } from '../../lib/storage'
import { customScrollbarClass } from '../../lib/utils'

export interface LinesFilterProps extends ComponentPropsWithRef<'div'> {
  updateTextFilter: Function
  updateSortFilter: Function
  updateConfigurationTypeFilter: Function
}

export const LinesFilter = forwardRef<HTMLButtonElement, LinesFilterProps>(
  (
    { updateTextFilter, updateSortFilter, updateConfigurationTypeFilter, className, ...props },
    ref,
  ) => {
    const { t } = useTranslation()
    const auth = useSelector((state: RootState) => state.authentication)
    const [textFilter, setTextFilter] = useState('')
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
    const [open, setOpen] = useState(false)

    const sortFilter = {
      id: 'sort',
      name: t('Lines.Sort by'),
      options: [
        { value: 'description', label: t('Lines.Description') },
        { value: 'calledIdNum', label: t('Lines.Line number') },
      ],
    }

    const typeConfigurationFilter = {
      id: 'type',
      name: t('Lines.Configuration status'),
      options: [
        { value: 'all', label: t('Lines.All') },
        { value: 'active', label: t('Lines.Active') },
        { value: 'not_active', label: t('Lines.Not active') },
      ],
    }

    //Sorting filter
    const [sortBy, setSortBy]: any = useState('calledIdNum')

    //Sorting filter function
    function changeSortBy(event: any) {
      const newSortBy = event.target.id
      setSortBy(newSortBy)
      savePreference('phoneLinesSortBy', newSortBy, auth.username)

      //notify parent component
      updateSortFilter(newSortBy)
    }

    //Type configuration filter
    const [configurationType, setConfigurationType]: any = useState('all')

    //Configuration filter function
    function changeConfigurationType(event: any) {
      const newConfigurationType = event.target.id
      setConfigurationType(newConfigurationType)
      savePreference('phoneLinesConfigurationType', newConfigurationType, auth.username)

      //notify parent component
      updateConfigurationTypeFilter(newConfigurationType)
    }

    //Selected sort filter
    const [sortByLabel, setSortByLabel] = useState('')
    useEffect(() => {
      const found = sortFilter.options.find((option) => option.value === sortBy)

      if (found) {
        setSortByLabel(found.label)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy])

    //Selected configuration type filter
    const [configurationTypeLabel, setConfigurationTypeLabel] = useState('')
    useEffect(() => {
      const configurationFound = typeConfigurationFilter.options.find(
        (option) => option.value === configurationType,
      )

      if (configurationFound) {
        setConfigurationTypeLabel(configurationFound.label)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configurationType])

    function changeTextFilter(event: any) {
      const newTextFilter = event.target.value
      setTextFilter(newTextFilter)

      // notify parent component
      updateTextFilter(newTextFilter)
    }

    const resetFilters = () => {
      setTextFilter('')
      setSortBy(DEFAULT_SORT_BY)
      savePreference('phoneLinesSortBy', DEFAULT_SORT_BY, auth.username)
      setConfigurationType(DEFAULT_CONFIGURATION_TYPE)
      savePreference('phoneLinesConfigurationType', DEFAULT_SORT_BY, auth.username)

      // notify parent component
      updateTextFilter('')
      updateSortFilter(DEFAULT_SORT_BY)
      updateConfigurationTypeFilter(DEFAULT_CONFIGURATION_TYPE)
    }

    const clearTextFilter = () => {
      setTextFilter('')
      updateTextFilter('')
      textFilterRef.current.focus()
    }

    //Get the selected sortby filter from the local storage
    useEffect(() => {
      const filterValues = getFilterValues(auth.username)
      setSortBy(filterValues.sortBy)
      setConfigurationType(filterValues.configurationType)

      // notify parent component
      updateSortFilter(filterValues.sortBy)
      updateConfigurationTypeFilter(filterValues.configurationType)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
                  <DialogPanel
                    className={`relative ml-auto flex h-full w-full max-w-xs flex-col ${customScrollbarClass} py-4 pb-6 shadow-xl bg-white dark:bg-gray-900`}
                  >
                    <div className='flex items-center justify-between px-4'>
                      <h2 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                        {t('Common.Filters')}
                      </h2>
                      <button
                        type='button'
                        className='-mr-2 flex h-10 w-10 items-center justify-center rounded-md focus:outline-none focus:ring-2 p-2 bg-white text-gray-400 hover:bg-gray-50 focus:ring-primaryLight dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-primaryDark'
                        onClick={() => setOpen(false)}
                      >
                        <span className='sr-only'>{t('Common.Close menu')}</span>
                        <FontAwesomeIcon icon={faXmark} className='h-5 w-5' aria-hidden='true' />
                      </button>
                    </div>
                    {/* Divider */}
                    <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>

                    {/* Mobile sort by filter */}
                    <form className='mt-4 p-5'>
                      <Disclosure
                        as='div'
                        key={sortFilter.name}
                        id={`desktop-menu-${sortFilter.id}`}
                        className='relative text-left'
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
                                    className='ml-2 h-3 w-3 flex-shrink-0 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                                    aria-hidden='true'
                                  />
                                </span>
                              </DisclosureButton>
                            </h3>
                            <DisclosurePanel className='pt-6'>
                              <fieldset>
                                <div className='space-y-4'>
                                  {sortFilter.options.map((option) => (
                                    <div key={option.value} className='flex items-center'>
                                      <input
                                        id={option.value}
                                        name={`filter-${sortFilter.id}`}
                                        type='radio'
                                        defaultChecked={option.value === sortBy}
                                        onChange={changeSortBy}
                                        className={`h-4 w-4 border-gray-300 text-primary dark:text-primaryDark focus:ring-primaryLight dark:focus:ring-primaryDark ${
                                          sortBy === option.value
                                            ? 'dark:bg-primaryLight dark:text-primaryDark dark:border-gray-600'
                                            : 'dark:bg-gray-700 dark:text-white dark:border-gray-600'
                                        }`}
                                      />
                                      <label
                                        htmlFor={option.value}
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

                    <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>
                    {/* Mobile configuration type filter */}
                    <form className='mt-4 p-5'>
                      <Disclosure
                        as='div'
                        key={typeConfigurationFilter.name}
                        id={`desktop-menu-${typeConfigurationFilter.id}`}
                        className='relative text-left'
                      >
                        {({ open }) => (
                          <>
                            <h3 className='-mx-2 -my-3 flow-root'>
                              <DisclosureButton className='flex w-full items-center justify-between px-2 py-3 text-sm bg-white text-gray-400 dark:bg-gray-900 dark:text-gray-500'>
                                <span className='font-medium text-gray-900 dark:text-gray-100'>
                                  {typeConfigurationFilter.name}
                                </span>
                                <span className='ml-6 flex items-center'>
                                  <FontAwesomeIcon
                                    icon={faChevronDown}
                                    className='ml-2 h-3 w-3 flex-shrink-0 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                                    aria-hidden='true'
                                  />
                                </span>
                              </DisclosureButton>
                            </h3>
                            <DisclosurePanel className='pt-6'>
                              <fieldset>
                                <div className='space-y-4'>
                                  {typeConfigurationFilter.options.map((option) => (
                                    <div key={option.value} className='flex items-center'>
                                      <input
                                        id={option.value}
                                        name={`filter-${typeConfigurationFilter.id}`}
                                        type='radio'
                                        defaultChecked={option.value === configurationType}
                                        onChange={changeConfigurationType}
                                        className={`h-4 w-4 border-gray-300 text-primary dark:text-primaryDark focus:ring-primaryLight dark:focus:ring-primaryDark ${
                                          configurationType === option.value
                                            ? 'dark:bg-primaryLight dark:text-primaryDark dark:border-gray-600'
                                            : 'dark:bg-gray-700 dark:text-white dark:border-gray-600'
                                        }`}
                                      />
                                      <label
                                        htmlFor={option.value}
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
          {/* Filter pc  */}
          <div className='mx-auto text-center'>
            <section aria-labelledby='filter-heading' className='pb-6'>
              <h2 id='filter-heading' className='sr-only'>
                {t('Lines.Lines filters')}
              </h2>

              <div className='flex items-center'>
                <div className='flex items-center'>
                  <TextInput
                    placeholder={t('Lines.Filter lines') || ''}
                    className='max-w-sm'
                    value={textFilter}
                    onChange={changeTextFilter}
                    ref={textFilterRef}
                    icon={textFilter.length ? faCircleXmark : undefined}
                    onIconClick={() => clearTextFilter()}
                    trailingIcon={true}
                  />
                </div>

                <div className='flex ml-8'>
                  <PopoverGroup className='hidden sm:flex sm:items-baseline sm:space-x-4'>
                    {/* Sort filter */}
                    <Popover
                      as='div'
                      key={sortFilter.name}
                      id={`desktop-menu-${sortFilter.id}`}
                      className='relative inline-block text-left'
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
                        <PopoverPanel className='absolute right-0 z-10 mt-2 origin-top-right rounded-md min-w-max p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-600'>
                          <form className='space-y-4'>
                            {sortFilter.options.map((option) => (
                              <div key={option.value} className='flex items-center'>
                                <input
                                  id={option.value}
                                  name={`filter-${sortFilter.id}`}
                                  type='radio'
                                  defaultChecked={option.value === sortBy}
                                  onChange={changeSortBy}
                                  className={`h-4 w-4 border-gray-300 text-primary dark:text-primaryDark focus:ring-primaryLight dark:focus:ring-primaryDark ${
                                    sortBy === option.value
                                      ? 'dark:bg-primaryLight dark:text-primaryDark dark:border-gray-600'
                                      : 'dark:bg-gray-700 dark:text-white dark:border-gray-600'
                                  }`}
                                />
                                <label
                                  htmlFor={option.value}
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
                    {/* Configuration type filter */}
                    <Popover
                      as='div'
                      key={typeConfigurationFilter.name}
                      id={`desktop-menu-${typeConfigurationFilter.id}`}
                      className='relative inline-block text-left'
                    >
                      <div>
                        <PopoverButton className='px-3 py-2 text-sm leading-4 p-2 rounded border shadow-sm border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-primaryLight dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-primaryDark group inline-flex items-center justify-center font-medium  hover:text-gray-900 dark:hover:text-gray-100'>
                          <span>{typeConfigurationFilter.name}</span>
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
                        <PopoverPanel className='absolute right-0 z-10 mt-2 origin-top-right rounded-md min-w-max p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-600'>
                          <form className='space-y-4'>
                            {typeConfigurationFilter.options.map((option) => (
                              <div key={option.value} className='flex items-center'>
                                <input
                                  id={option.value}
                                  name={`filter-${typeConfigurationFilter.id}`}
                                  type='radio'
                                  defaultChecked={option.value === configurationType}
                                  onChange={changeConfigurationType}
                                  className={`h-4 w-4 border-gray-300 text-primary dark:text-primaryDark focus:ring-primaryLight dark:focus:ring-primaryDark ${
                                    configurationType === option.value
                                      ? 'dark:bg-primaryLight dark:text-primaryDark dark:border-gray-600'
                                      : 'dark:bg-gray-700 dark:text-white dark:border-gray-600'
                                  }`}
                                />
                                <label
                                  htmlFor={option.value}
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
                    {t('Common.Filters')}
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
                  {/* sort by */}
                  <div className='mt-0'>
                    <div className='-m-1 flex flex-wrap items-center'>
                      <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm font-medium border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-100'>
                        <span>
                          <span className='text-gray-600 dark:text-gray-300'>
                            {t('Lines.Sort by')}:
                          </span>{' '}
                          {sortByLabel}
                        </span>
                      </span>
                    </div>
                  </div>
                  {/* Configuration state */}
                  <div className='mt-0'>
                    <div className='-m-1 flex flex-wrap items-center'>
                      <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm font-medium border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-100'>
                        <span>
                          <span className='text-gray-600 dark:text-gray-300'>
                            {t('Lines.Configuration type')}:
                          </span>{' '}
                          {configurationTypeLabel}
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
  },
)

LinesFilter.displayName = 'LinesFilter'
