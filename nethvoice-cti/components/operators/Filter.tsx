// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useMemo, useRef } from 'react'
import classNames from 'classnames'
import { TextInput } from '../common'
import { MobileFilterDrawer, FilterDisclosure, FilterPopover, ActiveFilters } from '../common/FilterComponents'
import { useState, useEffect } from 'react'
import { PopoverGroup } from '@headlessui/react'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons'
import { RadioButtonType } from '../../services/types'
import {
  DEFAULT_GROUP_FILTER,
  DEFAULT_GROUP_LAYOUT_GROUP_BY,
  DEFAULT_GROUP_LAYOUT_SORT_BY,
  DEFAULT_SORT_BY,
  DEFAULT_STATUS_FILTER,
  getFilterValues,
  getUserGroups,
} from '../../lib/operators'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../store'
import { savePreference } from '../../lib/storage'
import { useTranslation } from 'react-i18next'
import { customScrollbarClass } from '../../lib/utils'

export interface FilterProps extends ComponentPropsWithRef<'div'> {
  groups: { [key: string]: { users: string[] } }
  updateTextFilter: Function
  updateGroupFilter: Function
  updateStatusFilter: Function
  updateSort: Function
  updateGroupedSort?: any
  updateGroupedGroupBy?: any
  isGroupedLayot?: boolean
}

