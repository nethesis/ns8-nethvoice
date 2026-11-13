// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState, useEffect } from 'react'
import { InlineNotification } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { DrawerFooter } from '../common/DrawerFooter'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faFileArrowUp, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { closeSideDrawer, formatFileSize } from '../../lib/utils'
import { Button } from '../common'
import { reloadAnnouncement, recordingAnnouncement } from '../../lib/lines'
import { RootState } from '../../store'
import { useSelector } from 'react-redux'
import {
  uploadVoicemailGreetingMessage,
  uploadVoicemailGreetingMessageFromFile,
  deleteVoicemailGreetingMessage,
} from '../../services/voicemail'

export interface EditVoicemailContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const UploadVoicemail = forwardRef<HTMLButtonElement, EditVoicemailContentProps>(
  ({ config }) => {
    const { t } = useTranslation()

    const [selectedType, setSelectedType] = useState('greet')
    const [errorUpload, setErrorUpload] = useState(false)
    const [errorFormatMessage, setErrorFormatMessage] = useState('')
    const [selectedFile, setSelectedFile] = useState<any>(null)
    const [selectedFileBase64, setSelectedFileBase64] = useState<any>(null)
    const [uploadAudioMessageError, setUploadAudioMessageError] = useState('')
    const [isValidatingAudio, setIsValidatingAudio] = useState(false)
    const [tempFileName, setTempFileName] = useState<string | null>(null)

    const user = useSelector((state: RootState) => state.user)

    // Load recorded file if available when component mounts
    useEffect(() => {
      if (config.isRecorded && config.tempFileName) {
        // For recorded files, we just store the tempFileName without processing
        setTempFileName(config.tempFileName)
      } else if (config.isRecorded && config.audioFileURL) {
        // Fallback to old behavior if tempFileName is not available
        loadRecordedFile()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.isRecorded, config.audioFileURL, config.tempFileName])

    // Function to load the recorded file from the phone island
    const loadRecordedFile = async () => {
      try {
        // Fetch the file from the URL provided
        const response = await fetch(config.audioFileURL)
        const blob = await response.blob()

        // Create a File object from the blob
        const file = new File([blob], config.tempFileName || 'recorded-audio.wav', {
          type: 'audio/wav',
        })

        // Process the file as if it was uploaded
        await processAudioFile(file)
      } catch (error) {
        console.error('Error loading recorded file:', error)
        setErrorUpload(true)
        setErrorFormatMessage(t('Settings.Could not load recorded file') || '')
      }
    }

    const dateRuleInformations = [
      { id: 'greet', value: t('Settings.Greeating status') },
      { id: 'busy', value: t('Settings.Busy status') },
      { id: 'unavail', value: t('Settings.Unavailable status') },
    ]

    // Function to validate if audio file is playable
    const validateAudioPlayability = (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        setIsValidatingAudio(true)
        const audio = new Audio()
        const fileURL = URL.createObjectURL(file)

        audio.src = fileURL

        // Set up event handlers
        audio.oncanplaythrough = () => {
          URL.revokeObjectURL(fileURL)
          setIsValidatingAudio(false)
          resolve(true)
        }

        audio.onerror = () => {
          URL.revokeObjectURL(fileURL)
          setErrorFormatMessage(t('Settings.The audio file cannot be played') || '')
          setIsValidatingAudio(false)
          resolve(false)
        }

        // Set a timeout in case the file takes too long to load
        setTimeout(() => {
          if (audio.readyState < 3) {
            // 3 = HAVE_FUTURE_DATA
            URL.revokeObjectURL(fileURL)
            setErrorFormatMessage(t('Settings.Audio file validation timed out') || '')
            setIsValidatingAudio(false)
            resolve(false)
          }
        }, 5000) // 5 seconds timeout
      })
    }

    // Function to validate audio file format
    const validateAudioFormat = (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        if (
          !file.type.includes('audio/wav') &&
          !file.type.includes('audio/x-wav') &&
          !file.type.includes('audio/mpeg')
        ) {
          setErrorFormatMessage(t('Settings.File must be in WAV or MP3 format') || '')
          resolve(false)
          return
        }
        // File is valid format
        setErrorFormatMessage('')
        resolve(true)
      })
    }

    // Process audio file - common function for both drop and select
    async function processAudioFile(file: File) {
      if (file && file.type.includes('audio/')) {
        const isValidFormat = await validateAudioFormat(file)

        if (isValidFormat) {
          // Add playability validation
          const isPlayable = await validateAudioPlayability(file)

          if (!isPlayable) {
            setErrorUpload(true)
            setSelectedFile(null)
            setSelectedFileBase64(null)
            return false
          }

          setSelectedFile(file)
          const reader = new FileReader()

          reader.readAsDataURL(file)
          reader.onloadend = () => {
            // Extract pure base64 string by removing the data URL prefix
            const result = reader.result as string
            const base64Content = result.split(',')[1] // Get only the part after the comma
            setSelectedFileBase64(base64Content)
          }
          if (errorUpload) {
            setErrorUpload(false)
          }
          return true
        } else {
          setErrorUpload(true)
          setSelectedFile(null)
          setSelectedFileBase64(null)
          return false
        }
      } else {
        setErrorUpload(true)
        setErrorFormatMessage(t('Settings.File must be an audio file') || '')
        return false
      }
    }

    function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
    }

    async function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
      event.preventDefault()
      event.stopPropagation()

      const file = event.dataTransfer.files && event.dataTransfer.files[0]
      if (file) {
        await processAudioFile(file)
      }
    }

    async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
      event.preventDefault()
      const file = event.target.files && event.target.files[0]
      if (file) {
        await processAudioFile(file)
      }
    }

    function changeTypeSelected(event: any) {
      const radioButtonTypeSelected = event.target.id
      setSelectedType(radioButtonTypeSelected)
    }

    function deleteUploadedAnnouncement() {
      setSelectedFile(null)
      setSelectedFileBase64(null)
      setTempFileName(null)
      setErrorUpload(false)
      setErrorFormatMessage('')
    }

    async function saveCreatePhoneSettings() {
      try {
        // First try to delete any existing greeting message
        try {
          await deleteVoicemailGreetingMessage(selectedType)
          // If deletion succeeds, we can proceed with the upload
        } catch (error) {
          // If deletion fails (e.g., no existing message), we still proceed with the upload
          console.log('Deletion failed, but continuing with upload:', error)
        }

        // Use the new endpoint if we have a tempFileName (recorded file)
        if (tempFileName) {
          await uploadVoicemailGreetingMessageFromFile(selectedType, tempFileName)
        } else if (selectedFileBase64) {
          // Fallback to base64 upload for manually uploaded files
          await uploadVoicemailGreetingMessage(selectedType, selectedFileBase64)
        } else {
          // No file selected
          setUploadAudioMessageError(t('Settings.No file selected') || '')
          return
        }
      } catch (error) {
        setUploadAudioMessageError(t('Settings.Cannot upload message') || '')
        return
      }

      reloadAnnouncement()
      // Call the onClose callback in addition to closing the drawer
      if (config.onClose && typeof config.onClose === 'function') {
        config.onClose()
      }
      closeSideDrawer()
    }

    // Handle closing the drawer with config callback
    const handleClose = () => {
      // Call the onClose callback if provided in config
      if (config.onClose && typeof config.onClose === 'function') {
        config.onClose()
      }
      // Always close the side drawer
      closeSideDrawer()
    }

    //Start recording announcement function
    const startRecordingAnnouncement = () => {
      recordingAnnouncement(user?.default_device?.type)
    }

    return (
      <>
        <DrawerHeader
          title={config.isEdit ? t('Settings.Announcement details') : t('Settings.Upload message')}
          onClose={handleClose}
        />
        <div className='px-5'>
          <Divider />

          {/* Announcement name */}

          {!config.isEdit && !config.isRecorded && (
            <>
              {/* Message name section */}
              <div className='flex items-center justify-between mt-2'>
                <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                  {t('Settings.Audio file')}
                </h4>
              </div>

              {/* Upload error */}
              {errorUpload && (
                <InlineNotification
                  title={errorFormatMessage || t('Settings.Wrong file type')}
                  type='error'
                  className='mt-2'
                ></InlineNotification>
              )}

              {/* Display upload message error if exists */}
              {uploadAudioMessageError && (
                <InlineNotification
                  title={uploadAudioMessageError}
                  type='error'
                  className='mt-2'
                ></InlineNotification>
              )}

              {/* If the file hasn't been uploaded yet */}
              {!selectedFile ? (
                <>
                  <div className='flex flex-col gap-2'>
                    <div className='flex items-center justify-center w-full mt-2'>
                      <label
                        htmlFor='dropzone-file'
                        className={`flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 hover:bg-gray-200 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500 ${
                          isValidatingAudio ? 'opacity-70 pointer-events-none' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <div className='flex flex-col items-center justify-center pt-6 text-gray-600 dark:text-gray-300'>
                          {isValidatingAudio ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className='w-8 h-8 mb-4' />
                              <p className='mb-4 text-base font-medium'>
                                {t('Settings.Validating audio file...')}
                              </p>
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faFileArrowUp} className='w-8 h-8 mb-4' />
                              <p className='mb-4 text-base font-medium'>
                                {t('Settings.Drag and drop or click to upload')}
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          id='dropzone-file'
                          type='file'
                          className='hidden'
                          onChange={handleFileSelect}
                          disabled={isValidatingAudio}
                        />
                      </label>
                    </div>
                    <span className='text-xs font-poppins font-normal text-gray-600 dark:text-gray-100'>
                      {t('Settings.Accepted formats')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className='py-3'>
                    <div className='rounded-md border-2 border-gray-400 bg-gray-200 dark:bg-gray-700 dark:border-gray-500'>
                      <div className='flex items-center justify-between py-4 pl-3 pr-4'>
                        <div className='flex w-0 flex-1 items-center pl-2'>
                          <div className='h-9 w-9 bg-gray-100 dark:bg-gray-800 flex items-center rounded justify-center'>
                            <FontAwesomeIcon
                              icon={faFileArrowUp}
                              className='h-4 w-4 text-gray-600 dark:text-gray-300'
                              aria-hidden='true'
                              onClick={() => startRecordingAnnouncement()}
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
                              className='h-4 w-4 text-gray-600 dark:text-gray-300'
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
          )}

          {/* Privacy name section */}
          <div className='flex items-center justify-between mt-2'>
            <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Settings.Message category')}
            </h4>
          </div>
          {/* Radio button for privacy selection */}
          <fieldset className='mt-2'>
            <div className='space-y-4'>
              {dateRuleInformations.map((dateRuleInformation) => (
                <div
                  key={dateRuleInformation.id}
                  className='flex items-center justify-between mt-1'
                >
                  <div className='flex items-center'>
                    <input
                      id={dateRuleInformation.id}
                      name='date-select'
                      type='radio'
                      defaultChecked={dateRuleInformation.id === 'greet'}
                      className={`h-4 w-4 border-gray-300 text-primary dark:text-primaryDark focus:ring-primary dark:focus:ring-primaryDark ${
                        selectedType === dateRuleInformation.id
                          ? 'dark:bg-primaryLight dark:text-primaryDark dark:border-gray-600'
                          : 'dark:bg-gray-700 dark:text-white dark:border-gray-600'
                      }`}
                      onChange={changeTypeSelected}
                    />
                    <label
                      htmlFor={dateRuleInformation.id}
                      className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
                    >
                      {dateRuleInformation.value}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Divider */}
          <Divider paddingY='pb-10 pt-6' />

          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Common.Save')}
            onCancel={handleClose}
            onConfirm={saveCreatePhoneSettings}
            confirmDisabled={(!selectedFile && !tempFileName) || isValidatingAudio}
          />
        </div>
      </>
    )
  },
)

UploadVoicemail.displayName = 'UploadVoicemail'
