// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import {
  faCircleArrowUp,
  faCircleCheck,
  faCircleNotch,
  faCircleUser,
  faFile,
  faFileArrowUp,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faGravatar } from '@nethesis/nethesis-brands-svg-icons'
import MD5 from 'crypto-js/md5'
import { RootState } from '../../../store'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { DrawerHeader } from '../DrawerHeader'
import { Divider } from '../Divider'
import { InlineNotification } from '../InlineNotification'
import { TextInput } from '../TextInput'
import { closeSideDrawer, formatFileSize, openToast } from '../../../lib/utils'
import { uploadProfilePicture } from '../../../lib/profilePicture'
import { retrieveAvatars } from '../../../lib/operators'
import { firstDefaultAvatar } from '../../../public/defaultAvatars/firstDefaultPicture'
import { secondDefaultAvatar } from '../../../public/defaultAvatars/secondDefaultPicture'
import { thirdDefaultAvatar } from '../../../public/defaultAvatars/thirdDefaultPicture'
import { fourthDefaultAvatar } from '../../../public/defaultAvatars/fourthDefaultPicture'
import { fifthDefaultAvatar } from '../../../public/defaultAvatars/fifthDefaultPicture'
import { sixthDefaultAvatar } from '../../../public/defaultAvatars/sixthDefaultPicture'
import { seventhDefaultAvatar } from '../../../public/defaultAvatars/seventhDefaultPicture'
import { eighthDefaultAvatar } from '../../../public/defaultAvatars/eightDefaultPicture'

type PictureSource = 'upload' | 'gravatar' | 'preset'

const PRESET_AVATARS = [
  firstDefaultAvatar,
  secondDefaultAvatar,
  thirdDefaultAvatar,
  fourthDefaultAvatar,
  fifthDefaultAvatar,
  sixthDefaultAvatar,
  seventhDefaultAvatar,
  eighthDefaultAvatar,
]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// the picture is resized and compressed anyway: only refuse huge files
const MAX_FILE_SIZE = 10 * 1024 * 1024
// the picture is stored in the user settings: keep it small
const MAX_STORED_SIZE = 30 * 1024
const MAX_STORED_DIMENSION = 800

// selected cards have a double ring, as the focus ring of the buttons
const selectedRing =
  'shadow-[0_0_0_2px_white,0_0_0_4px_var(--color-primary-active)] dark:shadow-[0_0_0_2px_#111827,0_0_0_4px_var(--color-primary-active-dark)]'

const SourceCard: FC<{
  icon: IconProp
  label: string
  selected: boolean
  onClick: () => void
}> = ({ icon, label, selected, onClick }) => (
  <button
    type='button'
    role='radio'
    aria-checked={selected}
    onClick={onClick}
    className={classNames(
      'flex flex-1 h-[3.4375rem] items-center justify-between gap-2 rounded-md border px-3 py-2',
      'border-borderRingInput dark:border-borderRingInputDark',
      selected
        ? classNames('bg-elevation0 dark:bg-elevation0Dark', selectedRing)
        : 'bg-elevationL1 dark:bg-elevationL1Dark',
    )}
  >
    <span className='flex items-center gap-2'>
      <FontAwesomeIcon
        icon={icon}
        className='h-6 w-6 text-primaryNeutral dark:text-primaryNeutralDark'
      />
      <span className='text-sm font-medium text-primaryNeutral dark:text-primaryNeutralDark'>
        {label}
      </span>
    </span>
    <span className='self-start h-full'>
      <FontAwesomeIcon
        icon={faCircleCheck}
        className={classNames(
          'h-3 w-3 text-primaryActive dark:text-primaryActiveDark',
          !selected && 'opacity-0',
        )}
      />
    </span>
  </button>
)

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className='flex flex-col gap-2 w-full'>
    <span className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
      {label}
    </span>
    {children}
  </div>
)

