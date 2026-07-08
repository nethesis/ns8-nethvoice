// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface ActiveFilterPill {
  label: string
  value: string
}

interface ActiveFiltersProps {
  /** Array of filter pills to display */
  filters: ActiveFilterPill[]
  /** Callback when reset button is clicked */
  onReset: () => void
  /** Optional extra content before the reset button */
  children?: ReactNode
}

export const ActiveFilters: React.FC<ActiveFiltersProps> = ({ filters, onReset, children }) => {
  const { t } = useTranslation()

  return (
    <div>
      <div className='mx-auto pt-3 flex flex-wrap items-center gap-y-2 gap-x-4'>
        <h3 className='text-sm font-medium text-gray-500 dark:text-gray-400 text-left sm:text-center'>
          {t('Common.Active filters')}
        </h3>
        {/* separator */}
        <div aria-hidden='true' className='h-5 w-px block bg-gray-300 dark:bg-gray-600' />
        {filters.map((filter, index) => (
          <div key={index} className='mt-0'>
            <div className='-m-1 flex flex-wrap items-center'>
              <span className='m-1 inline-flex items-center rounded-full border py-1.5 px-3 text-sm font-medium border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-100'>
                <span className='text-gray-600 dark:text-gray-300'>{filter.label}:&nbsp;</span>
                {filter.value}
              </span>
            </div>
          </div>
        ))}
        {children}
        {/* separator */}
        <div aria-hidden='true' className='h-5 w-px sm:block bg-gray-300 dark:bg-gray-600' />
        {/* reset filters */}
        <div className='mt-0 text-center'>
          <button
            type='button'
            onClick={onReset}
            className='text-sm hover:underline text-primary dark:text-primaryDark'
          >
            {t('Common.Reset filters')}
          </button>
        </div>
      </div>
    </div>
  )
}
