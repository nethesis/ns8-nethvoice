// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { Button } from '../Button'
import { useState, useRef } from 'react'
import { closeSideDrawer } from '../../../lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleXmark, faSearch } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { TextInput } from '../TextInput'
import { Avatar } from '../Avatar'
import { DrawerHeader } from '../DrawerHeader'
import { Divider } from '../Divider'
import { DrawerFooter } from '../DrawerFooter'
import { uploadProfilePicture } from '../../../lib/profilePicture'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { retrieveAvatars } from '../../../lib/operators'
import { isEmpty } from 'lodash'
import { InlineNotification } from '../InlineNotification'
import { MD5 } from 'crypto-js'

export interface GravatarIconDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const GravatarIconDrawerContent = forwardRef<
  HTMLButtonElement,
  GravatarIconDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const [textFilter, setTextFilter] = useState('')
  const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const [avatarBase64, setAvatarBase64]: any = useState({})
  const [errorEmptyFile, setErrorEmptyFile] = useState(false)
  const [errorUpload, setErrorUpload] = useState(false)

  // clear text filter
  const clearTextFilter = () => {
    setTextFilter('')
    textFilterRef.current.focus()
  }
  // text filter
  function changeTextFilter(event: any) {
    const newTextFilter = event.target.value
    setTextFilter(newTextFilter)
  }

  const authenticationStore = useSelector((state: RootState) => state.authentication)

  const [previewImage, setPreviewImage]: any = useState(null)

  const getGravatarImageUrl = (email: string) => {
    const hash = MD5(email.toLowerCase().trim())
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=identicon`

    return gravatarUrl
  }

  const convertGravatarToBase64 = async () => {
    const email = textFilter

    try {
      const response = await fetch(getGravatarImageUrl(email))
      const blob = await response.blob()
      const reader = new FileReader()

      reader.readAsDataURL(blob)
      reader.onloadend = () => {
        const gravatarBase64 = reader.result as string
        setAvatarBase64({ avatar: gravatarBase64 })
        setPreviewImage(gravatarBase64)
      }
    } catch (error) {
      console.error('Error', error)
      setErrorUpload(true)
    }
  }

  const prepareEditContact = async () => {
    let userInformationObject: any = ''

    if (!isEmpty(avatarBase64)) {
      userInformationObject = avatarBase64

      try {
        await uploadProfilePicture(userInformationObject)
      } catch (error) {
        setErrorUpload(true)
        return
      }
    } else {
      setErrorEmptyFile(true)
    }

    localStorage.removeItem('caches-' + authenticationStore.username)
    retrieveAvatars(authenticationStore)
    closeSideDrawer()
  }

  return (
    <>
      <DrawerHeader title={t('Settings.Gravatar')} onClose={closeSideDrawer} />
      <div className={classNames(className, 'px-5')} {...props}>
        <Divider />
        <div className='mb-6 flex flex-col'>
          {/* Upload error */}
          {errorUpload ||
            (errorEmptyFile && (
              <InlineNotification
                title={
                  errorEmptyFile
                    ? t('Settings.Upload image to continue')
                    : t('Settings.Wrong file type')
                }
                type='error'
                className='mt-2'
              ></InlineNotification>
            ))}
          {/* Email */}
          <label className='text-sm mb-2 font-medium text-gray-700 dark:text-gray-200'>
            {t('Settings.Email address')}
          </label>

          <div className='flex justify-between space-x-2'>
            <TextInput
              placeholder={t('Settings.Type to insert email address') || ''}
              className='max-w-lg'
              value={textFilter}
              onChange={changeTextFilter}
              ref={textFilterRef}
              icon={textFilter.length ? faCircleXmark : undefined}
              onIconClick={() => clearTextFilter()}
              trailingIcon={true}
            />
            <Button variant='white' onClick={() => convertGravatarToBase64()}>
              <FontAwesomeIcon icon={faSearch} className='h-4 w-4' />
            </Button>
          </div>
        </div>
        <div className='mt-4 mb-8 text-left'>
          <h4 className='mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
            {t('Settings.Preview')}
          </h4>
          <Avatar
            size='extra_large'
            placeholderType='person'
            src={previewImage}
            deleteAvatar={false}
          ></Avatar>
        </div>
        {/* Divider */}
        <Divider paddingY='pb-10 pt-6' />
        <DrawerFooter
          cancelLabel={t('Common.Cancel') || ''}
          confirmLabel={t('Settings.Save avatar')}
          onConfirm={prepareEditContact}
          confirmDisabled={isEmpty(avatarBase64)}
        />
      </div>
    </>
  )
})

GravatarIconDrawerContent.displayName = 'GravatarIconDrawerContent'
