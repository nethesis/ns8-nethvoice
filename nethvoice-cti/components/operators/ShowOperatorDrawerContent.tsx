// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { LastCallsDrawerTable } from '../history/LastCallsDrawerTable'
import { startOfDay, subDays } from 'date-fns'
import { OperatorSummary } from './OperatorSummary'
import { useTranslation } from 'react-i18next'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'

export interface ShowOperatorDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const ShowOperatorDrawerContent = forwardRef<
  HTMLButtonElement,
  ShowOperatorDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const profile = useSelector((state: RootState) => state.user)

  const { t } = useTranslation()

  return (
    <>
      <DrawerHeader title={t('OperatorDrawer.Operator details') || ''} />
      <div className={classNames('px-6', className)} {...props}>
        <Divider />
        <OperatorSummary operator={config} isShownFavorite={true} isShownSideDrawerLink={false} />

        {/* last calls: search all operator extensions */}
        {profile?.profile?.macro_permissions?.cdr?.permissions?.ad_cdr?.value && (
          <LastCallsDrawerTable
            callType={config?.lastCallsType || 'switchboard'}
            dateFrom={startOfDay(subDays(new Date(), 7))}
            dateTo={new Date()}
            phoneNumbers={config?.endpoints?.extension?.map((ext: any) => ext?.id)}
            limit={10}
          />
        )}
      </div>
    </>
  )
})

ShowOperatorDrawerContent.displayName = 'ShowOperatorDrawerContent'
