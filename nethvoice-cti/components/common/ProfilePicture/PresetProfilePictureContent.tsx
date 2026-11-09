// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState } from 'react'
import { Avatar } from '../Avatar'
import { isEmpty } from 'lodash'
import { uploadProfilePicture } from '../../../lib/profilePicture'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { retrieveAvatars } from '../../../lib/operators'
import { firstDefaultAvatar } from '../../../public/defaultAvatars/firstDefaultPicture'
import { secondDefaultAvatar } from '../../../public/defaultAvatars/secondDefaultPicture'
import { thirdDefaultAvatar } from '../../../public/defaultAvatars/thirdDefaultPicture'
import { fourthDefaultAvatar } from '../../../public/defaultAvatars/fourthDefaultPicture'
import { fifthDefaultAvatar } from '../../../public/defaultAvatars/fifthDefaultPicture'
import { sixthDefaultAvatar } from '../../../public/defaultAvatars/sixthDefaultPicture'
import { seventhDefaultAvatar } from '../../../public/defaultAvatars/seventhDefaultPicture'
import { eighthDefaultAvatar } from '../../../public/defaultAvatars/eightDefaultPicture'

export interface PresetProfilePictureContentProps extends ComponentPropsWithRef<'div'> {}

export const PresetProfilePictureContent = forwardRef<
  HTMLButtonElement,
  PresetProfilePictureContentProps
>(({ className, ...props }, ref) => {
  const [errorUpload, setErrorUpload] = useState(false)

  const authenticationStore = useSelector((state: RootState) => state.authentication)

  const prepareUploadPicture = async (selectedAvatarNumber: number) => {
    let selectedAvatarPicture = ''
    switch (selectedAvatarNumber) {
      case 0:
        selectedAvatarPicture = firstDefaultAvatar
        break
      case 1:
        selectedAvatarPicture = secondDefaultAvatar
        break
      case 2:
        selectedAvatarPicture = thirdDefaultAvatar
        break
      case 3:
        selectedAvatarPicture = fourthDefaultAvatar
        break
      case 4:
        selectedAvatarPicture = fifthDefaultAvatar
        break
      case 5:
        selectedAvatarPicture = sixthDefaultAvatar
        break
      case 6:
        selectedAvatarPicture = seventhDefaultAvatar
        break
      case 7:
        selectedAvatarPicture = eighthDefaultAvatar
        break
      default:
        selectedAvatarPicture = firstDefaultAvatar
        break
    }
    let userInformationObject: any = {}
    if (!isEmpty(selectedAvatarPicture)) {
      userInformationObject.avatar = selectedAvatarPicture

      try {
        await uploadProfilePicture(userInformationObject)
      } catch (error) {
        setErrorUpload(true)
        return
      }
    } else {
    }

    localStorage.removeItem('caches-' + authenticationStore.username)
    retrieveAvatars(authenticationStore)
  }

  return (
    <>
      {/* Divider */}
      <div className='relative pt-8'>
        <div className='absolute inset-0 flex items-center' aria-hidden='true'>
          <div className='w-full border-t  border-gray-300 dark:border-gray-600' />
        </div>
      </div>
      <div className='grid grid-cols-1 xl:grid-cols-4 gap-4'>
        {/* Preset avatars */}
        <Avatar
          size='extra_large'
          src={firstDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(0)}
        />
        <Avatar
          size='extra_large'
          src={secondDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(1)}
        />
        <Avatar
          size='extra_large'
          src={thirdDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(2)}
        />
        <Avatar
          size='extra_large'
          src={fourthDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(3)}
        />
        <Avatar
          size='extra_large'
          src={fifthDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(4)}
        />
        <Avatar
          size='extra_large'
          src={sixthDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(5)}
        />
        <Avatar
          size='extra_large'
          src={seventhDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(6)}
        />
        <Avatar
          size='extra_large'
          src={eighthDefaultAvatar}
          deleteAvatar={false}
          className='cursor-pointer'
          onClick={() => prepareUploadPicture(7)}
        />
      </div>
    </>
  )
})

PresetProfilePictureContent.displayName = 'PresetProfilePictureContent'
