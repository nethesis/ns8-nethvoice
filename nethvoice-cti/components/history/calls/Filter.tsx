// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import React from 'react'
import classNames from 'classnames'
import { TextInput } from '../../common'
import { faCircleXmark, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { savePreference } from '../../../lib/storage'
import {
  DEFAULT_CONTENT_FILTER,
  DEFAULT_CALL_TYPE_FILTER,
  DEFAULT_CALL_DIRECTION_FILTER,
  DEFAULT_SORT_BY,
  getFilterValues,
} from '../../../lib/history'
import { formatDateLoc } from '../../../lib/dateTime'
import { subDays, startOfDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import { FilterMobile } from './FilterMobile'
import { FilterDesktop } from './FilterDesktop'

//Filter for the sort
const sortFilter = {
  id: 'sort',
  name: 'Sort by',
  options: [
    { value: 'time%20desc', label: 'Newest' },
    { value: 'time%20asc', label: 'Oldest' },
  ],
}

//Filter for the date
const date = {
  id: 'date',
  name: 'Date',
}

//Call type filter: Personal/ Switchboard
const callTypeFilter = {
  id: 'kind',
  name: 'Call type',
  options: [
    { value: 'user', label: 'Personal' },
    { value: 'switchboard', label: 'Switchboard' },
    { value: 'group', label: 'Groups' },
  ],
}

//Filter for the direction: All/ Incoming/ Outgoing/ Missed/ Internal
const callDirectionFilter = {
  id: 'direction',
  name: 'call direction',
  options: [
    { value: 'all', label: 'All' },
    { value: 'in', label: 'Incoming' },
    { value: 'out', label: 'Outgoing' },
    { value: 'lost', label: 'Missed' },
    { value: 'internal', label: 'Internal' },
  ],
}

//Filter for the direction: All/ Incoming/ Outgoing/ Missed
const callDirectionFilterNoInternal = {
  id: 'direction',
  name: 'call direction',
  options: [
    { value: 'all', label: 'All' },
    { value: 'in', label: 'Incoming' },
    { value: 'out', label: 'Outgoing' },
    { value: 'lost', label: 'Missed' },
  ],
}

const contentFilter = {
  id: 'content',
  name: 'Call content',
  options: [
    { value: 'all', label: 'All' },
    { value: 'summary', label: 'Summary' },
    { value: 'transcription', label: 'Transcription' },
    { value: 'voicemail', label: 'Voicemail' },
  ],
}

export interface FilterProps extends ComponentPropsWithRef<'div'> {
  updateFilterText: Function
  updateCallTypeFilter: Function
  updateCallDirectionFilter: Function
  updateDateBeginFilter: Function
  updateDateEndFilter: Function
  updateSortFilter: Function
  updateContentFilter: Function
}

export const Filter = forwardRef<HTMLButtonElement, FilterProps>(
  (
    {
      updateFilterText,
      updateCallTypeFilter,
      updateCallDirectionFilter,
      updateDateBeginFilter,
      updateDateEndFilter,
      updateSortFilter,
      updateContentFilter,
      className,
      ...props
    },
    ref,
  ) => {
    const auth = useSelector((state: RootState) => state.authentication)
    const { profile } = useSelector((state: RootState) => state.user)
    const [internalUsed, setInternalUsed] = useState(false)

    const [open, setOpen] = useState(false)

    const [filterText, setFilterText] = useState('')
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>

    const [callDirectionLabel, setCallDirectionLabel] = useState('')

    const [callTypeLabel, setCallTypeLabel] = useState('')
    const [contentFilterLabel, setContentFilterLabel] = useState('All')

    const [callDirection, setCallDirection] = useState('all')

    const [callType, setCallType] = useState('user')
    const [selectedContentFilter, setSelectedContentFilter] = useState(DEFAULT_CONTENT_FILTER)

    const [dateBeginShowed, setDateBeginShowed] = useState('')
    const [dateEndShowed, setDateEndShowed] = useState('')

    //Sorting filter
    const [sortBy, setSortBy]: any = useState('time%20desc')
    function changeSortBy(event: any) {
      const newSortBy = event.target.id
      setSortBy(newSortBy)
      // update history (notify parent component)
      updateSortFilter(newSortBy)
      savePreference('historySortTypePreference', newSortBy, auth.username)
    }

    //Check if personal call filter is selected
    function checkSelected(selectedType: any) {
      callDirectionFilter.options
      if (selectedType === 'user') {
        setInternalUsed(false)
      } else {
        setInternalUsed(true)
      }
    }

    const [labelForDateFrom, setLabelForDateFrom] = useState('')
    const [labelForDateTo, setLabelForDateTo] = useState('')

    //Date to be visualized in the active filters section
    //Get actual date with hour and minute
    const dateToWithHour: any = formatDateLoc(new Date(), 'PPp')

    //Get actual date without hour and minute for the reset
    const actualDateForReset: any = formatDateLoc(new Date(), 'yyyy-MM-dd')

    //Get one week before date
    const oneWeekBeforeActualDate = startOfDay(subDays(new Date(), 7))

    //Format the date to the format for the visualizations
    const dateFromWithHour: any = formatDateLoc(oneWeekBeforeActualDate, 'PPp')

    const actualDateLabelTo: any = formatDateLoc(new Date(), "yyyy-MM-dd'T'HH:mm")
    const actualDateLabelFrom: any = formatDateLoc(oneWeekBeforeActualDate, "yyyy-MM-dd'T'HH:mm")

    //Get one week before date without hour and minute for the reset
    const dateFromForReset: any = formatDateLoc(oneWeekBeforeActualDate, 'yyyy-MM-dd')

    //Set the date to be showed in to the label for the date filter
    if (labelForDateTo === '') {
      setLabelForDateTo(dateToWithHour)
    }

    if (labelForDateFrom === '') {
      setLabelForDateFrom(dateFromWithHour)
    }

    function changeHourBegin() {
      //Get the date from the input
      const hourBegin = hourBeginRef.current.value
      setHourBeginValue(hourBegin)
    }

    function changeHourEnd() {
      //Get the date from the input
      const hourEnd = hourEndRef.current.value
      setHourEndValue(hourEnd)
    }

    const [dateValue, setdateValue]: any = useState({
      startDate: null,
      endDate: null,
    })
    const [hourBeginValue, setHourBeginValue]: any = useState('')
    const [hourEndValue, setHourEndValue]: any = useState('')

    const applyTimeToDate = (value: Date, time: string, fallbackHour: number, fallbackMinute: number) => {
      const nextDate = new Date(value)

      if (Number.isNaN(nextDate.getTime())) {
        return null
      }

      if (time) {
        const [hours, minutes] = time.split(':').map(Number)

        if (Number.isInteger(hours) && Number.isInteger(minutes)) {
          nextDate.setHours(hours, minutes, 0, 0)
          return nextDate
        }
      }

      nextDate.setHours(fallbackHour, fallbackMinute, 0, 0)
      return nextDate
    }

    //Set the date when the date filter is changed
    const changeDateBegin = (date: any) => {
      if (date != null && date.startDate !== null && date.endDate !== null) {
        const convertDateBegin = applyTimeToDate(date.startDate, hourBeginValue, 0, 0)
        const convertDateEnd = applyTimeToDate(date.endDate, hourEndValue, 23, 59)

        if (!convertDateBegin || !convertDateEnd) {
          return
        }

        let dateBeginWithHour: any = formatDateLoc(convertDateBegin, 'PPp')
        let noHour: any = formatDateLoc(convertDateBegin, 'yyyy-MM-dd')
        updateDateBeginFilter(noHour)

        let dateEndWithHour: any = formatDateLoc(convertDateEnd, 'PPp')
        let noEndHour: any = formatDateLoc(convertDateEnd, 'yyyy-MM-dd')
        updateDateEndFilter(noEndHour)

        setDateEndShowed(dateEndWithHour)
        setDateBeginShowed(dateBeginWithHour)
        setdateValue(date)
        setClearSelected(false)
      }
    }

    //Get value from date input
    const hourBeginRef = useRef() as React.MutableRefObject<HTMLInputElement>
    const hourEndRef = useRef() as React.MutableRefObject<HTMLInputElement>

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

    function changeCallType(event: any) {
      const newCallType = event.target.id
      setCallType(newCallType)
      //Call the function to check if personal call is selected
      checkSelected(newCallType)
      updateCallTypeFilter(newCallType)
      savePreference('historyCallTypeFilter', newCallType, auth.username)
    }

    function changeCallDirection(event: any) {
      const newCallDirection = event.target.id
      setCallDirection(newCallDirection)
      updateCallDirectionFilter(newCallDirection)
      savePreference('historyCallTypeDirection', newCallDirection, auth.username)
    }

    function changeContentFilter(event: any) {
      const newContentFilter = event.target.id
      setSelectedContentFilter(newContentFilter)
      updateContentFilter(newContentFilter)
      savePreference('historyContentFilter', newContentFilter, auth.username)
    }

    //Set the label for the selected call type
    useEffect(() => {
      const callTypeFound = callTypeFilter?.options?.find((option) => option?.value === callType)
      if (callTypeFound) {
        setCallTypeLabel(callTypeFound?.label)
      }
    }, [callType])

    useEffect(() => {
      if (callType === 'user' && callDirection === 'internal') {
        setCallDirectionLabel('All')
        setCallDirection('all')
        updateCallDirectionFilter('all')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callType, callDirection])

    //Set the label for the selected call direction
    useEffect(() => {
      const callDirectionFound = callDirectionFilter.options.find(
        (option) => option.value === callDirection,
      )
      if (callDirectionFound) {
        setCallDirectionLabel(callDirectionFound?.label)
      }
    }, [callDirection])

    useEffect(() => {
      const contentFilterFound = contentFilter.options.find(
        (option) => option.value === selectedContentFilter,
      )
      if (contentFilterFound) {
        setContentFilterLabel(contentFilterFound.label)
      }
    }, [selectedContentFilter])

    const [selectedLanguage, setSelectedLanguage] = useState('')

    useEffect(() => {
      if (i18next?.languages[0] !== '') {
        setSelectedLanguage(i18next?.languages[0])
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18next?.languages[0]])

    //Get the selected filter from the local storage
    useEffect(() => {
      if (!auth.username) {
        return
      }

      const filterValues = getFilterValues(auth.username)
      setCallType(filterValues.callType)
      setCallDirection(filterValues.callDirection)
      setSortBy(filterValues.sortBy)
      setSelectedContentFilter(filterValues.contentFilter || DEFAULT_CONTENT_FILTER)
      checkSelected(filterValues.callType)

      // notify parent component
      updateCallTypeFilter(filterValues.callType)
      updateCallDirectionFilter(filterValues.callDirection)
      updateSortFilter(filterValues.sortBy)
      updateContentFilter(filterValues.contentFilter || DEFAULT_CONTENT_FILTER)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.username])

    const [clearSelected, setClearSelected] = useState(false)

    function clearDate() {
      setClearSelected(true)
      setLabelForDateTo(dateToWithHour)
    }

    //Clear the filter
    function clearFilters() {
      clearDate()
      setFilterText('')
      setCallType(DEFAULT_CALL_TYPE_FILTER)
      setCallDirection(DEFAULT_CALL_DIRECTION_FILTER)
      setSelectedContentFilter(DEFAULT_CONTENT_FILTER)
      // Update the dateValue state
      setdateValue((prevState: any) => {
        return {
          ...prevState,
          startDate: actualDateLabelFrom,
          endDate: actualDateLabelTo,
        }
      })
      setSortBy(DEFAULT_SORT_BY)
      savePreference('historyCallTypeFilter', DEFAULT_CALL_TYPE_FILTER, auth.username)
      savePreference('historyCallTypeDirection', DEFAULT_CALL_DIRECTION_FILTER, auth.username)
      savePreference('historySortTypePreference', DEFAULT_SORT_BY, auth.username)
      savePreference('historyContentFilter', DEFAULT_CONTENT_FILTER, auth.username)

      // notify parent component
      updateFilterText('')
      updateCallTypeFilter(DEFAULT_CALL_TYPE_FILTER)
      updateCallDirectionFilter(DEFAULT_CALL_DIRECTION_FILTER)
      updateDateBeginFilter(dateFromForReset)
      updateDateEndFilter(actualDateForReset)
      updateSortFilter(DEFAULT_SORT_BY)
      updateContentFilter(DEFAULT_CONTENT_FILTER)
      checkSelected(DEFAULT_CALL_TYPE_FILTER)
    }

    const { t } = useTranslation()

    return (
      <div className={classNames('bg-body dark:bg-bodyDark', className)} {...props}>
        <div className=''>
          {/* Drawer filter mobile */}
          <FilterMobile
            open={open}
            setOpen={setOpen}
            callTypeFilter={callTypeFilter}
            callType={callType}
            changeCallType={changeCallType}
            profile={profile}
            internalUsed={internalUsed}
            callDirectionFilter={callDirectionFilter}
            callDirectionFilterNoInternal={callDirectionFilterNoInternal}
            callDirection={callDirection}
            changeCallDirection={changeCallDirection}
            date={date}
            hourBeginRef={hourBeginRef}
            hourEndRef={hourEndRef}
            hourBeginValue={hourBeginValue}
            hourEndValue={hourEndValue}
            changeHourBegin={changeHourBegin}
            changeHourEnd={changeHourEnd}
            selectedLanguage={selectedLanguage}
            dateValue={dateValue}
            changeDateBegin={changeDateBegin}
            sortFilter={sortFilter}
            sortBy={sortBy}
            changeSortBy={changeSortBy}
            contentFilter={contentFilter}
            selectedContentFilter={selectedContentFilter}
            changeContentFilter={changeContentFilter}
          />

          {/* Filter pc */}
          <div className='mx-auto text-center'>
            <section aria-labelledby='filter-heading' className='pb-8'>
              <h2 id='filter-heading' className='sr-only'>
                {t('History.History filters')}
              </h2>

              <div className='flex items-center space-x-8'>
                <div className='flex items-center'>
                  <TextInput
                    placeholder={t('History.Filter by name or number') || ''}
                    className='max-w-lg'
                    value={filterText}
                    onChange={changeFilterText}
                    ref={textFilterRef}
                    leadingIcon={faMagnifyingGlass}
                    icon={filterText.length ? faCircleXmark : undefined}
                    onIconClick={() => clearTextFilter()}
                    trailingIcon={true}
                  />
                </div>
                <div className='flex'>
                  <FilterDesktop
                    callTypeFilter={callTypeFilter}
                    callType={callType}
                    changeCallType={changeCallType}
                    profile={profile}
                    internalUsed={internalUsed}
                    callDirectionFilter={callDirectionFilter}
                    callDirectionFilterNoInternal={callDirectionFilterNoInternal}
                    callDirection={callDirection}
                    changeCallDirection={changeCallDirection}
                    date={date}
                    hourBeginRef={hourBeginRef}
                    hourEndRef={hourEndRef}
                    hourBeginValue={hourBeginValue}
                    hourEndValue={hourEndValue}
                    changeHourBegin={changeHourBegin}
                    changeHourEnd={changeHourEnd}
                    selectedLanguage={selectedLanguage}
                    dateValue={dateValue}
                    changeDateBegin={changeDateBegin}
                    sortFilter={sortFilter}
                    sortBy={sortBy}
                    changeSortBy={changeSortBy}
                    contentFilter={contentFilter}
                    selectedContentFilter={selectedContentFilter}
                    changeContentFilter={changeContentFilter}
                  />
                  <button
                    type='button'
                    className='inline-block text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900  dark:hover:text-gray-100 sm:hidden ml-4'
                    onClick={() => setOpen(true)}
                  >
                    {t('History.Filters')}
                  </button>
                </div>
              </div>

              {/* Active filters */}
              <div>
                <div className='mx-auto pt-3 flex flex-wrap items-center gap-y-2 gap-x-4'>
                  <h3 className='text-sm font-normal text-primaryNeutral dark:text-primaryNeutralDark text-left sm:text-center'>
                    {t('Common.Active filters')}
                  </h3>
                  {/* separator */}
                  <div
                    aria-hidden='true'
                    className='h-5 w-px block bg-layoutDivider dark:bg-layoutDividerDark'
                  />
                  {/* show selected call type only if user has cdr permissions */}
                  {profile.macro_permissions?.cdr?.permissions?.ad_cdr?.value && (
                    <div className='mt-0'>
                      <div className='-m-1 flex flex-wrap items-center'>
                        <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm border-borderRingInput dark:border-borderRingInputDark'>
                          <span className='text-secondaryNeutral dark:text-secondaryNeutralDark font-normal leading-5'>
                            {t('History.Call type')}:&nbsp;
                          </span>
                          {callTypeLabel && t(`History.${callTypeLabel}`)}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Call direction */}
                  <div className='mt-0'>
                    <div className='-m-1 flex flex-wrap items-center'>
                      <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm border-borderRingInput dark:border-borderRingInputDark'>
                        <span className='text-secondaryNeutral dark:text-secondaryNeutralDark font-normal leading-5'>
                          {t('History.Call direction')}:&nbsp;
                        </span>
                        {callDirectionLabel && t(`History.${callDirectionLabel}`)}
                      </span>
                    </div>
                  </div>
                  <div className='mt-0'>
                    <div className='-m-1 flex flex-wrap items-center'>
                      <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm border-borderRingInput dark:border-borderRingInputDark'>
                        <span className='text-secondaryNeutral dark:text-secondaryNeutralDark font-normal leading-5'>
                          {t('History.Call content')}:&nbsp;
                        </span>
                        {contentFilterLabel && t(`History.${contentFilterLabel}`)}
                      </span>
                    </div>
                  </div>
                  {/* filter date from */}
                  <div className='mt-0'>
                    <div className='-m-1 flex flex-wrap items-center'>
                      <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm border-borderRingInput dark:border-borderRingInputDark'>
                        <span className='text-secondaryNeutral dark:text-secondaryNeutralDark font-normal leading-5'>
                          {t('History.From')}:&nbsp;
                        </span>
                        {!dateValue.startDate || clearSelected ? labelForDateFrom : dateBeginShowed}
                      </span>
                    </div>
                  </div>
                  {/* Filter date to  */}
                  <div className='mt-0'>
                    <div className='-m-1 flex flex-wrap items-center'>
                      <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm border-borderRingInput dark:border-borderRingInputDark'>
                        <span className='text-secondaryNeutral dark:text-secondaryNeutralDark font-normal leading-5'>
                          {t('History.To')}:&nbsp;
                        </span>
                        {!dateValue.endDate || clearSelected ? labelForDateTo : dateEndShowed}
                      </span>
                    </div>
                  </div>
                  {/* separator */}
                  <div
                    aria-hidden='true'
                    className='h-5 w-px sm:block bg-layoutDivider dark:bg-layoutDividerDark'
                  />
                  <div>
                    {/* reset filters */}
                    <div className='mt-0 text-center'>
                      <button
                        type='button'
                        className='text-sm font-medium hover:underline text-primaryActive dark:text-primaryActiveDark'
                        onClick={clearFilters}
                      >
                        {t('Common.Reset filters')}
                      </button>
                    </div>
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

Filter.displayName = 'Filter'
