// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Avatar, Button, Dropdown } from '../common'
import { RootState } from '../../store'
import { openChangeProfilePictureDrawer, removeAvatar } from '../../lib/profilePicture'
import { retrieveAvatars } from '../../lib/operators'
import { AccountSection } from './AccountSection'
import { openToast } from '../../lib/utils'

export const ProfilePicture: FC = () => {
  const { t } = useTranslation()
  const operators = useSelector((state: RootState) => state.operators.operators)
  const profile = useSelector((state: RootState) => state.user)
  const authStore = useSelector((state: RootState) => state.authentication)
  const avatar = operators[profile?.username]?.avatarBase64

  const deletePicture = async () => {
    try {
      await removeAvatar('')
    } catch (error) {
      openToast('error', t('Settings.Cannot remove the profile picture'), t('Common.Error'))
      return
    }
    localStorage.removeItem('caches-' + authStore.username)
    retrieveAvatars(authStore)
  }

  return (
    <AccountSection title={t('Settings.Profile picture')}>
      <div className='flex items-center justify-between gap-4 rounded-lg bg-elevationL2Invert dark:bg-elevationL2InvertDark px-5 py-4 shadow max-w-[28.125rem]'>
        <Avatar
          size='extra_large'
          placeholderType='person'
          src={avatar}
          className='!h-20 !w-20 shrink-0'
        />
        <div className='flex items-center gap-2'>
          <Button
            variant='white'
            onClick={openChangeProfilePictureDrawer}
            className='whitespace-nowrap'
          >
            <FontAwesomeIcon icon={faPenToSquare} className='mr-2 h-4 w-4' />
            {t('Settings.Change picture')}
          </Button>
          {avatar && (
            <Dropdown
              position='left'
              items={
                <Dropdown.Item icon={faTrash} isRed onClick={deletePicture}>
                  {t('Settings.Remove picture')}
                </Dropdown.Item>
              }
            >
              <Button variant='ghost' aria-label={t('Common.Options') || ''}>
                <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
              </Button>
            </Dropdown>
          )}
        </div>
      </div>
    </AccountSection>
  )
}
