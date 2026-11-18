// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { ContactSummary } from './ContactSummary'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { useTranslation } from 'react-i18next'

export interface ShowContactDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const ShowContactDrawerContent = forwardRef<
  HTMLButtonElement,
  ShowContactDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const { t } = useTranslation()

  const auth = useSelector((state: RootState) => state.authentication)

  return (
    <>
      <DrawerHeader title={t('Phonebook.Contact details')} />

      <div className={classNames(className, 'px-5')} {...props}>
        <Divider />
        <ContactSummary contact={config} isShownContactMenu={true} isShownSideDrawerLink={false} />
      </div>
    </>
  )
})

ShowContactDrawerContent.displayName = 'ShowContactDrawerContent'
