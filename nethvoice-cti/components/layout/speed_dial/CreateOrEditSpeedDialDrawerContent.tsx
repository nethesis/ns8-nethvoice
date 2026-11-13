// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { TextInput, Button, InlineNotification } from '../../common'
import { useState, useRef, useEffect } from 'react'
import { createSpeedDial, editSpeedDial } from '../../../services/phonebook'
import { reloadSpeedDial } from '../../../lib/speedDial'
import { closeSideDrawer } from '../../../lib/utils'
import { openToast } from '../../../lib/utils'
import { DrawerHeader } from '../../common/DrawerHeader'
import { Divider } from '../../common/Divider'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { canCreatePhonebookContacts, canWritePhonebookVisibility } from '../../../lib/phonebook'

export interface CreateOrEditSpeedDialDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const CreateOrEditSpeedDialDrawerContent = forwardRef<
  HTMLButtonElement,
  CreateOrEditSpeedDialDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const { t } = useTranslation()
  const nameRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const phoneNumberRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const { profile } = useSelector((state: RootState) => state.user)
  const canCreateSpeedDials = canCreatePhonebookContacts(profile)
  const canWriteSpeedDials = canWritePhonebookVisibility(profile, 'private')
  const canSaveSpeedDial = config?.isEdit ? canWriteSpeedDials : canCreateSpeedDials

  useEffect(() => {
    if (config?.isEdit) {
      // editing speed dial
      nameRef.current.value = config?.speedDial?.name || ''
      phoneNumberRef.current.value = config?.speedDial?.speeddial_num || ''
    } else {
      // creating speed dial
      nameRef.current.value = ''
      phoneNumberRef.current.value = ''
    }
    nameRef.current.focus()
  }, [config])

  const [nameError, setNameError]: any = useState('')
  const [phoneNumberError, setPhoneNumberError]: any = useState('')
  const [createSpeedDialError, setCreateSpeedDialError] = useState('')
  const [editSpeedDialError, setEditSpeedDialError] = useState('')

  const validateCreateOrEditSpeedDial = () => {
    // clear errors
    setNameError('')
    setPhoneNumberError('')
    setCreateSpeedDialError('')
    setEditSpeedDialError('')

    let isValidationOk = true

    if (!canSaveSpeedDial) {
      if (config?.isEdit) {
        setEditSpeedDialError('Cannot edit speed dial')
      } else {
        setCreateSpeedDialError('Cannot create speed dial')
      }
      isValidationOk = false
    }

    // name
    if (!nameRef.current.value.trim()) {
      setNameError(t('Common.Required'))

      if (isValidationOk) {
        nameRef.current.focus()
        isValidationOk = false
      }
    }

    // phone number
    if (!phoneNumberRef.current.value.trim()) {
      setPhoneNumberError(t('Common.Required'))
      if (isValidationOk) {
        phoneNumberRef.current.focus()
        isValidationOk = false
      }
    } else {
      let speedDialNumber = phoneNumberRef.current.value.trim()
      if (!/[0-9*#+]/.test(speedDialNumber)) {
        setPhoneNumberError(t('Phonebook.Please enter a valid phone number'))
        if (isValidationOk) {
          nameRef.current.focus()
          isValidationOk = false
        }
      }
    }
    return isValidationOk
  }

  const showToastCreationSpeedDial = (extensionWaiting: any) => {
    openToast(
      'success',
      `${t('SpeedDial.Speed dial creation message', { extensionWaiting })}`,
      `${t('SpeedDial.Speed dial created')}`,
    )
  }

  const showToastEditSpeedDial = (extensionWaiting: any) => {
    openToast(
      'success',
      `${t('SpeedDial.Speed dial edit message', { extensionWaiting })}`,
      `${t('SpeedDial.Speed dial edited')}`,
    )
  }

  const prepareCreateSpeedDial = async () => {
    if (!validateCreateOrEditSpeedDial()) {
      return
    }

    try {
      const created = await createSpeedDial({
        name: nameRef.current.value,
        speeddial_num: phoneNumberRef.current.value,
      })
      showToastCreationSpeedDial(nameRef.current.value)
    } catch (error) {
      setCreateSpeedDialError('Cannot create speed dial')
      return
    }

    reloadSpeedDial()
    closeSideDrawer()
  }

  const saveButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Setted focus to save
    if (config.isEdit && saveButtonRef.current) {
      saveButtonRef.current.focus()
    }
  }, [config.isEdit])

  const prepareEditSpeedDial = async () => {
    if (!validateCreateOrEditSpeedDial()) {
      return
    }
    try {
      const edit = await editSpeedDial(
        {
          name: nameRef.current.value,
          speeddial_num: phoneNumberRef.current.value,
        },
        config.speedDial,
      )
      showToastEditSpeedDial(nameRef.current.value)
    } catch (error) {
      setEditSpeedDialError('Cannot edit speed dial')
      return
    }

    //// TODO: show toast notification success

    reloadSpeedDial()
    closeSideDrawer()
  }

  return (
    <>
      <DrawerHeader
        title={
          config?.isEdit
            ? `${t('SpeedDial.Edit speed dial')}`
            : `${t('SpeedDial.Create speed dial')}`
        }
      />
      <div className={classNames(className, 'px-5')} {...props}>
        {/* Divider */}
        <Divider />
        {/* name */}
        <TextInput
          label={t('Phonebook.Name') || ''}
          name='name'
          ref={nameRef}
          className='mb-4'
          error={!!nameError}
          helper={nameError}
        />
        {/* phone number */}
        <TextInput
          label={t('Common.Phone number') || ''}
          name='phoneNumber'
          ref={phoneNumberRef}
          className='mb-6'
          error={!!phoneNumberError}
          helper={phoneNumberError}
        />
        {/* create speed dial error */}
        {createSpeedDialError && (
          <InlineNotification type='error' title={createSpeedDialError} className='mb-6' />
        )}
        {/* edit speed dial error */}
        {editSpeedDialError && (
          <InlineNotification type='error' title={editSpeedDialError} className='mb-6' />
        )}
        {/* Divider */}
        <div className='relative pb-10 pt-6'>
          <div className='absolute inset-0 flex items-center' aria-hidden='true'>
            <div className='w-full border-t border-gray-300 dark:border-gray-600' />
          </div>
        </div>
        <div className='flex items-center justify-end'>
          <Button variant='ghost' type='submit' onClick={closeSideDrawer} className='mb-4'>
            {t('Common.Cancel')}
          </Button>
          {config.isEdit ? (
            <Button
              ref={saveButtonRef}
              variant='primary'
              type='submit'
              onClick={prepareEditSpeedDial}
              className='ml-4 mb-4'
              disabled={!canSaveSpeedDial}
            >
              {t('SpeedDial.Save speed dial')}
            </Button>
          ) : (
            <Button
              variant='primary'
              type='submit'
              onClick={prepareCreateSpeedDial}
              className='ml-4 mb-4'
              disabled={!canSaveSpeedDial}
            >
              {t('SpeedDial.Create speed dial')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
})

CreateOrEditSpeedDialDrawerContent.displayName = 'CreateOrEditSpeedDialDrawerContent'
