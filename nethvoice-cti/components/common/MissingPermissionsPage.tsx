// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faBan } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import Link from 'next/link'

export const MissingPermission = ({}): JSX.Element => {
  return (
    <div className='flex items-center justify-center h-[46rem] overflow-y-hidden'>
      <div className='text-center'>
        <FontAwesomeIcon
          icon={faBan}
          className='text-emerald-600 text-6xl mb-4 w-[6rem] h-[6rem]'
        />
        <p className='text-2xl text-gray-900 dark:text-gray-300 pt-8 font-semibold	'>
          {t('Common.Permission error')}
        </p>
        <p className='text-base text-gray-600 dark:text-gray-300 pt-[1rem] font-medium'>
          {t('Common.Permission error message content')}
        </p>
        <div className='flex items-center justify-center'>
          <div className='flex items-center justify-center '>
            <p className='text-base text-gray-600 dark:text-gray-300 font-medium mr-2'>
              {t('Common.Permission error message content link')}
            </p>
          </div>

          <div className='flex items-center justify-center text-gray-900 dark:text-gray-100 text-sm '>
            <Link href={'/operators'}>
              <div className='flex justify-center items-center '>
                <span className='font-semibold text-gray-900 dark:text-gray-100 hover:text-primary hover:dark:text-primaryDark hover:underline'>
                  {t('Common.Main page')}
                </span>
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className='h-4 w-4 m-3 rounded-lg text-gray-900 dark:text-gray-100 hover:text-primary hover:dark:text-primaryDark'
                />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
