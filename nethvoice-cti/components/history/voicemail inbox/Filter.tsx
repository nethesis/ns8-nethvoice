// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import React from 'react'
import classNames from 'classnames'
import { TextInput } from '../../common'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect, useRef } from 'react'
import { PopoverGroup } from '@headlessui/react'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { savePreference } from '../../../lib/storage'
import {
  DEFAULT_SORT_BY,
  getFilterValues,
} from '../../../lib/history'
import { useTranslation } from 'react-i18next'
import {
  MobileFilterDrawer,
  FilterDisclosure,
  FilterPopover,
  ActiveFilters,
} from '../../common/FilterComponents'

//Filter for the sort
const sortFilter = {
  id: 'sort',
  name: 'Sort by',
  options: [
    { value: 'time%20desc', label: 'Newest' },
    { value: 'time%20asc', label: 'Oldest' },
  ],
}

export interface FilterProps extends ComponentPropsWithRef<'div'> {
  updateFilterText: Function
  updateSortFilter: Function
  filterTextValue?: string
}

export const Filter = forwardRef<HTMLButtonElement, FilterProps>(
  (
    {
      updateFilterText,
      updateSortFilter,
      filterTextValue = '',
      className,
      ...props
    }
  ) => {
    const auth = useSelector((state: RootState) => state.authentication)
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>

    const [open, setOpen] = useState(false)
    const [filterText, setFilterText] = useState('')

    //Sorting filter
    const [sortBy, setSortBy]: any = useState('time%20desc')
    function changeSortBy(event: any) {
      const newSortBy = event.target.id
      setSortBy(newSortBy)
      // update history (notify parent component)
      updateSortFilter(newSortBy)
      savePreference('historySortTypePreference', newSortBy, auth.username)
    }

    function changeFilterText(event: any) {
      const newFilterText = event.target.value
      setFilterText(newFilterText)
      // update history (notify parent component)
      updateFilterText(newFilterText)
    }

    const clearTextFilter = () => {
      setFilterText('')
      updateFilterText('')
      textFilterRef.current.focus()
    }

    //Get the selected filter from the local storage
    useEffect(() => {
      const filterValues = getFilterValues(auth.username)
      updateSortFilter(filterValues.sortBy)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      setFilterText(filterTextValue || '')
    }, [filterTextValue])

    //Clear the filter
    function clearFilters() {
      setFilterText('')
      setSortBy(DEFAULT_SORT_BY)
      savePreference('historySortTypePreference', DEFAULT_SORT_BY, auth.username)

      // notify parent component
      updateFilterText('')
      updateSortFilter(DEFAULT_SORT_BY)
    }

    const { t } = useTranslation()

    const translatedSortOptions = sortFilter.options.map((o) => ({
      ...o,
      label: t(`History.${o.label}`),
    }))

    return (
      <div className={classNames('bg-body dark:bg-bodyDark', className)} {...props}>
        <div>
          {/* Drawer filter mobile */}
          <MobileFilterDrawer open={open} setOpen={setOpen} title={t('History.Filters') || ''}>
            <form className='mt-4'>
              <FilterDisclosure
                name={t(`History.${sortFilter.name}`)}
                filterId={sortFilter.id}
                options={translatedSortOptions}
                selectedValue={sortBy}
                onChange={changeSortBy}
              />
            </form>
          </MobileFilterDrawer>

          {/* Filter pc */}
          <div className='mx-auto text-center'>
            <section aria-labelledby='filter-heading' className='pb-8'>
              <h2 id='filter-heading' className='sr-only'>
                {t('History.History filters')}
              </h2>

              <div className='flex items-center space-x-8'>
                <div className='flex items-center'>
                  <TextInput
                    placeholder={t('History.Filter messages') || ''}
                    className='max-w-lg'
                    value={filterText}
                    onChange={changeFilterText}
                    ref={textFilterRef}
                    icon={filterText.length ? faCircleXmark : undefined}
                    onIconClick={() => clearTextFilter()}
                    trailingIcon={true}
                  />
                </div>
                <div className='flex'>
                  <PopoverGroup className='hidden sm:flex sm:items-baseline sm:space-x-4'>
                    <FilterPopover
                      name={t(`History.${sortFilter.name}`)}
                      filterId={sortFilter.id}
                      options={translatedSortOptions}
                      selectedValue={sortBy}
                      onChange={changeSortBy}
                    />
                  </PopoverGroup>
                  <button
                    type='button'
                    className='inline-block text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 sm:hidden ml-4'
                    onClick={() => setOpen(true)}
                  >
                    {t('History.Filters')}
                  </button>
                </div>
              </div>

              {/* Active filters */}
              <ActiveFilters
                filters={[
                  {
                    label: t('History.Sort by'),
                    value: t(`History.${sortFilter.options.find((o) => o.value === sortBy)?.label}`) || '',
                  },
                ]}
                onReset={clearFilters}
              />
            </section>
          </div>
        </div>
      </div>
    )
  },
)

Filter.displayName = 'Filter'
