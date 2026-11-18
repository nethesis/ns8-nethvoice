// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faKey } from '@fortawesome/free-solid-svg-icons'
import { Button, InlineNotification } from '../../common'
import { AccountSection } from '../AccountSection'
import { getPasswordInfo } from '../../../services/password'
import { PasswordInfo } from '../../../services/types/password'
import { formatDateLoc } from '../../../lib/dateTime'
import { RootState, store } from '../../../store'
import {
  getPasswordDaysLeft,
  getPasswordExpiringTitle,
  getSessionExpiration,
  PASSWORD_EXPIRATION_WARNING_DAYS,
} from '../../../lib/password'

interface ChangePasswordProps {
  // already read by the settings page, read again after a change
  initialInfo: PasswordInfo
}

export const ChangePassword: FC<ChangePasswordProps> = ({ initialInfo }) => {
  const { t } = useTranslation()
  const [info, setInfo] = useState<PasswordInfo | null>(initialInfo)
  const token = useSelector((state: RootState) => state.authentication.token)

  const loadInfo = async () => {
    try {
      setInfo(await getPasswordInfo())
    } catch (error) {
      console.error('Error loading password info:', error)
    }
  }

  const openDrawer = () => {
    store.dispatch.sideDrawer.update({
      isShown: true,
      contentType: 'changePassword',
      config: { policy: info?.policy || null, onChanged: loadInfo },
    })
  }

  const daysLeft = info ? getPasswordDaysLeft(info.expiration) : null
  const sessionExpiration = getSessionExpiration(token)

  const expiredNotification = () => (
    <InlineNotification
      type='error'
      title={
        daysLeft !== null && daysLeft < 0
          ? t('Password.Password expired {{count}} days ago', { count: -daysLeft })
          : daysLeft === 0
          ? t('Password.Password expired today')
          : // forced change by the administrator: the expiration is still ahead
            t('Password.Your password is expired')
      }
      className='w-full'
    >
      <p>
        {sessionExpiration
          ? t('Password.You can continue until {{date}}, then you must change it', {
              date: formatDateLoc(sessionExpiration, 'd MMM yyyy'),
            })
          : t('Password.Change it now to keep using the application')}
      </p>
    </InlineNotification>
  )

  return (
    <AccountSection
      title={t('Password.Change password')}
      description={t('Password.Update the password used to sign in to Web phone and Desktop app.')}
    >
      <div className='flex flex-col gap-10 items-start'>
        {info?.expired && expiredNotification()}
        {info &&
          !info.expired &&
          daysLeft !== null &&
          daysLeft <= PASSWORD_EXPIRATION_WARNING_DAYS && (
            <InlineNotification
              type='warning'
              title={getPasswordExpiringTitle(t, daysLeft)}
              className='w-full'
            >
              <p>{t('Password.Change it now to keep using the application')}</p>
            </InlineNotification>
          )}
        {info?.expiration && !info.expired && (
          <p className='text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
            {t('Password.Password expires on')}{' '}
            <span className='whitespace-nowrap text-secondaryNeutral dark:text-secondaryNeutralDark'>
              {formatDateLoc(new Date(info.expiration), 'd MMM yyyy')}
            </span>
          </p>
        )}
        <Button variant='white' onClick={openDrawer}>
          <FontAwesomeIcon icon={faKey} className='mr-2 h-4 w-4' />
          {t('Password.Change password')}
        </Button>
      </div>
    </AccountSection>
  )
}