export const Filter = forwardRef<HTMLButtonElement, FilterProps>(
  (
    {
      groups,
      className,
      updateTextFilter,
      updateGroupFilter,
      updateStatusFilter,
      updateSort,
      updateGroupedSort,
      updateGroupedGroupBy,
      isGroupedLayot,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation()
    const allowedGroupsIds = store.select.user.allowedOperatorGroupsIds(store.getState())
    const presencePanelPermissions = store.select.user.presencePanelPermissions(store.getState())
    const { username } = store.getState().user

    const userGroups = useMemo(() => {
      return getUserGroups(
        allowedGroupsIds,
        groups,
        presencePanelPermissions?.['all_groups']?.value,
        username,
      )
    }, [allowedGroupsIds, groups, presencePanelPermissions, username])

    const sortFilter = {
      id: 'sort',
      name: t('Operators.Sort by'),
      options: [
        { value: 'favorites', label: `${t('Operators.Favorites') || ''}` },
        { value: 'extension', label: `${t('Operators.Extension') || ''}` },
        { value: 'az', label: `${t('Operators.Alphabetic A-Z') || ''}` },
        { value: 'za', label: `${t('Operators.Alphabetic Z-A') || ''}` },
      ],
    }

    const statusFilter = {
      id: 'status',
      name: t('Operators.Status'),
      options: [
        { value: 'all', label: `${t('Operators.All') || ''}` },
        { value: 'available', label: `${t('Operators.Available') || ''}` },
        { value: 'unavailable', label: `${t('Operators.Unavailable') || ''}` },
        { value: 'offline', label: `${t('Operators.Offline') || ''}` },
        { value: 'allExceptOffline', label: `${t('Operators.All except offline') || ''}` },
      ],
    }

    const groupedLayoutGroupByFilter = {
      id: 'groupedGroupBy',
      name: t('Operators.Group by'),
      options: [
        { value: 'az', label: `${t('Operators.Alphabetic A-Z') || ''}` },
        { value: 'za', label: `${t('Operators.Alphabetic Z-A') || ''}` },
        { value: 'team', label: `${t('Operators.Team') || ''}` },
        { value: 'status', label: `${t('Operators.Status') || ''}` },
      ],
    }

    const groupedLayoutSortFilter = {
      id: 'groupedSortBy',
      name: t('Operators.Sort by'),
      options: [
        { value: 'favorites', label: `${t('Operators.Favorites') || ''}` },
        { value: 'extension', label: `${t('Operators.Extension') || ''}` },
        { value: 'az', label: `${t('Operators.Alphabetic A-Z') || ''}` },
        { value: 'za', label: `${t('Operators.Alphabetic Z-A') || ''}` },
      ],
    }

    const auth = useSelector((state: RootState) => state.authentication)

    const [groupFilter, setGroupFilter] = useState({
      id: 'group',
      name: t('Operators.Group'),
      options: [] as RadioButtonType[],
    })

    // group options

    useEffect(() => {
      groupFilter.options = [
        { value: 'all', label: t('Operators.All') },
        { value: 'favorites', label: t('Operators.Favorites') },
      ]

      if (userGroups.length) {
        groupFilter.options.push({ value: 'divider1', label: '-' })
      }

      userGroups.forEach((group) => {
        groupFilter.options.push({
          value: group,
          label: group,
        })
      })

      setGroupFilter(groupFilter)
    }, [groupFilter, userGroups])

    const [open, setOpen] = useState(false)

    const [textFilter, setTextFilter] = useState('')
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
    function changeTextFilter(event: any) {
      const newTextFilter = event.target.value
      setTextFilter(newTextFilter)

      // update operators (notify parent component)
      updateTextFilter(newTextFilter)
    }

    const [group, setGroup] = useState('')
    function changeGroup(event: any) {
      const newGroup = event.target.id.split('group-')[1]
      setGroup(newGroup)
      savePreference('operatorsGroupFilter', newGroup, auth.username)

      // update operators (notify parent component)
      updateGroupFilter(newGroup)
    }

    // text filter for groups

    const [groupTextFilter, setGroupTextFilter] = useState('')
    const groupTextFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
    function changeGroupTextFilter(event: any) {
      const newGroupTextFilter = event.target.value
      setGroupTextFilter(newGroupTextFilter)
    }

    const [filteredGroups, setFilteredGroups] = useState([] as RadioButtonType[])

    useEffect(() => {
      const regex = /[^a-zA-Z0-9]/g
      const queryText = groupTextFilter.replace(regex, '')

      // filter group filter options that match
      const filtered = groupFilter.options.filter((g) =>
        new RegExp(queryText, 'i').test(g.label.replace(regex, '')),
      )
      setFilteredGroups(filtered)
    }, [groupTextFilter, groupFilter?.options])

    const [status, setStatus] = useState('')
    function changeStatus(event: any) {
      const newStatus = event.target.id.split('status-')[1]
      setStatus(newStatus)
      savePreference('operatorsStatusFilter', newStatus, auth.username)

      // update operators (notify parent component)
      updateStatusFilter(newStatus)
    }

    const [sortBy, setSortBy]: any = useState('')
    function changeSortBy(event: any) {
      const newSortBy = event.target.id.split('sort-')[1]
      setSortBy(newSortBy)
      savePreference('operatorsSortBy', newSortBy, auth.username)

      // update operators (notify parent component)
      updateSort(newSortBy)
    }

    const [groupedSortBy, setGroupedSortBy]: any = useState('')
    function changeGroupedSortBy(event: any) {
      const newGroupedSortBy = event.target.id.split('sort-')[1]
      setGroupedSortBy(newGroupedSortBy)

      savePreference('operatorsGroupLayoutSortBy', newGroupedSortBy, auth.username)

      // update operators (notify parent component)
      updateGroupedSort(newGroupedSortBy)
    }

    const [groupedGroupBy, setGroupedGroupBy]: any = useState('')
    function changeGroupedGroupBy(event: any) {
      const newGroupedGroupBy = event.target.id.split('group-')[1]
      setGroupedGroupBy(newGroupedGroupBy)
      savePreference('operatorsGroupLayoutGroupBy', newGroupedGroupBy, auth.username)

      // update operators (notify parent component)
      updateGroupedGroupBy(newGroupedGroupBy)
    }

    // retrieve filter values from local storage
    useEffect(() => {
      const filterValues = getFilterValues(auth.username)
      setGroup(filterValues.group)
      setStatus(filterValues.status)
      setSortBy(filterValues.sortBy)
      setGroupedSortBy(filterValues.groupLayoutSortBy)
      setGroupedGroupBy(filterValues.groupLayoutGroupBy)

      updateGroupFilter(filterValues.group)
      updateStatusFilter(filterValues.status)
      updateSort(filterValues.sortBy)
      updateGroupedSort(filterValues.groupLayoutSortBy)
      updateGroupedGroupBy(filterValues.groupLayoutGroupBy)
    }, [])

    // group label

    const [groupLabel, setGroupLabel] = useState('')
    useEffect(() => {
      const found = groupFilter.options.find((option) => option.value === group)

      if (found) {
        setGroupLabel(found.label)
      }
    }, [group, groupFilter.options])

    // grouped layout group by label

    const [layoutGroupedGroupLabel, setLayoutGroupedGroupLabel] = useState('')

    useEffect(() => {
      const found = groupedLayoutGroupByFilter?.options.find(
        (option) => option?.value === groupedGroupBy,
      )

      if (found) {
        setLayoutGroupedGroupLabel(found?.label)
      }
    }, [groupedGroupBy, groupedLayoutGroupByFilter?.options])

    // status label

    const [statusLabel, setStatusLabel] = useState('')
    useEffect(() => {
      const found = statusFilter.options.find((option) => option.value === status)

      if (found) {
        setStatusLabel(found.label)
      }
    }, [status])

    const [layoutGroupedSortLabel, setLayoutGroupedSortLabel] = useState('')

    useEffect(() => {
      const found = groupedLayoutSortFilter?.options.find(
        (option) => option?.value === groupedSortBy,
      )

      if (found) {
        setLayoutGroupedSortLabel(found?.label)
      }
    }, [groupedSortBy, groupedLayoutSortFilter?.options])

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
      setGroup(DEFAULT_GROUP_FILTER)
      setStatus(DEFAULT_STATUS_FILTER)
      setSortBy(DEFAULT_SORT_BY)

      // grouped layout
      setGroupedSortBy(DEFAULT_GROUP_LAYOUT_SORT_BY)
      setGroupedGroupBy(DEFAULT_GROUP_LAYOUT_GROUP_BY)

      savePreference('operatorsGroupFilter', DEFAULT_GROUP_FILTER, auth.username)
      savePreference('operatorsStatusFilter', DEFAULT_STATUS_FILTER, auth.username)
      savePreference('operatorsSortBy', DEFAULT_SORT_BY, auth.username)

      // grouped layout
      savePreference('operatorsGroupLayoutSortBy', DEFAULT_GROUP_LAYOUT_SORT_BY, auth.username)
      savePreference('operatorsGroupLayoutGroupBy', DEFAULT_GROUP_LAYOUT_GROUP_BY, auth.username)

      // notify parent component
      updateTextFilter('')
      updateGroupFilter(DEFAULT_GROUP_FILTER)
      updateStatusFilter(DEFAULT_STATUS_FILTER)
      updateSort(DEFAULT_SORT_BY)

      // grouped layout
      updateGroupedSort(DEFAULT_GROUP_LAYOUT_SORT_BY)
      updateGroupedGroupBy(DEFAULT_GROUP_LAYOUT_GROUP_BY)
    }

    const clearTextFilter = () => {
      setTextFilter('')
      updateTextFilter('')
      textFilterRef.current.focus()
    }

    const clearGroupTextFilter = () => {
      setGroupTextFilter('')
      groupTextFilterRef.current.focus()
    }

    return (
      <div className={classNames(className)}>
        {!isGroupedLayot ? (
          <div className=''>
            {/* Mobile filter dialog */}
            <MobileFilterDrawer
              open={open}
              setOpen={setOpen}
              panelClassName={`relative ml-auto flex h-full w-full max-w-xs flex-col ${customScrollbarClass} py-4 pb-6 shadow-xl bg-white dark:bg-gray-900`}
            >
              {/* Filters (mobile) */}
              <form className='mt-4'>
                {/* group filter (mobile) */}
                <FilterDisclosure
                  name={groupFilter.name}
                  filterId={groupFilter.id}
                  options={[]}
                  selectedValue=''
                  onChange={() => {}}
                >
                  <fieldset>
                    <legend className='sr-only'>{groupFilter.name}</legend>
                    <div className='space-y-4'>
                      <TextInput
                        placeholder={t('Operators.Filter groups') || ''}
                        value={groupTextFilter}
                        onChange={changeGroupTextFilter}
                        autoFocus
                        ref={groupTextFilterRef}
                        icon={groupTextFilter.length ? faCircleXmark : undefined}
                        onIconClick={() => clearGroupTextFilter()}
                        trailingIcon={true}
                        className='min-w-[8rem]'
                      />
                      {!filteredGroups.length && (
                        <div className='text-sm text-gray-500 dark:text-gray-400'>
                          <span>No groups</span>
                        </div>
                      )}
                      {filteredGroups.map((option) => (
                        <div key={option.value}>
                          {option.value.startsWith('divider') ? (
                            <div className='relative'>
                              <div
                                className='absolute inset-0 flex items-center'
                                aria-hidden='true'
                              >
                                <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                              </div>
                              <div className='relative flex justify-center'></div>
                            </div>
                          ) : (
                            <div className='flex items-center'>
                              <input
                                id={`group-${option.value}`}
                                name={`filter-${groupFilter.id}`}
                                type='radio'
                                defaultChecked={option.value === group}
                                onChange={changeGroup}
                                className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                              />
                              <label
                                htmlFor={`group-${option.value}`}
                                className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                              >
                                {option.label}
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                </FilterDisclosure>
                {/* status filter (mobile) */}
                <FilterDisclosure
                  name={statusFilter.name}
                  filterId={statusFilter.id}
                  options={statusFilter.options}
                  selectedValue={status}
                  onChange={changeStatus}
                  idPrefix='status-'
                />
                {/* sort by filter (mobile) */}
                <FilterDisclosure
                  name={sortFilter.name}
                  filterId={sortFilter.id}
                  options={sortFilter.options}
                  selectedValue={sortBy}
                  onChange={changeSortBy}
                  idPrefix='sort-'
                />
              </form>
            </MobileFilterDrawer>

            {/* PC filter */}
            <div className='mx-auto text-center'>
              <section aria-labelledby='filter-heading' className='pb-8'>
                <h2 id='filter-heading' className='sr-only'>
                  Operators filters
                </h2>

                <div className='flex items-center space-x-8'>
                  <div className='flex items-center'>
                    <TextInput
                      placeholder={t('Operators.Filter operators') || ''}
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
                      {/* sort by filter */}
                      <FilterPopover
                        name={sortFilter.name}
                        filterId={sortFilter.id}
                        options={sortFilter.options}
                        selectedValue={sortBy}
                        onChange={changeSortBy}
                        idPrefix='sort-'
                      />

                      {/* group filter */}
                      <FilterPopover
                        name={groupFilter.name}
                        filterId={groupFilter.id}
                        options={[]}
                        selectedValue=''
                        onChange={() => {}}
                      >
                        <form className='space-y-4'>
                          <TextInput
                            placeholder={t('Operators.Filter groups') || ''}
                            value={groupTextFilter}
                            onChange={changeGroupTextFilter}
                            autoFocus
                            ref={groupTextFilterRef}
                            icon={groupTextFilter.length ? faCircleXmark : undefined}
                            onIconClick={() => clearGroupTextFilter()}
                            trailingIcon={true}
                            className='min-w-[10rem]'
                          />
                          {!filteredGroups.length && (
                            <div className='text-sm text-gray-500 dark:text-gray-400'>
                              <span>No groups</span>
                            </div>
                          )}
                          {filteredGroups.map((option) => (
                            <div key={option.value}>
                              {option.value.startsWith('divider') ? (
                                <div className='relative'>
                                  <div
                                    className='absolute inset-0 flex items-center'
                                    aria-hidden='true'
                                  >
                                    <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                                  </div>
                                  <div className='relative flex justify-center'></div>
                                </div>
                              ) : (
                                <div className='flex items-center'>
                                  <input
                                    id={`group-${option.value}`}
                                    name={`filter-${groupFilter.id}`}
                                    type='radio'
                                    defaultChecked={option.value === group}
                                    onChange={changeGroup}
                                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                                  />
                                  <label
                                    htmlFor={`group-${option.value}`}
                                    className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                                  >
                                    {option.label}
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}
                        </form>
                      </FilterPopover>

                      {/* status filter */}
                      <FilterPopover
                        name={statusFilter.name}
                        filterId={statusFilter.id}
                        options={statusFilter.options}
                        selectedValue={status}
                        onChange={changeStatus}
                        idPrefix='status-'
                        panelClassName='absolute right-0 z-10 mt-2 origin-top-right rounded-md min-w-max p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-700'
                      />
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
                <ActiveFilters
                  filters={[
                    { label: t('Phonebook.Sort by'), value: sortByLabel },
                    { label: t('Phonebook.Group'), value: groupLabel },
                    { label: t('Phonebook.Status'), value: statusLabel },
                  ]}
                  onReset={resetFilters}
                />
              </section>
            </div>
          </div>
        ) : (
          <>
            {/* Grouped layout mobile filter dialog */}
            <MobileFilterDrawer
              open={open}
              setOpen={setOpen}
              panelClassName={`relative ml-auto flex h-full w-full max-w-xs flex-col ${customScrollbarClass} py-4 pb-6 shadow-xl bg-white dark:bg-gray-900`}
            >
              {/* Filters (mobile) */}
              <form className='mt-4'>
                {/* sort by filter (mobile) */}
                <FilterDisclosure
                  name={groupedLayoutSortFilter?.name}
                  filterId={groupedLayoutSortFilter?.id}
                  options={groupedLayoutSortFilter?.options}
                  selectedValue={groupedSortBy}
                  onChange={changeGroupedSortBy}
                  idPrefix='sort-'
                />

                {/* group by filter (mobile) */}
                <FilterDisclosure
                  name={groupedLayoutGroupByFilter?.name}
                  filterId={groupedLayoutGroupByFilter?.id}
                  options={groupedLayoutGroupByFilter?.options}
                  selectedValue={groupedGroupBy}
                  onChange={changeGroupedGroupBy}
                  idPrefix='group-'
                />

                {/* status filter (mobile) */}
                <FilterDisclosure
                  name={statusFilter.name}
                  filterId={statusFilter.id}
                  options={statusFilter.options}
                  selectedValue={status}
                  onChange={changeStatus}
                  idPrefix='status-'
                />
              </form>
            </MobileFilterDrawer>

            {/* Grouped layout PC*/}
            <div className='mx-auto text-center'>
              <section aria-labelledby='filter-heading' className='pb-6'>
                <h2 id='filter-heading' className='sr-only'>
                  {t('Operators.Operators filters')}
                </h2>

                <div className='flex items-center space-x-8'>
                  <div className='flex items-center'>
                    <TextInput
                      placeholder={t('Operators.Filter operators') || ''}
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
                      {/* group layout sort by filter */}
                      <FilterPopover
                        name={groupedLayoutSortFilter?.name}
                        filterId={groupedLayoutSortFilter?.id}
                        options={groupedLayoutSortFilter?.options}
                        selectedValue={groupedSortBy}
                        onChange={changeGroupedSortBy}
                        idPrefix='sort-'
                      />

                      {/* group filter */}
                      <FilterPopover
                        name={groupFilter.name}
                        filterId={groupFilter.id}
                        options={[]}
                        selectedValue=''
                        onChange={() => {}}
                      >
                        <form className='space-y-4'>
                          <TextInput
                            placeholder={t('Operators.Filter groups') || ''}
                            value={groupTextFilter}
                            onChange={changeGroupTextFilter}
                            autoFocus
                            ref={groupTextFilterRef}
                            icon={groupTextFilter.length ? faCircleXmark : undefined}
                            onIconClick={() => clearGroupTextFilter()}
                            trailingIcon={true}
                            className='min-w-[10rem]'
                          />
                          {!filteredGroups.length && (
                            <div className='text-sm text-gray-500 dark:text-gray-400'>
                              <span>No groups</span>
                            </div>
                          )}
                          {filteredGroups.map((option) => (
                            <div key={option.value}>
                              {option.value.startsWith('divider') ? (
                                <div className='relative'>
                                  <div
                                    className='absolute inset-0 flex items-center'
                                    aria-hidden='true'
                                  >
                                    <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                                  </div>
                                  <div className='relative flex justify-center'></div>
                                </div>
                              ) : (
                                <div className='flex items-center'>
                                  <input
                                    id={`group-${option.value}`}
                                    name={`filter-${groupFilter.id}`}
                                    type='radio'
                                    defaultChecked={option.value === group}
                                    onChange={changeGroup}
                                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                                  />
                                  <label
                                    htmlFor={`group-${option.value}`}
                                    className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                                  >
                                    {option.label}
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}
                        </form>
                      </FilterPopover>

                      {/* group layout group by filter */}
                      <FilterPopover
                        name={groupedLayoutGroupByFilter?.name}
                        filterId={groupedLayoutGroupByFilter?.id}
                        options={groupedLayoutGroupByFilter?.options}
                        selectedValue={groupedGroupBy}
                        onChange={changeGroupedGroupBy}
                        idPrefix='group-'
                      />

                      {/* status filter */}
                      <FilterPopover
                        name={statusFilter?.name}
                        filterId={statusFilter?.id}
                        options={statusFilter?.options}
                        selectedValue={status}
                        onChange={changeStatus}
                        idPrefix='status-'
                        panelClassName='absolute right-0 z-10 mt-2 origin-top-right rounded-md min-w-max p-4 shadow-2xl ring-1 ring-opacity-5 focus:outline-none bg-white ring-black dark:bg-gray-900 dark:ring-gray-700'
                      />
                    </PopoverGroup>

                    <button
                      type='button'
                      className='inline-block text-sm font-medium sm:hidden text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100'
                      onClick={() => setOpen(true)}
                    >
                      {t('Operators.Filters')}
                    </button>
                  </div>
                </div>

                {/* Active filters */}
                <ActiveFilters
                  filters={[
                    { label: t('Phonebook.Sort by'), value: layoutGroupedSortLabel },
                    { label: t('Phonebook.Group'), value: layoutGroupedGroupLabel },
                    { label: t('Phonebook.Status'), value: statusLabel },
                  ]}
                  onReset={resetFilters}
                />
              </section>
            </div>
          </>
        )}
      </div>
    )
  },
)

Filter.displayName = 'Filter'
