// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/common'
import { getPasswordInfo } from '../services/password'
import {
  getPasswordDaysLeft,
  getPasswordExpiringTitle,
  isSsoAuthentication,
  PASSWORD_EXPIRATION_WARNING_DAYS,
} from '../lib/password'
import { closeToast, openToast } from '../lib/utils'
import { loadPreference, savePreference } from '../lib/storage'
import { store } from '../store'

const warningPreferenceKey = 'password-expiration-warning-date'
// the middleware reads the info in background after the login: on a slow
// user portal it can take a while
const retryDelay = 5000
const maxAttempts = 24
// long sessions: check again, the warning is shown once a day anyway
const checkInterval = 1000 * 60 * 60

/**
 * Warn the user, once a day, when the password is expired or about to expire
 */
export const usePasswordExpirationWarning = (username: string) => {
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (!username || isSsoAuthentication()) {
      return
    }

    let attempts = 0
    let timer: ReturnType<typeof setTimeout>
    // set on cleanup: a pending check must not act for a previous user
    let cancelled = false

    const check = async () => {
      attempts++
      let info
      try {
        info = await getPasswordInfo()
      } catch (error) {
        return
      }
      if (cancelled || !info?.enabled) {
        return
      }
      // the cached info may be stale until the background read is done
      if (!info.updated_at || info.refreshing) {
        if (attempts < maxAttempts) {
          timer = setTimeout(check, retryDelay)
        }
        return
      }

      const daysLeft = getPasswordDaysLeft(info.expiration)
      if (!info.expired && (daysLeft === null || daysLeft > PASSWORD_EXPIRATION_WARNING_DAYS)) {
        return
      }

      showWarning(info.expired, daysLeft)
    }

    const showWarning = (expired: boolean, daysLeft: number | null) => {
      if (cancelled) {
        return
      }
      // do not cover another toast, e.g. the 2FA suggestion after the login
      if (store.getState().toast.isShown) {
        timer = setTimeout(() => showWarning(expired, daysLeft), retryDelay)
        return
      }

      const today = new Date().toDateString()
      if (loadPreference(warningPreferenceKey, username) === today) {
        return
      }
      savePreference(warningPreferenceKey, today, username)

      const handleChangePassword = () => {
        closeToast()
        router.push('settings?section=Account')
      }

      openToast(
        expired ? 'error' : 'warning',
        <div className='flex flex-col gap-3'>
          <span>{t('Password.Change it now to keep using the application')}</span>
          <div>
            <Button variant='primary' onClick={handleChangePassword}>
              {t('Password.Change password')}
            </Button>
          </div>
        </div>,
        expired
          ? t('Password.Your password is expired')
          : getPasswordExpiringTitle(t, daysLeft as number),
        15000,
      )
    }

    timer = setTimeout(check, retryDelay)
    const interval = setInterval(() => {
      attempts = 0
      clearTimeout(timer)
      check()
    }, checkInterval)

    return () => {
      cancelled = true
      clearTimeout(timer)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])
}
