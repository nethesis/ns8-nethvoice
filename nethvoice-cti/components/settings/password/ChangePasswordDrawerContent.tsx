// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { DrawerHeader } from '../../common/DrawerHeader'
import { Divider } from '../../common/Divider'
import { PasswordChangeForm } from './PasswordChangeForm'
import { changeUserPassword } from '../../../services/password'
import { PasswordPolicy } from '../../../services/types/password'
import { closeSideDrawer, openToast } from '../../../lib/utils'

interface ChangePasswordDrawerContentProps {
  config: {
    policy: PasswordPolicy | null
    onChanged?: () => void
  }
}

export const ChangePasswordDrawerContent: FC<ChangePasswordDrawerContentProps> = ({ config }) => {
  const { t } = useTranslation()
  const auth = useSelector((state: RootState) => state.authentication)

  return (
    <>
      <DrawerHeader title={t('Password.Change password')} onClose={closeSideDrawer} />
      <div className='px-6'>
        <Divider spaceAbove='pt-6' spaceBelow='pb-6' />
        <PasswordChangeForm
          username={auth.username}
          askCurrentPassword={true}
          policy={config?.policy || null}
          submitLabel={t('Password.Change password')}
          layout='drawer'
          onSubmit={async (current, next) => {
            await changeUserPassword(current, next)
          }}
          onSuccess={() => {
            closeSideDrawer()
            openToast(
              'success',
              t('Password.Account password has been updated'),
              t('Password.Password updated'),
            )
            config?.onChanged?.()
          }}
          onCancel={closeSideDrawer}
        />
      </div>
    </>
  )
}
