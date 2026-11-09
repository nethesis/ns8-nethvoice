// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faBan } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import Link from 'next/link'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

// "Restricted page" pattern of the Nethesis design system
export const MissingPermission = ({}): JSX.Element => {
  return (
    <div className='flex justify-center py-16'>
      <EmptyState
        variant='plain'
        className='max-w-xl'
        title={t('Common.Restricted page')}
        description={t('Common.Restricted page description') || ''}
        icon={<FontAwesomeIcon icon={faBan} className='text-emerald-600' aria-hidden='true' />}
      >
        <Link href={'/operators'}>
          <Button variant='primary' size='large'>
            <FontAwesomeIcon icon={faArrowRight} className='mr-2 h-4 w-4' aria-hidden='true' />
            <span>{t('Common.Go to Operators')}</span>
          </Button>
        </Link>
      </EmptyState>
    </div>
  )
}
