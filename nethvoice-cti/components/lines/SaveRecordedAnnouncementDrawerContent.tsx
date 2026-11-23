// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState, useRef, useEffect } from 'react'
import classNames from 'classnames'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { DrawerFooter } from '../common/DrawerFooter'
import { useTranslation } from 'react-i18next'
import { faCircleXmark, faFloppyDisk, faCircleNotch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { closeSideDrawer } from '../../lib/utils'
import { TextInput, Modal } from '../common'
import { enableMsg } from '../../lib/lines'
import { InlineNotification } from '../common'
import { store } from '../../store'

export interface SaveRecordedAnnouncementDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const SaveRecordedAnnouncementDrawerContent = forwardRef<
  HTMLButtonElement,
  SaveRecordedAnnouncementDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const { t } = useTranslation()
  const [textFilter, setTextFilter] = useState('')
  const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const [announcementSaveSuccess, setAnnouncementSaveSuccess] = useState<boolean>(false)
  const [announcementSaveError, setAnnouncementSaveError] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const dateRuleInformations = [
    { id: 'public', value: t('Lines.Public') },
    { id: 'private', value: t('Lines.Private') },
  ]

  const clearTextFilter = () => {
    setTextFilter('')
    textFilterRef.current.focus()
  }

  const [modalAnnouncementType, setModalAnnouncementType] = useState('private')

  function changeAnnouncementModalTypeSelected(event: any) {
    const radioButtonTypeSelected = event.target.id
    setModalAnnouncementType(radioButtonTypeSelected)
  }

  const enableAnnouncement = async () => {
    let objectEnableAnnouncement = {
      description: textFilter,
      privacy: modalAnnouncementType,
      tempFilename: config.recordedFilename,
    }
    try {
      setIsSaving(true)
      await enableMsg(objectEnableAnnouncement)
      setAnnouncementSaveSuccess(true)
      setTimeout(() => {
        config.announcementSavedCallback()
      }, 1000)
    } catch (error) {
      setIsSaving(false)
      setAnnouncementSaveError(true)
      return
    }
    store.dispatch.sideDrawer.setAvoidClose(false)
  }

  useEffect(() => {
    return () => {
      setAnnouncementSaveSuccess(false)
      setAnnouncementSaveError(false)
    }
  }, [])

  const closeSideDrawerAnnouncement = () => {
    store.dispatch.sideDrawer.setAvoidClose(false)

    closeSideDrawer()
  }

  return (
    <>
      <DrawerHeader title={t('Lines.Save recording')} />
      <div className={classNames(className, 'px-5')} {...props}>
        <Divider />
        {/* announcement name */}
        <div className='flex flex-col'>
          <h4 className='text-base font-medium text-gray-700 dark:text-gray-200 mb-3'>
            {t('Lines.Announcement name')}
          </h4>
          <TextInput
            placeholder={t('Lines.Insert announcement name') || ''}
            defaultValue={textFilter}
            ref={textFilterRef}
            icon={textFilter.length ? faCircleXmark : undefined}
            onIconClick={() => clearTextFilter()}
            trailingIcon={true}
            onChange={(e) => setTextFilter(e.currentTarget.value)}
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
                    className={`h-4 w-4 border-gray-300 text-primary dark:text-primaryDark focus:ring-primaryLight dark:focus:ring-primaryDark ${
                      modalAnnouncementType === dateRuleInformation.id
                        ? 'dark:bg-primaryLight dark:text-primaryDark dark:border-gray-600'
                        : 'dark:bg-gray-700 dark:text-white dark:border-gray-600'
                    }`}
                    onChange={changeAnnouncementModalTypeSelected}
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
          onCancel={closeSideDrawerAnnouncement}
          onConfirm={enableAnnouncement}
          confirmDisabled={!textFilter || isSaving}
          confirmIcon={
            isSaving ? (
              <FontAwesomeIcon icon={faCircleNotch} className='mr-2 h-4 w-4 fa-spin' />
            ) : (
              <FontAwesomeIcon icon={faFloppyDisk} className='mr-2 h-4 w-4' />
            )
          }
        />

        {announcementSaveSuccess && (
          <InlineNotification
            type='success'
            title={`${t('Lines.Announcement successfully saved')}!`}
          ></InlineNotification>
        )}
        {announcementSaveError && (
          <InlineNotification
            type='error'
            title={`${t('Lines.Error saving the announcement')}!`}
          ></InlineNotification>
        )}
      </div>
    </>
  )
})

SaveRecordedAnnouncementDrawerContent.displayName = 'SaveRecordedAnnouncementDrawerContent'
