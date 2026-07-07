// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  ComponentPropsWithRef,
  forwardRef,
  useEffect,
  useState,
  useRef,
  createRef,
  RefObject,
} from 'react'
import classNames from 'classnames'
import { InlineNotification, Dropdown } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { DrawerFooter } from '../common/DrawerFooter'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEllipsisVertical,
  faTrash,
  faXmark,
  faCircleXmark,
  faFileArrowUp,
} from '@fortawesome/free-solid-svg-icons'
import { closeSideDrawer, formatFileSize } from '../../lib/utils'
import { TextInput, Button, ConfirmationModal } from '../common'
import {
  uploadAudioMsg,
  reloadAnnouncement,
  recordingAnnouncement,
  modifyMsg,
  deleteMsg,
} from '../../lib/lines'
import { store, RootState } from '../../store'
import { useSelector } from 'react-redux'

export interface EditAnnouncementContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const EditAnnouncementDrawerContent = forwardRef<
  HTMLButtonElement,
  EditAnnouncementContentProps
>(({ config, className, ...props }, ref) => {
  const { t } = useTranslation()
  const [errorMessage, setErrorMessage] = useState('')
  const [textFilter, setTextFilter] = useState('')
  const [selectedType, setSelectedType] = useState('private')
  const [errorUpload, setErrorUpload] = useState(false)
  const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [selectedFileBase64, setSelectedFileBase64] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteAnnouncementId, setDeleteAnnouncementId] = useState(null)

  const [uploadAudioMessageError, setUploadAudioMessageError] = useState('')

  const [firstRender, setFirstRender] = useState(true)
  const cancelButtonRef: RefObject<HTMLButtonElement> = createRef()
  const user = useSelector((state: RootState) => state.user)

  const contactMenuItems = (
    <>
      <Dropdown.Item icon={faTrash} onClick={() => deleteAnnouncement(config?.announcement_id)}>
        {t('Common.Delete')}
      </Dropdown.Item>
    </>
  )

  const deleteAnnouncement = (announcementId: any) => {
    setShowDeleteModal(true)
    setDeleteAnnouncementId(announcementId)
  }

  const [deleteAudioMessageError, setDeleteAudioMessageError] = useState('')

  async function closedModalDeleteAnnouncement() {
    if (deleteAnnouncementId) {
      try {
        await deleteMsg(deleteAnnouncementId)
        store.dispatch.announcement.reload()
        closeSideDrawer()
      } catch (error) {
        setDeleteAudioMessageError('Cannot play announcement')
        return
      }
    }
    setShowDeleteModal(false)
  }

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }
    if (config.isEdit) {
      setSelectedType(config.privacy)
      setTextFilter(config.description)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRender])

  const dateRuleInformations = [
    { id: 'public', value: t('Lines.Public') },
    { id: 'private', value: t('Lines.Private') },
  ]

  const clearTextFilter = () => {
    setTextFilter('')
    textFilterRef.current.focus()
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

    if (file && file.type.includes('audio/')) {
      setSelectedFile(file)
      const reader = new FileReader()

      reader.readAsDataURL(file)
      reader.onloadend = () => {
        setSelectedFileBase64(reader.result)
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

    if (file && file.type.includes('audio/')) {
      setSelectedFile(file)
      const reader = new FileReader()

      reader.readAsDataURL(file)
      reader.onloadend = () => {
        setSelectedFileBase64(reader.result)
      }
      if (errorUpload) {
        setErrorUpload(false)
      }
    } else {
      setErrorUpload(true)
    }
  }

  function changeTypeSelected(event: any) {
    const radioButtonTypeSelected = event.target.id
    setSelectedType(radioButtonTypeSelected)
  }

  function deleteUploadedAnnouncement() {
    setSelectedFile(null)
  }

  async function saveCreatePhoneLines() {
    let createAnnouncementObj = {}
    if (textFilter && selectedType && selectedFileBase64) {
      createAnnouncementObj = {
        audio_content: selectedFileBase64,
        description: textFilter,
        privacy: selectedType,
      }
      if (createAnnouncementObj) {
        try {
          await uploadAudioMsg(createAnnouncementObj)
        } catch (error) {
          setUploadAudioMessageError('Cannot upload announcement')
          return
        }
      }
    }
    reloadAnnouncement()
    closeSideDrawer()
  }

  async function saveEditPhoneLines() {
    let editAnnouncementObj = {}
    if (textFilter && selectedType && config.announcement_id) {
      editAnnouncementObj = {
        description: textFilter,
        id: config.announcement_id.toString(),
        privacy: selectedType,
      }

      if (editAnnouncementObj) {
        try {
          await modifyMsg(editAnnouncementObj)
        } catch (error) {
          setUploadAudioMessageError('Cannot edit announcement')
          return
        }
      }
    }
    reloadAnnouncement()
    closeSideDrawer()
  }

  function changeTextFilter(event: any) {
    const newTextFilter = event.target.value
    setTextFilter(newTextFilter)
  }

  //Start recording announcement function
  const startRecordingAnnouncement = () => {
    recordingAnnouncement((user?.default_device?.type))
  }

  return (
    <>
      <DrawerHeader
        title={config.isEdit ? t('Lines.Announcement details') : t('Lines.Add announcement')}
      />
      <div className={classNames(className, 'px-5')} {...props}>
        <Divider />
        {config.isEdit && (
          <div className='flex justify-end'>
            {/* delete announcement Dropdown menu */}
            <Dropdown items={contactMenuItems} position='left' divider={true} className='mr-1'>
              <Button variant='ghost'>
                <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                <span className='sr-only'>Open contact menu</span>
              </Button>
            </Dropdown>
          </div>
        )}

        {/* announcement name */}
        <div className='flex flex-col'>
          <h4 className='text-base font-medium text-gray-700 dark:text-gray-200 mb-3'>
            {t('Lines.Announcement name')}
          </h4>
          <TextInput
            placeholder={t('Lines.Insert announcement name') || ''}
            value={textFilter}
            onChange={changeTextFilter}
            ref={textFilterRef}
            icon={textFilter.length ? faCircleXmark : undefined}
            onIconClick={() => clearTextFilter()}
            trailingIcon={true}
          />
        </div>
        {/* Privacy name section */}
        <div className='flex items-center justify-between mt-8'>
          <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
            {t('Lines.Privacy')}
          </h4>
        </div>
        {/* Radio button for privacy selection */}
        <fieldset className='mt-2'>
          <legend className='sr-only'>Announcement type</legend>
          <div className='space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10'>
            {dateRuleInformations.map((dateRuleInformation) => (
              <div key={dateRuleInformation.id} className='flex items-center justify-between mt-1'>
                <div className='flex items-center'>
                  <input
                    id={dateRuleInformation.id}
                    name='date-select'
                    type='radio'
                    defaultChecked={dateRuleInformation.id === 'private'}
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
        {!config.isEdit && (
          <>
            {/* Announcement name section */}
            <div className='flex items-center justify-between mt-8'>
              <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                {t('Lines.Select audio file')}
              </h4>
            </div>
            {/* Upload announcement section */}
            {/* Upload error */}
            {errorUpload && (
              <InlineNotification
                title={t('Lines.Wrong file type')}
                type='error'
                className='mt-2'
              ></InlineNotification>
            )}
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
                      <FontAwesomeIcon icon={faFileArrowUp} className='w-8 h-8 mb-4' />
                      <p className='mb-4 text-base font-medium'>
                        {t('Lines.Drag and drop or click to upload')}
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

        {/* Divider */}
        <Divider paddingY='pb-10 pt-6' />

        {config.isEdit ? (
          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Common.Save')}
            onConfirm={saveEditPhoneLines}
          />
        ) : (
          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Common.Save')}
            onConfirm={saveCreatePhoneLines}
            confirmDisabled={!selectedFile || !textFilter ? true : false}
          />
        )}
      </div>

      {/* Delete announcement modal */}
      <ConfirmationModal
        show={showDeleteModal}
        focus={cancelButtonRef}
        onClose={() => setShowDeleteModal(false)}
        title={t('Lines.Delete announcement')}
        description={t('Lines.Are you sure to delete selected announcement?')}
        confirmLabel={t('Common.Delete')}
        onConfirm={() => closedModalDeleteAnnouncement()}
      />
    </>
  )
})

EditAnnouncementDrawerContent.displayName = 'EditAnnouncementDrawerContent'
