// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { ProfilePicture } from './ProfilePicture'
import { Setup2FA } from './2fa/Setup2FA'
import { ChangePassword } from './password/ChangePassword'
import { PasswordInfo } from '../../services/types/password'

interface AccountProps {
  // null when the password cannot be changed here (no account provider
  // user portal, SSO)
  passwordInfo: PasswordInfo | null
}

/**
 * Account settings: profile picture, two-factor authentication and password
 */
export const Account: FC<AccountProps> = ({ passwordInfo }) => (
  // the last section has no divider
  <div className='flex flex-col gap-8 [&>section:last-of-type]:border-b-0'>
    <ProfilePicture />
    <Setup2FA />
    {passwordInfo && <ChangePassword initialInfo={passwordInfo} />}
  </div>
)
