// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import classNames from 'classnames'
import { MobileFilterDrawer, FilterDisclosure } from '../../common/FilterComponents'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../../theme/Context'
import Datepicker from 'react-tailwindcss-datepicker'

interface FilterMobileProps {
  open: boolean
  setOpen: (open: boolean) => void
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

export const FilterMobile: React.FC<FilterMobileProps> = ({
  open,
  setOpen,
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
    <MobileFilterDrawer open={open} setOpen={setOpen} title={t('History.Filters') || ''}>
      <form className='mt-4'>
        {/* Call type + direction filter (mobile) */}
        <FilterDisclosure
          name={t(`History.${callTypeFilter?.name}`)}
          filterId={callTypeFilter?.id}
          options={[]}
          selectedValue=''
          onChange={() => {}}
        >
          <div className='flex flex-col space-y-2'>
            <fieldset>
              <legend className='sr-only'>{callTypeFilter?.name}</legend>
            </fieldset>
            {profile?.macro_permissions?.cdr?.permissions?.ad_cdr?.value && (
              <>
                <div className='space-y-4'>
                  {callTypeFilter?.options?.map((option: any) => (
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
                </div>
                <div className='relative'>
                  <div className='absolute inset-0 flex items-center' aria-hidden='true'>
                    <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                  </div>
                </div>
              </>
            )}
            <fieldset>
              <legend className='sr-only'>{callDirectionFilter?.name}</legend>
            </fieldset>
            {internalUsed ? (
              <div className='space-y-4'>
                {callDirectionFilter.options.map((option: any) => (
                  <div key={option?.value} className='flex items-center'>
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
              </div>
            ) : (
              <div className='space-y-4'>
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
              </div>
            )}
          </div>
        </FilterDisclosure>
      </form>

      {/* Date filter (mobile) */}
      <form className='mt-4'>
        <FilterDisclosure
          name={t(`History.${date.name}`)}
          filterId={date.id}
          options={[]}
          selectedValue=''
          onChange={() => {}}
        >
          <div className='flex flex-col'>
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
          </div>
        </FilterDisclosure>
      </form>

      {/* Sort filter (mobile) */}
      <form className='mt-4'>
        <FilterDisclosure
          name={t(`History.${sortFilter.name}`)}
          filterId={sortFilter.id}
          options={sortFilter.options.map((o: any) => ({
            ...o,
            label: t(`History.${o.label}`),
          }))}
          selectedValue={sortBy}
          onChange={changeSortBy}
        />
      </form>
      <form className='mt-4'>
        <FilterDisclosure
          name={t(`History.${contentFilter.name}`)}
          filterId={contentFilter.id}
          options={contentFilter.options.map((o: any) => ({
            ...o,
            label: t(`History.${o.label}`),
          }))}
          selectedValue={selectedContentFilter}
          onChange={changeContentFilter}
        />
      </form>
    </MobileFilterDrawer>
  )
}