const Preview: FC<{ src: string }> = ({ src }) => {
  const { t } = useTranslation()
  return (
    <Field label={t('Settings.Preview')}>
      <Avatar size='extra_large' src={src} className='!h-16 !w-16' />
    </Field>
  )
}

export const ChangeProfilePictureDrawerContent: FC<{ config: any }> = () => {
  const { t } = useTranslation()
  const authStore = useSelector((state: RootState) => state.authentication)
  const [source, setSource] = useState<PictureSource>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [uploadPicture, setUploadPicture] = useState('')
  const [email, setEmail] = useState('')
  const [gravatarPicture, setGravatarPicture] = useState('')
  const [presetIndex, setPresetIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // the last selected file: the result of a previous one is ignored
  const fileSelection = useRef(0)

  const picture =
    source === 'upload'
      ? uploadPicture
      : source === 'gravatar'
      ? gravatarPicture
      : presetIndex !== null
      ? PRESET_AVATARS[presetIndex]
      : ''

  const changeSource = (newSource: PictureSource) => {
    setSource(newSource)
    setError('')
  }

  // Scale and compress the image until it fits the stored size
  const compressImage = (dataUrl: string, selection: number) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_STORED_DIMENSION / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)

      const compress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size <= MAX_STORED_SIZE) {
              const reader = new FileReader()
              reader.onloadend = () =>
                selection === fileSelection.current && setUploadPicture(reader.result as string)
              reader.readAsDataURL(blob)
            } else if (quality > 0.1) {
              compress(quality - 0.1)
            } else {
              setError(t('Settings.The picture cannot be used, choose another one') || '')
            }
          },
          'image/jpeg',
          quality,
        )
      }
      compress(0.7)
    }
    img.onerror = () => setError(t('Settings.The picture cannot be used, choose another one') || '')
    img.src = dataUrl
  }

  const selectFile = (selected: File | undefined | null) => {
    setError('')
    if (!selected) {
      return
    }
    if (!ALLOWED_TYPES.includes(selected.type) || selected.size > MAX_FILE_SIZE) {
      setError(t('Settings.Picture formats and size') || '')
      return
    }
    setFile(selected)
    setUploadPicture('')
    const selection = ++fileSelection.current
    const reader = new FileReader()
    reader.onloadend = () => compressImage(reader.result as string, selection)
    reader.onerror = () =>
      setError(t('Settings.The picture cannot be used, choose another one') || '')
    reader.readAsDataURL(selected)
  }

  const removeFile = () => {
    fileSelection.current++
    setFile(null)
    setUploadPicture('')
  }

  const previewGravatar = async () => {
    setError('')
    const hash = MD5(email.toLowerCase().trim())
    try {
      const response = await fetch(`https://www.gravatar.com/avatar/${hash}?d=identicon`)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onloadend = () => setGravatarPicture(reader.result as string)
      reader.readAsDataURL(blob)
    } catch (e) {
      setError(t('Settings.Cannot load the Gravatar picture') || '')
    }
  }

  const save = async () => {
    setIsSaving(true)
    try {
      await uploadProfilePicture({ avatar: picture })
    } catch (e) {
      setIsSaving(false)
      setError(t('Settings.Cannot update the profile picture') || '')
      return
    }
    localStorage.removeItem('caches-' + authStore.username)
    retrieveAvatars(authStore)
    closeSideDrawer()
    openToast(
      'success',
      t('Settings.Profile picture has been updated'),
      t('Settings.Profile picture updated'),
    )
  }

  return (
    <>
      <DrawerHeader title={t('Settings.Change picture')} onClose={closeSideDrawer} />
      <div className='px-6'>
        <Divider spaceAbove='pt-6' spaceBelow='pb-6' />
        <div className='flex flex-col gap-8'>
          {error && <InlineNotification type='error' title={error} />}
          <Field label={t('Settings.Picture source')}>
            <div role='radiogroup' className='flex flex-wrap gap-4'>
              <SourceCard
                icon={faCircleArrowUp}
                label={t('Settings.Upload')}
                selected={source === 'upload'}
                onClick={() => changeSource('upload')}
              />
              <SourceCard
                icon={faGravatar as IconProp}
                label={t('Settings.Gravatar')}
                selected={source === 'gravatar'}
                onClick={() => changeSource('gravatar')}
              />
              <SourceCard
                icon={faCircleUser}
                label={t('Settings.Preset')}
                selected={source === 'preset'}
                onClick={() => changeSource('preset')}
              />
            </div>
          </Field>

          {source === 'upload' && (
            <>
              <Field label={t('Settings.Picture')}>
                {file ? (
                  <div className='flex items-start gap-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-elevationL2Invert dark:bg-elevationL2InvertDark p-4'>
                    <div className='flex flex-1 items-center gap-6 min-w-0'>
                      <FontAwesomeIcon
                        icon={faFile}
                        className='h-8 w-8 text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
                      />
                      <div className='flex flex-col gap-1 min-w-0'>
                        <span className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark truncate'>
                          {file.name}
                        </span>
                        <span className='text-xs text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={removeFile}
                      aria-label={t('Common.Remove') || ''}
                    >
                      <FontAwesomeIcon
                        icon={faXmark}
                        className='h-5 w-5 text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
                      />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor='profile-picture-file'
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'copy'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      selectFile(e.dataTransfer.files?.[0])
                    }}
                    className='flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-elevationL2 dark:bg-elevationL2Dark p-6 cursor-pointer'
                  >
                    <FontAwesomeIcon
                      icon={faFileArrowUp}
                      className='h-8 w-8 text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
                    />
                    <span className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
                      {t('Settings.Drag and drop or click to upload')}
                    </span>
                    <input
                      id='profile-picture-file'
                      type='file'
                      accept={ALLOWED_TYPES.join(',')}
                      className='hidden'
                      onChange={(e) => selectFile(e.target.files?.[0])}
                    />
                  </label>
                )}
                <span className='text-xs text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                  {t('Settings.Picture formats and size')}
                </span>
              </Field>
              {uploadPicture && <Preview src={uploadPicture} />}
            </>
          )}

          {source === 'gravatar' && (
            <>
              <Field label={t('Settings.Email address')}>
                <div className='flex items-center gap-4'>
                  <TextInput
                    type='email'
                    placeholder={t('Settings.e.g. name@example.com') || ''}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setGravatarPicture('')
                    }}
                  />
                  <Button variant='white' onClick={previewGravatar} disabled={!email.trim()}>
                    {t('Settings.Preview')}
                  </Button>
                </div>
                <span className='text-xs text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                  {t('Settings.Enter the email address associated with your Gravatar account')}
                </span>
              </Field>
              {gravatarPicture && <Preview src={gravatarPicture} />}
            </>
          )}

          {source === 'preset' && (
            <Field label={t('Settings.Preset pictures')}>
              <div className='grid grid-cols-4 gap-y-6 justify-items-center pt-2'>
                {PRESET_AVATARS.map((avatar, index) => (
                  <button
                    key={index}
                    type='button'
                    onClick={() => setPresetIndex(index)}
                    aria-pressed={presetIndex === index}
                    className={classNames('rounded-full', presetIndex === index && selectedRing)}
                  >
                    <Avatar size='extra_large' src={avatar} className='!h-16 !w-16' />
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>
        <Divider spaceAbove='pt-8' spaceBelow='pb-6' />
        <div className='flex items-center justify-end gap-6 pb-6'>
          <Button variant='ghost' onClick={closeSideDrawer} disabled={isSaving}>
            {t('Common.Cancel')}
          </Button>
          <Button variant='primary' onClick={save} disabled={!picture || isSaving}>
            <span>{t('Common.Save')}</span>
            {isSaving && <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />}
          </Button>
        </div>
      </div>
    </>
  )
}
