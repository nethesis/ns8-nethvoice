// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { Button } from '../Button'
import { useState } from 'react'
import { closeSideDrawer, formatFileSize } from '../../../lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSave, faXmark } from '@fortawesome/free-solid-svg-icons'
import { DrawerHeader } from '../DrawerHeader'
import { t } from 'i18next'
import { Avatar } from '../Avatar'
import { uploadProfilePicture } from '../../../lib/profilePicture'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { retrieveAvatars } from '../../../lib/operators'
import { isEmpty } from 'lodash'
import { InlineNotification } from '../InlineNotification'

export interface SelectProfilePictureDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const SelectProfilePictureDrawerContent = forwardRef<
  HTMLButtonElement,
  SelectProfilePictureDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const authenticationStore = useSelector((state: RootState) => state.authentication)

  const [previewImage, setPreviewImage]: any = useState(null)

  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [selectedFileBase64, setSelectedFileBase64] = useState<any>(null)

  const [errorUpload, setErrorUpload] = useState(false)
  const [errorEmptyFile, setErrorEmptyFile] = useState(false)

  const prepareUploadPicture = async () => {
    let userInformationObject: any = {}
    if (!isEmpty(selectedFileBase64)) {
      userInformationObject.avatar = selectedFileBase64

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

  function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()

    const file = event.dataTransfer.files && event.dataTransfer.files[0]

    if (file && isImageFile(file)) {
      setSelectedFile(file)
      const reader = new FileReader()

      reader.readAsDataURL(file)
      //to prevent local storage from becoming full
      reader.onloadend = () => {
        resizeImage(reader.result as string, 30 * 1024)
      }

      if (errorUpload) {
        setErrorUpload(false)
      }
    } else {
      setErrorUpload(true)
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault()
    const file = event.target.files && event.target.files[0]

    if (!file) {
      setErrorUpload(true)
      return
    }

    if (!isImageFile(file)) {
      setErrorUpload(true)
      return
    }

    setSelectedFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      if (!reader.result) {
        setErrorUpload(true)
        return
      }

      resizeImage(reader.result as string, 30 * 1024)
    }

    reader.onerror = () => {
      setErrorUpload(true)
    }
    reader.readAsDataURL(file)
  }

  function resizeImage(dataUrl: string, maxFileSize: number, quality = 0.7) {
    const img = new Image()
    img.src = dataUrl

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        return
      }

      let { width, height } = img
      const MAX_SIZE = 800

      if (width > height) {
        if (width > MAX_SIZE) {
          height = (height * MAX_SIZE) / width
          width = MAX_SIZE
        }
      } else {
        if (height > MAX_SIZE) {
          width = (width * MAX_SIZE) / height
          height = MAX_SIZE
        }
      }

      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      // Reduce the quality of the image
      function compressImage(currentQuality: number) {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size <= maxFileSize) {
              const reader = new FileReader()
              reader.onloadend = () => {
                setSelectedFileBase64(reader.result as string)
                setPreviewImage(reader.result as string)
              }
              reader.readAsDataURL(blob)
            } else if (currentQuality > 0.1) {
              compressImage(currentQuality - 0.1)
            } else {
              setErrorUpload(true)
            }
          },
          'image/jpeg',
          currentQuality,
        )
      }

      compressImage(quality)
    }
  }

  // Check if file is an image
  function isImageFile(file: File): boolean {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']

    return allowedImageTypes.includes(file.type)
  }

  function deleteUploadedAnnouncement() {
    setSelectedFile(null)
    setPreviewImage(null)
  }

  return (
    <>
      <DrawerHeader title={t('Settings.Upload profile picture')}  onClose={closeSideDrawer}/>
      <div className={classNames(className, 'px-5')} {...props}>
        
        <>
          {/* Profile picture drawer section */}
          <div className='flex items-center justify-between mt-2'>
            <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Settings.Image')} (png, jpg, jpeg)
            </h4>
          </div>
          {/* Upload profile picture section */}
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
          {/* If the file hasn't been uploaded yet */}
          {!selectedFile ? (
            <>
              <div className='flex items-center justify-center w-full mt-2'>
                <label
                  htmlFor='dropzone-file'
                  className='flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 hover:bg-gray-200 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className='flex flex-col items-center justify-center pt-6 text-gray-600 dark:text-gray-300'>
                    <Avatar size='large' placeholderType='person' className='mb-4' />
                    <p className='mb-4 text-base font-medium'>
                      {t('Settings.Select or drag image here')}
                    </p>
                  </div>
                  <input
                    id='dropzone-file'
                    type='file'
                    className='hidden'
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className='py-3'>
                <div className='rounded-md border-2 border-gray-400 bg-gray-200 dark:bg-gray-700 dark:border-gray-500'>
                  <div className='flex items-center justify-between py-4 pl-3 pr-4'>
                    <div className='flex w-0 flex-1 items-center pl-2'>
                      <div className='h-9 w-9 bg-gray-100 dark:bg-gray-800 flex items-center rounded justify-center'>
                        <Avatar
                          size='extra_small'
                          placeholderType='person'
                          className='text-gray-600 dark:text-gray-300'
                        />
                      </div>
                      <div className='text-base flex flex-col pl-3'>
                        <span className='font-semibold text-gray-900 dark:text-gray-100'>
                          {selectedFile.name}
                        </span>
                        <span className='text-sm'>{formatFileSize(selectedFile.size)}</span>
                      </div>
                    </div>
                    <div className='ml-4 flex-shrink-0'>
                      <Button variant='ghost' onClick={() => deleteUploadedAnnouncement()}>
                        <FontAwesomeIcon
                          icon={faXmark}
                          className='h-4 w-4 text-gray-400 dark:text-gray-400'
                          aria-hidden='true'
                        />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>

        {previewImage && (
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
        )}
        {/* Divider */}
        <div className='relative pb-10 pt-6'>
          <div className='absolute inset-0 flex items-center' aria-hidden='true'>
            <div className='w-full border-t border-gray-300 dark:border-gray-600' />
          </div>
        </div>
        <div className={`${previewImage ? '' : 'pt-8'} flex items-center justify-end`}>
          <Button variant='ghost' type='submit' onClick={closeSideDrawer} className='mb-4'>
            {t('Common.Cancel')}
          </Button>
          <Button
            variant='primary'
            type='submit'
            onClick={prepareUploadPicture}
            className='ml-4 mb-4'
            disabled={isEmpty(selectedFileBase64)}
          >
            {t('Settings.Upload')}
          </Button>
        </div>
      </div>
    </>
  )
})

SelectProfilePictureDrawerContent.displayName = 'SelectProfilePictureDrawerContent'
