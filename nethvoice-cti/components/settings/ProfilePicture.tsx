// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, Switch } from '../common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import {
  openShowGravatarDrawer,
  openShowUploadProfilePictureDrawer,
} from '../../lib/profilePicture'
import { faUpload } from '@fortawesome/free-solid-svg-icons'
import { faGravatar } from '@nethesis/nethesis-brands-svg-icons'
import React from 'react'
import { PresetProfilePictureContent } from '../common/ProfilePicture/PresetProfilePictureContent'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

const Profile: NextPage = () => {
  const { t } = useTranslation()
  const operators = useSelector((state: RootState) => state.operators.operators)
  const profile = useSelector((state: RootState) => state.user)
  // Upload avatar section

  const [presetVisible, setPresetVisible] = useState(false)

  return (
    <>
      <section aria-labelledby='clear-cache-heading'>
        <div className='sm:overflow-hidden w-full'>
          <div className='py-6 px-4 sm:p-6 w-full'>
            <div>
              <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
                {t('Settings.Profile picture')}
              </h2>
            </div>
            <div className='flex items-center space-x-4'>
              {/* User main avatar */}
              <Avatar
                size='extra_large'
                placeholderType='person'
                src={operators[profile?.username]?.avatarBase64}
                deleteAvatar={true}
              />
              <CustomThemedTooltip id={'tooltip-remove-profile-picture'} place='left' />
              <Button variant='white' onClick={() => openShowUploadProfilePictureDrawer('')}>
                <FontAwesomeIcon icon={faUpload} className='mr-2' />
                {t('Settings.Upload')}
              </Button>
              <Button variant='white' onClick={() => openShowGravatarDrawer('')}>
                <FontAwesomeIcon icon={faGravatar as IconProp} className='mr-2' />
                {t('Settings.Gravatar')}
              </Button>
              <div className='flex'>
                <Switch
                  on={presetVisible}
                  changed={() => setPresetVisible(!presetVisible)}
                ></Switch>
                <span className='ml-2'>{t('Settings.Preset')}</span>
              </div>
            </div>
            {presetVisible && <PresetProfilePictureContent />}
          </div>
        </div>
      </section>
    </>
  )
}
export default Profile
