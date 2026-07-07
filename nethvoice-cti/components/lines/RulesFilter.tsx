// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useRef } from 'react'
import classNames from 'classnames'
import { TextInput, Button } from '../common'
import { Fragment, useState } from 'react'
import { Dialog, Popover, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleXmark, faXmark, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { useTranslation } from 'react-i18next'
import { openCreateAnnouncementDrawer } from '../../lib/lines'

export interface RulesFilterProps extends ComponentPropsWithRef<'div'> {
  updateTextFilter: Function
}

export const RulesFilter = forwardRef<HTMLButtonElement, RulesFilterProps>(
  ({ updateTextFilter, className, ...props }, ref) => {
    const { t } = useTranslation()
    const auth = useSelector((state: RootState) => state.authentication)
    const [textFilter, setTextFilter] = useState('')
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
    const [open, setOpen] = useState(false)

    function changeTextFilter(event: any) {
      const newTextFilter = event.target.value
      setTextFilter(newTextFilter)

      // notify parent component
      updateTextFilter(newTextFilter)
    }

    const resetFilters = () => {
      setTextFilter('')
      updateTextFilter('') // notify parent component
    }

    const clearTextFilter = () => {
      setTextFilter('')
      updateTextFilter('')
      textFilterRef.current.focus()
    }

    return (
      <div className={classNames(className)} {...props}>
        <div className=''>
          {/* TO DO CHECK ON MOBILE DEVICE  */}
          <div className='mx-auto text-center'>
            <section aria-labelledby='filter-heading' className='pb-6'>
              <h2 id='filter-heading' className='sr-only'>
                {t('Lines.Lines filters')}
              </h2>
              <div className='flex justify-between items-center'>
                <div className='items-center'>
                  <TextInput
                    placeholder={t('Lines.Filter roules') || ''}
                    className='max-w-sm'
                    value={textFilter}
                    onChange={changeTextFilter}
                    ref={textFilterRef}
                    icon={textFilter.length ? faCircleXmark : undefined}
                    onIconClick={() => clearTextFilter()}
                    trailingIcon={true}
                  />
                </div>

                <Button variant='primary' className='' onClick={openCreateAnnouncementDrawer}>
                  <FontAwesomeIcon
                    icon={faPlus}
                    className='h-4 w-4 mr-2 text-white dark:text-white'
                  />
                  <span>{t('Lines.Add rule')}</span>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    )
  },
)

RulesFilter.displayName = 'RulesFilter'
