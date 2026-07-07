// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import classNames from 'classnames'
import { FilterPopover } from '../../common/FilterComponents'
import { PopoverGroup } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../../theme/Context'
import Datepicker from 'react-tailwindcss-datepicker'

interface FilterDesktopProps {
  callTypeFilter: any
  callType: string
  changeCallType: (event: any) => void
  profile: any
  internalUsed: boolean
  callDirectionFilter: any
  callDirectionFilterNoInternal: any
  callDirection: string
  changeCallDirection: (event: any) => void
  date: any
  hourBeginRef: React.MutableRefObject<HTMLInputElement>
  hourEndRef: React.MutableRefObject<HTMLInputElement>
  hourBeginValue: string
  hourEndValue: string
  changeHourBegin: () => void
  changeHourEnd: () => void
  selectedLanguage: string
  dateValue: any
  changeDateBegin: (date: any) => void
  sortFilter: any
  sortBy: string
  changeSortBy: (event: any) => void
  contentFilter: any
  selectedContentFilter: string
  changeContentFilter: (event: any) => void
}

export const FilterDesktop: React.FC<FilterDesktopProps> = ({
  callTypeFilter,
  callType,
  changeCallType,
  profile,
  internalUsed,
  callDirectionFilter,
  callDirectionFilterNoInternal,
  callDirection,
  changeCallDirection,
  date,
  hourBeginRef,
  hourEndRef,
  hourBeginValue,
  hourEndValue,
  changeHourBegin,
  changeHourEnd,
  selectedLanguage,
  dateValue,
  changeDateBegin,
  sortFilter,
  sortBy,
  changeSortBy,
  contentFilter,
  selectedContentFilter,
  changeContentFilter,
}) => {
  const { t } = useTranslation()
  const { timePicker: timePickerTheme, datePicker: datePickerTheme } = useTheme().theme

  return (
    <PopoverGroup className='hidden sm:flex sm:items-baseline sm:space-x-4'>
      {/* Call type + direction filter (desktop) */}
      <FilterPopover
        name={t(`History.${callTypeFilter?.name}`)}
        filterId={callTypeFilter?.id}
        options={[]}
        selectedValue=''
        onChange={() => {}}
        panelClassName='absolute right-0 z-10 mt-2 origin-top-right rounded-md flex flex-col space-y-4 bg-white p-4 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-900 dark:ring-gray-700'
      >
        <form className='space-y-4'>
          {callTypeFilter?.options
            ?.filter((option: any) => {
              if (option.value === 'switchboard') {
                return profile?.macro_permissions?.cdr?.permissions?.ad_cdr?.value
              } else if (option.value === 'group') {
                return profile?.macro_permissions?.cdr?.permissions?.group_cdr?.value
              } else {
                return true
              }
            })
            .map((option: any) => (
              <div key={option?.value} className='flex items-center'>
                <input
                  id={option?.value}
                  name={`filter-${callTypeFilter?.id}`}
                  type='radio'
                  defaultChecked={option?.value === callType}
                  onChange={changeCallType}
                  className='h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                />
                <label
                  htmlFor={option?.value}
                  className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                >
                  {t(`History.${option?.label}`)}
                </label>
              </div>
            ))}
        </form>
        <div className='relative'>
          <div className='absolute inset-0 flex items-center' aria-hidden='true'>
            <div className='w-full border-t border-gray-300 dark:border-gray-600' />
          </div>
        </div>
        {internalUsed ? (
          <form className='space-y-4'>
            {callDirectionFilter.options.map((option: any) => (
              <div key={option.value} className='flex items-center'>
                <input
                  id={option.value}
                  name={`filter-${callDirectionFilter.id}`}
                  type='radio'
                  defaultChecked={
                    callType === 'user' && callDirection === 'internal'
                      ? option.value === 'all'
                      : option.value === callDirection
                  }
                  onChange={changeCallDirection}
                  className='h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                />
                <label
                  htmlFor={option.value}
                  className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                >
                  {t(`History.${option.label}`)}
                </label>
              </div>
            ))}
          </form>
        ) : (
          <form className='space-y-4'>
            {callDirectionFilterNoInternal.options.map((option: any) => (
              <div key={option.value} className='flex items-center'>
                <input
                  id={option.value}
                  name={`filter-${callDirectionFilter.id}`}
                  type='radio'
                  defaultChecked={
                    callType === 'user' && callDirection === 'internal'
                      ? option.value === 'all'
                      : option.value === callDirection
                  }
                  onChange={changeCallDirection}
                  className='h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                />
                <label
                  htmlFor={option.value}
                  className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                >
                  {t(`History.${option.label}`)}
                </label>
              </div>
            ))}
          </form>
        )}
      </FilterPopover>

      {/* Date filter (desktop) */}
      <FilterPopover
        name={t(`History.${date.name}`)}
        filterId={date.id}
        options={[]}
        selectedValue=''
        onChange={() => {}}
        panelClassName='absolute right-0 z-10 mt-2 origin-top-right rounded-md bg-white ring-black dark:bg-gray-900 dark:ring-gray-600 p-4 shadow-2xl ring-1 ring-opacity-5'
      >
        <div className='flex pb-4'>
          <div className='relative flex-1'>
            <label htmlFor='startTime' className='text-gray-700 dark:text-gray-300 mt-2'>
              {t('History.Start time')}:
            </label>
            <input
              id='startTime'
              type='time'
              ref={hourBeginRef}
              onChange={changeHourBegin}
              defaultValue={hourBeginValue}
              className={classNames(timePickerTheme.base)}
            />
          </div>
          <div className='mx-4'></div>
          <div className='relative flex-1'>
            <label htmlFor='endTime' className='text-gray-700 dark:text-gray-300 mb-2'>
              {t('History.End time')}:
            </label>
            <input
              id='endTime'
              type='time'
              ref={hourEndRef}
              onChange={changeHourEnd}
              defaultValue={hourEndValue}
              className={classNames(timePickerTheme.base)}
            />
          </div>
        </div>
        <Datepicker
          i18n={selectedLanguage?.toString()}
          value={dateValue}
          onChange={changeDateBegin}
          primaryColor={'emerald'}
          showShortcuts={false}
          separator={t('History.to') || ''}
          placeholder={t('History.Choose a date range') || ''}
          displayFormat={'DD/MM/YYYY'}
          inputClassName={classNames(datePickerTheme.base)}
        />
      </FilterPopover>

      {/* Sort filter (desktop) */}
      <FilterPopover
        name={t(`History.${sortFilter.name}`)}
        filterId={sortFilter.id}
        options={sortFilter.options.map((o: any) => ({
          ...o,
          label: t(`History.${o.label}`),
        }))}
        selectedValue={sortBy}
        onChange={changeSortBy}
      />
      <FilterPopover
        name={t(`History.${contentFilter.name}`)}
        filterId={contentFilter.id}
        options={contentFilter.options.map((o: any) => ({
          ...o,
          label: t(`History.${o.label}`),
        }))}
        selectedValue={selectedContentFilter}
        onChange={changeContentFilter}
      />
    </PopoverGroup>
  )
}
