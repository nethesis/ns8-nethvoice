// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { TextInput, InlineNotification, Badge } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { DrawerFooter } from '../common/DrawerFooter'
import { useState, useRef, useEffect } from 'react'
import {
  createContact,
  editContact,
  reloadPhonebook,
  fetchContact,
  getContactSharedGroups,
  getContactVisibility,
  canWritePhonebookContact,
  canWritePhonebookVisibility,
  serializeSharedGroups,
} from '../../lib/phonebook'
import { closeSideDrawer, customScrollbarClass, openToast } from '../../lib/utils'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { getShareableGroups, retrieveGroups } from '../../lib/operators'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faUsers, faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

export interface CreateOrEditContactDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const CreateOrEditContactDrawerContent = forwardRef<
  HTMLButtonElement,
  CreateOrEditContactDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const contactTypeOptions = [
    {
      id: 'person',
      title: t('Phonebook.Person'),
    },
    {
      id: 'company',
      title: t('Phonebook.Company'),
    },
  ]

  const contactVisibilityOptions = [
    {
      id: 'public',
      title: t('Phonebook.Public'),
    },
    {
      id: 'private',
      title: t('Phonebook.Private'),
    },
    {
      id: 'group',
      title: t('Phonebook.Group'),
    },
  ]

  const [contactType, setContactType]: any = useState('person')
  const onContactTypeChanged = (e: any) => {
    setContactType(e.target.id)
  }

  const [contactVisibility, setContactVisibility]: any = useState('public')
  const onContactVisibilityChanged = (e: any) => {
    if (canWritePhonebookVisibility(profile, e.target.id)) {
      setContactVisibility(e.target.id)
    }
  }

  const operatorsStore = useSelector((state: RootState) => state.operators)
  const { username, profile } = useSelector((state: RootState) => state.user)
  const canEditCurrentContact =
    !config?.isEdit || canWritePhonebookContact(profile, config?.contact, username)
  const writableContactVisibilityOptions = contactVisibilityOptions.filter((option) =>
    canWritePhonebookVisibility(profile, option.id),
  )
  const defaultContactVisibility = writableContactVisibilityOptions[0]?.id || 'private'
  const availableGroups = getShareableGroups(operatorsStore?.groups || {}, username)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [sharedGroupsError, setSharedGroupsError] = useState('')
  const [isSharedGroupsDropdownOpen, setIsSharedGroupsDropdownOpen] = useState(false)
  const sharedGroupsDropdownRef = useRef() as React.MutableRefObject<HTMLDivElement>

  const toggleSharedGroup = (groupName: string) => {
    setSelectedGroups((currentGroups) =>
      currentGroups.includes(groupName)
        ? currentGroups.filter((currentGroup) => currentGroup !== groupName)
        : [...currentGroups, groupName],
    )
  }

  const nameRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const companyRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const extensionRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workPhoneRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const mobilePhoneRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const emailRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const notesRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const formInitializationKeyRef = useRef('')
  const formInitializationKey = config?.isEdit
    ? `edit:${config?.contact?.source || ''}:${config?.contact?.id || ''}:${
        config?.contact?.phone || ''
      }`
    : config?.isCreateContactUserLastCalls
    ? `last-calls:${config?.contact?.extension || ''}:${config?.contact?.phone || ''}`
    : `create:${
        typeof config?.contact === 'string'
          ? config.contact
          : config?.contact?.phone || config?.contact?.extension || ''
      }`

  useEffect(() => {
    if (!operatorsStore?.isGroupsLoaded) {
      retrieveGroups()
    }
  }, [operatorsStore?.isGroupsLoaded])

  useEffect(() => {
    if (!isSharedGroupsDropdownOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        sharedGroupsDropdownRef.current &&
        !sharedGroupsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSharedGroupsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSharedGroupsDropdownOpen])

  useEffect(() => {
    if (formInitializationKeyRef.current === formInitializationKey) {
      return
    }

    if (!config?.isEdit && writableContactVisibilityOptions.length === 0) {
      return
    }

    formInitializationKeyRef.current = formInitializationKey

    if (config?.isEdit) {
      // editing contact
      if (config.contact.kind) {
        setContactType(config.contact.kind)
      } else {
        if (config.contact.name) {
          setContactType('person')
        } else {
          setContactType('company')
        }
      }
      const currentVisibility = getContactVisibility(config.contact)
      setContactVisibility(currentVisibility)
      setSelectedGroups(getContactSharedGroups(config.contact))
      nameRef.current.value = config.contact.name || ''
      companyRef.current.value = config.contact.company || ''

      if (!config.contact.phone) {
        // User is editing a contact
        extensionRef.current.value = config.contact.extension || ''
        workPhoneRef.current.value = config.contact.workphone || ''
        mobilePhoneRef.current.value = config.contact.cellphone || ''
      } else {
        // User is adding a number to a contact
        if (!config.contact.workphone) {
          workPhoneRef.current.value = config.contact.phone
          mobilePhoneRef.current.value = config.contact.cellphone || ''
          extensionRef.current.value = config.contact.extension || ''
          workPhoneRef.current.focus()
        } else if (!config.contact.cellphone) {
          workPhoneRef.current.value = config.contact.workphone || ''
          mobilePhoneRef.current.value = config.contact.phone
          extensionRef.current.value = config.contact.extension || ''
          mobilePhoneRef.current.focus()
        } else if (!config.contact.extension) {
          workPhoneRef.current.value = config.contact.workphone || ''
          mobilePhoneRef.current.value = config.contact.cellphone || ''
          extensionRef.current.value = config.contact.phone
          extensionRef.current.focus()
        } else {
          workPhoneRef.current.value = config.contact.workphone || ''
          mobilePhoneRef.current.value = config.contact.cellphone || ''
          extensionRef.current.value = config.contact.extension || ''
        }
      }
      emailRef.current.value = config.contact.workemail || ''
      notesRef.current.value = config.contact.notes || ''
    } else if (config?.isCreateContactUserLastCalls) {
      setContactType('person')
      setContactVisibility(defaultContactVisibility)
      setSelectedGroups([])

      nameRef.current.value = ''
      companyRef.current.value = ''
      extensionRef.current.value = config?.contact?.extension || ''
      workPhoneRef.current.value = ''
      mobilePhoneRef.current.value = ''
      emailRef.current.value = ''
      notesRef.current.value = ''
    } else {
      // creating contact
      setContactType('person')
      setContactVisibility(defaultContactVisibility)
      setSelectedGroups([])
      nameRef.current.value = ''
      companyRef.current.value = ''
      extensionRef.current.value = ''
      if (config.contact) {
        workPhoneRef.current.value = config.contact
      } else {
        workPhoneRef.current.value = ''
      }
      mobilePhoneRef.current.value = ''
      emailRef.current.value = ''
      notesRef.current.value = ''
    }
  }, [
    config,
    defaultContactVisibility,
    formInitializationKey,
    writableContactVisibilityOptions.length,
  ])

  const [nameError, setNameError] = useState('')
  const [companyError, setCompanyError] = useState('')
  const [createContactError, setCreateContactError] = useState('')
  const [editContactError, setEditContactError] = useState('')

  const validateCreateOrEditContact = () => {
    // clear errors
    setNameError('')
    setCompanyError('')
    setCreateContactError('')
    setEditContactError('')
    setSharedGroupsError('')

    let isValidationOk = true

    if (config?.isEdit && !canEditCurrentContact) {
      setEditContactError(String(t('Phonebook.Cannot edit contact') || ''))
      isValidationOk = false
    }

    // name
    if (
      contactType === 'person' &&
      !nameRef?.current?.value?.trim() &&
      !companyRef?.current?.value?.trim()
    ) {
      setNameError(String(t('Common.Required') || ''))

      if (isValidationOk) {
        nameRef?.current?.focus()
        isValidationOk = false
      }
    }

    // company
    if (contactType === 'company' && !companyRef?.current?.value?.trim()) {
      setCompanyError(String(t('Common.Required') || ''))

      if (isValidationOk) {
        companyRef.current.focus()
        isValidationOk = false
      }
    }

    if (contactVisibility === 'group' && selectedGroups.length === 0) {
      setSharedGroupsError(String(t('Common.Required') || ''))
      isValidationOk = false
    }

    if (!canWritePhonebookVisibility(profile, contactVisibility)) {
      if (config?.isEdit) {
        setEditContactError(String(t('Phonebook.Cannot edit contact') || ''))
      } else {
        setCreateContactError(String(t('Phonebook.Cannot create contact') || ''))
      }
      isValidationOk = false
    }

    return isValidationOk
  }

  const prepareCreateContact = async () => {
    if (!validateCreateOrEditContact()) {
      return
    }

    let contactData: any = {
      name: '',
      workphone: '',
      type:
        contactVisibility === 'group' ? serializeSharedGroups(selectedGroups) : contactVisibility,
    }

    if (contactType === 'person' && nameRef?.current?.value) {
      contactData.name = nameRef?.current?.value
    } else if (
      contactType === 'company' &&
      !nameRef?.current?.value &&
      companyRef?.current?.value
    ) {
      contactData.name = '-'
    }

    if (companyRef.current.value) {
      contactData.company = companyRef?.current?.value
    }

    if (extensionRef.current.value) {
      contactData.extension = extensionRef?.current?.value
    }

    if (workPhoneRef.current.value) {
      contactData.workphone = workPhoneRef?.current?.value
    }

    if (mobilePhoneRef.current.value) {
      contactData.cellphone = mobilePhoneRef?.current?.value
    }

    if (emailRef.current.value) {
      contactData.workemail = emailRef?.current?.value
    }

    if (notesRef.current.value) {
      contactData.notes = notesRef?.current?.value
    }

    try {
      await createContact(contactData)
    } catch (error) {
      setCreateContactError(String(t('Phonebook.Cannot create contact') || ''))
      return
    }
    // show toast message
    showToastCreationContact()
    reloadPhonebook()
    closeSideDrawer()
  }

  const prepareEditContact = async () => {
    if (!validateCreateOrEditContact()) {
      return
    }

    let contactData: any = {
      id: config?.contact?.id?.toString(),
      owner_id: config?.contact?.owner_id,
      source: config?.contact?.source,
      speeddial_num: config?.contact?.speeddial_num,
      name: null,
      type:
        contactVisibility === 'group' ? serializeSharedGroups(selectedGroups) : contactVisibility,
      company: companyRef?.current?.value || null,
      extension: extensionRef?.current?.value || null,
      workphone: workPhoneRef?.current?.value || '',
      cellphone: mobilePhoneRef?.current?.value || null,
      workemail: emailRef?.current?.value || null,
      notes: notesRef?.current?.value || null,
      homeemail: config?.contact?.homeemail,
      homephone: config?.contact?.homephone,
      fax: config?.contact?.fax,
      title: config?.contact?.title,
      homestreet: config?.contact?.homestreet,
      homepob: config?.contact?.homepob,
      homecity: config?.contact?.homecity,
      homeprovince: config?.contact?.homeprovince,
      homepostalcode: config?.contact?.homepostalcode,
      homecountry: config?.contact?.homecountry,
      workstreet: config?.contact?.workstreet,
      workpob: config?.contact?.workpob,
      workcity: config?.contact?.workcity,
      workprovince: config?.contact?.workprovince,
      workpostalcode: config?.contact?.workpostalcode,
      workcountry: config?.contact?.workcountry,
      url: config?.contact?.url,
    }

    if (contactType === 'person' && nameRef.current.value) {
      contactData.name = nameRef?.current?.value
    }

    try {
      await editContact(contactData)
    } catch (error) {
      setEditContactError(String(t('Phonebook.Cannot edit contact') || ''))
      return
    }
    // show toast message
    showToastEditContact()
    reloadPhonebook()
    fetchContact(config?.contact?.id, config?.contact?.source)
  }

  const showToastEditContact = () => {
    openToast(
      'success',
      `${t('Phonebook.Contact edit message')}`,
      `${t('Phonebook.Contact edited')}`,
    )
  }

  const showToastCreationContact = () => {
    const contactName =
      contactType === 'person' && nameRef?.current?.value
        ? nameRef.current.value
        : companyRef?.current?.value || t('Phonebook.Contact')

    const message = t('Phonebook.Contact added to phonebook', { name: contactName })

    openToast('success', message, `${t('Phonebook.Contact created')}`)
  }

  return (
    <>
      <DrawerHeader
        title={
          config?.isEdit
            ? config?.contact?.phone
              ? t('Phonebook.Add phone number') + ': ' + config?.contact?.phone
              : t('Phonebook.Edit contact')
            : t('Phonebook.Create contact')
        }
      />
      <div className={classNames(className, 'px-5')} {...props}>
        <Divider />
        {/* contact visibility */}
        <div className='mb-6'>
          <div className='flex items-center'>
            <label className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
              {t('Phonebook.Visibility')}
            </label>
            <FontAwesomeIcon
              icon={faCircleInfo}
              className='ml-2 h-4 w-4 text-iconTooltip dark:text-iconTooltipDark cursor-help'
              data-tooltip-id='visibility-info-tooltip'
              data-tooltip-content={t('Phonebook.Visibility info')}
            />
            <CustomThemedTooltip id='visibility-info-tooltip' place='right' />
          </div>
          <fieldset className='mt-2'>
            <legend className='sr-only'>{t('Phonebook.Visibility')}</legend>
            <div className='space-y-3'>
              {writableContactVisibilityOptions.map((option) => (
                <div key={option?.id} className='flex items-center'>
                  <input
                    id={option?.id}
                    name='contact-visibility'
                    type='radio'
                    checked={option.id === contactVisibility}
                    onChange={onContactVisibilityChanged}
                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                  />
                  <label
                    htmlFor={option?.id}
                    className='ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200'
                  >
                    {option?.title}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        {/* shared groups */}
        {contactVisibility === 'group' && (
          <div className='mb-6'>
            <label className='text-sm font-medium text-gray-700 dark:text-gray-200'>
              {t('Phonebook.Groups')}
            </label>
            <div className='mt-2' ref={sharedGroupsDropdownRef}>
              <button
                type='button'
                className='flex w-full items-center justify-between rounded-md border border-gray-300 bg-bgInput px-3 py-2 text-left text-sm text-gray-500 shadow-sm transition hover:border-primaryLight focus:border-primaryLight focus:outline-none focus:ring-1 focus:ring-primaryLight dark:border-gray-600 dark:bg-bgInputDark dark:text-gray-300 dark:hover:border-primaryDark dark:focus:border-primaryDark dark:focus:ring-primaryDark'
                onClick={() => setIsSharedGroupsDropdownOpen((open) => !open)}
              >
                <span>{t('Phonebook.Choose one or more groups')}</span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={classNames(
                    'h-4 w-4 transition-transform',
                    isSharedGroupsDropdownOpen && 'rotate-180',
                  )}
                  aria-hidden='true'
                />
              </button>
              {isSharedGroupsDropdownOpen && (
                <div
                  className={classNames(
                    'absolute z-20 mt-2 max-h-64 w-[calc(100%-2.5rem)] rounded-md border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900',
                    customScrollbarClass,
                  )}
                >
                  {availableGroups.length > 0 ? (
                    availableGroups.map((groupName) => {
                      const isSelected = selectedGroups.includes(groupName)

                      return (
                        <button
                          key={groupName}
                          type='button'
                          className='flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-secondaryNeutral transition hover:bg-gray-100 dark:text-secondaryNeutralDark dark:hover:bg-gray-800'
                          onClick={() => toggleSharedGroup(groupName)}
                        >
                          <span className='inline-flex h-4 w-4 items-center justify-center text-iconPrimary dark:text-primaryDark'>
                            {isSelected && (
                              <FontAwesomeIcon
                                icon={faCheck}
                                className='h-3.5 w-3.5'
                                aria-hidden='true'
                              />
                            )}
                          </span>
                          <FontAwesomeIcon
                            icon={faUsers}
                            className='h-3.5 w-3.5 text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
                            aria-hidden='true'
                          />
                          <span className='truncate'>{groupName}</span>
                        </button>
                      )
                    })
                  ) : (
                    <p className='px-4 py-2 text-sm text-gray-500 dark:text-gray-400'>
                      {t('Phonebook.No groups available')}
                    </p>
                  )}
                </div>
              )}
            </div>
            {selectedGroups.length > 0 && (
              <div className='mt-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('Phonebook.Selected')}
                  </p>
                  {selectedGroups.map((groupName) => (
                    <Badge
                      key={groupName}
                      variant='enabled'
                      rounded='full'
                      size='small'
                      onRemove={() => toggleSharedGroup(groupName)}
                      removeLabel={`${t('Common.Delete')} ${groupName}`}
                    >
                      {groupName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {sharedGroupsError && (
              <p className='mt-2 text-sm text-rose-600 dark:text-rose-400'>
                {t('Phonebook.Select at least one group')}
              </p>
            )}
          </div>
        )}
        {/* contact type */}
        <div className='mb-6'>
          <label className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
            {t('Phonebook.Type')}
          </label>
          <fieldset className='mt-2'>
            <legend className='sr-only'>{t('Phonebook.Type')}</legend>
            <div className='space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10'>
              {contactTypeOptions.map((option) => (
                <div key={option?.id} className='flex items-center'>
                  <input
                    id={option?.id}
                    name='contact-type'
                    type='radio'
                    checked={option?.id === contactType}
                    onChange={onContactTypeChanged}
                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                  />
                  <label
                    htmlFor={option?.id}
                    className='ml-3 block text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'
                  >
                    {option?.title}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        {/* contact fields */}
        {contactType !== 'company' && (
          <TextInput
            label={t('Phonebook.Name') || ''}
            name='name'
            ref={nameRef}
            className='mb-4'
            error={!!nameError}
            helper={nameError}
          />
        )}
        <TextInput
          label={t('Phonebook.Company') || ''}
          name='company'
          ref={companyRef}
          className='mb-4'
          error={!!companyError}
          helper={companyError}
        />
        <TextInput
          label={t('Phonebook.Extension') || ''}
          name='extension'
          ref={extensionRef}
          className='mb-4'
        />
        <TextInput
          label={t('Phonebook.Work phone') || ''}
          name='workPhone'
          ref={workPhoneRef}
          className='mb-4'
        />
        <TextInput
          label={t('Phonebook.Mobile phone') || ''}
          name='mobilePhone'
          ref={mobilePhoneRef}
          className='mb-4'
        />
        <TextInput
          label={t('Phonebook.Email') || ''}
          name='email'
          ref={emailRef}
          className='mb-4'
        />
        <TextInput
          label={t('Phonebook.Notes') || ''}
          name='notes'
          ref={notesRef}
          className='mb-6'
        />
        {/* create contact error */}
        {createContactError && (
          <InlineNotification type='error' title={createContactError} className='mb-4' />
        )}
        {/* edit contact error */}
        {editContactError && (
          <InlineNotification type='error' title={editContactError} className='mb-4' />
        )}
        {/* Divider */}
        <Divider paddingY='pb-10 pt-6' />

        {config?.isEdit ? (
          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Phonebook.Save contact')}
            onConfirm={prepareEditContact}
            confirmDisabled={!canEditCurrentContact}
          />
        ) : (
          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Phonebook.Create contact')}
            onConfirm={prepareCreateContact}
          />
        )}
      </div>
    </>
  )
})

CreateOrEditContactDrawerContent.displayName = 'CreateOrEditContactDrawerContent'
