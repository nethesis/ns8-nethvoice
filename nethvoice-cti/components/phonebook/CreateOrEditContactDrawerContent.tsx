// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { TextInput, InlineNotification, Dropdown, Button, MultiSelectCombobox } from '../common'
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
import { closeSideDrawer, openToast } from '../../lib/utils'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { getShareableGroups, retrieveGroups } from '../../lib/operators'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUsers, faCircleInfo, faCirclePlus, faAngleRight } from '@fortawesome/free-solid-svg-icons'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

const NAME_DETAIL_OPTIONS = [{ key: 'jobtitle', labelKey: 'Phonebook.Job title' }]

const PHONE_FIELD_OPTIONS = [
  { key: 'workphone2', labelKey: 'Phonebook.Work phone 2' },
  { key: 'cellphone2', labelKey: 'Phonebook.Mobile phone 2' },
  { key: 'fax', labelKey: 'Phonebook.Fax' },
  { key: 'homephone', labelKey: 'Phonebook.Home phone' },
  { key: 'otherphone', labelKey: 'Phonebook.Other phone' },
]

const EMAIL_FIELD_OPTIONS = [
  { key: 'homeemail', labelKey: 'Phonebook.Home email' },
  { key: 'otheremail', labelKey: 'Phonebook.Other email' },
]

// "Add field" menu: Address, Social (submenu), Website.
const SOCIAL_FIELD_OPTIONS = [
  { key: 'linkedin', labelKey: 'Phonebook.LinkedIn' },
  { key: 'instagram', labelKey: 'Phonebook.Instagram' },
  { key: 'facebook', labelKey: 'Phonebook.Facebook' },
]

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
    // Only the owner may change the visibility of an existing contact:
    // a non-owner (e.g. admin) can still edit other fields but must not
    // be able to steal a public/group contact by making it private.
    if (!canEditContactVisibility) {
      return
    }
    if (canWritePhonebookVisibility(profile, e.target.id)) {
      setContactVisibility(e.target.id)
    }
  }

  const operatorsStore = useSelector((state: RootState) => state.operators)
  const { username, profile } = useSelector((state: RootState) => state.user)
  const canEditCurrentContact =
    !config?.isEdit || canWritePhonebookContact(profile, config?.contact, username)
  // Visibility can be set freely on create, but on edit only the contact owner
  // may change it (public/group contacts must not be re-assigned by others).
  const canEditContactVisibility = !config?.isEdit || config?.contact?.owner_id === username
  const writableContactVisibilityOptions = contactVisibilityOptions.filter((option) =>
    canWritePhonebookVisibility(profile, option.id),
  )
  const defaultContactVisibility = writableContactVisibilityOptions[0]?.id || 'private'
  const availableGroups = getShareableGroups(operatorsStore?.groups || {}, username)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [sharedGroupsError, setSharedGroupsError] = useState('')

  const firstNameRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const lastNameRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const jobRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const companyRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const extensionRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workPhoneRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workPhone2Ref = useRef() as React.MutableRefObject<HTMLInputElement>
  const mobilePhoneRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const mobilePhone2Ref = useRef() as React.MutableRefObject<HTMLInputElement>
  const emailRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const facebookRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const instagramRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const linkedinRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const notesRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const homePhoneRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const faxRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const otherPhoneRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const websiteRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workStreetRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workCityRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workProvinceRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workPostalCodeRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const workCountryRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const homeEmailRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const otherEmailRef = useRef() as React.MutableRefObject<HTMLInputElement>

  // "Add field" is a hand-rolled dropdown (opens upward, left-aligned) following
  // the shared-groups pattern.
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false)
  const [isSocialSubmenuOpen, setIsSocialSubmenuOpen] = useState(false)
  const addFieldDropdownRef = useRef() as React.MutableRefObject<HTMLDivElement>
  // Delayed-close for the Social flyout: moving the pointer across the small gap
  // between the "Social" item and the flyout would otherwise fire mouseLeave and
  // dismiss it before the pointer reaches the panel.
  const socialSubmenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openSocialSubmenu = () => {
    if (socialSubmenuCloseTimer.current) {
      clearTimeout(socialSubmenuCloseTimer.current)
      socialSubmenuCloseTimer.current = null
    }
    setIsSocialSubmenuOpen(true)
  }
  const scheduleCloseSocialSubmenu = () => {
    if (socialSubmenuCloseTimer.current) {
      clearTimeout(socialSubmenuCloseTimer.current)
    }
    socialSubmenuCloseTimer.current = setTimeout(() => {
      setIsSocialSubmenuOpen(false)
      socialSubmenuCloseTimer.current = null
    }, 200)
  }
  useEffect(() => {
    return () => {
      if (socialSubmenuCloseTimer.current) {
        clearTimeout(socialSubmenuCloseTimer.current)
      }
    }
  }, [])

  // Optional fields are always mounted (so the uncontrolled refs stay valid for
  // init/submit) but hidden until the user reveals them from the "Add phone" /
  // "Add field" menus, matching the redesigned phonebook form.
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
  const isFieldVisible = (key: string) => visibleFields.has(key)
  const showField = (key: string) => {
    setVisibleFields((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  // When a field is revealed from an "Add …" menu the focus should move to the
  // freshly shown input. setVisibleFields is async, so we record the key and let
  // an effect focus the matching ref after the re-render mounts/shows it.
  const [pendingFocusKey, setPendingFocusKey] = useState<string | null>(null)
  const fieldRefByKey: Record<string, React.MutableRefObject<HTMLInputElement>> = {
    jobtitle: jobRef,
    workphone2: workPhone2Ref,
    cellphone2: mobilePhone2Ref,
    fax: faxRef,
    homephone: homePhoneRef,
    otherphone: otherPhoneRef,
    homeemail: homeEmailRef,
    otheremail: otherEmailRef,
    linkedin: linkedinRef,
    instagram: instagramRef,
    facebook: facebookRef,
    address: workStreetRef,
    url: websiteRef,
  }
  // Reveal a field (from the Add menus) and queue focus on its input.
  const revealField = (key: string) => {
    showField(key)
    setPendingFocusKey(key)
  }
  useEffect(() => {
    if (!pendingFocusKey) {
      return
    }
    fieldRefByKey[pendingFocusKey]?.current?.focus()
    setPendingFocusKey(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFields, pendingFocusKey])

  // The backend keeps `name` as the authoritative display field (used by the
  // centralized phonebook, physical-phone export, search and sorting). The
  // redesigned form edits firstname/lastname separately and recomposes `name`
  // on save so those consumers keep working unchanged (issue #7124).
  const composeName = () => {
    const first = firstNameRef?.current?.value?.trim() || ''
    const last = lastNameRef?.current?.value?.trim() || ''
    return `${first} ${last}`.trim()
  }

  const phoneValue = (ref: React.MutableRefObject<HTMLInputElement>) =>
    ref?.current?.value?.replace(/\s+/g, '') || ''

  // Best-effort split of a legacy single `name` into first/last for pre-filling
  // the form only. The stored value is never rewritten until the user saves.
  const splitLegacyName = (fullName: string) => {
    const tokens = (fullName || '').trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) {
      return { firstname: '', lastname: '' }
    }
    if (tokens.length === 1) {
      return { firstname: tokens[0], lastname: '' }
    }
    return { firstname: tokens.slice(0, -1).join(' '), lastname: tokens[tokens.length - 1] }
  }
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
    if (!isAddFieldOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        addFieldDropdownRef.current &&
        !addFieldDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAddFieldOpen(false)
        setIsSocialSubmenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAddFieldOpen])

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
      // Prefer explicit firstname/lastname; fall back to splitting the legacy
      // single `name` so older contacts edit cleanly without data loss.
      if (config.contact.firstname || config.contact.lastname) {
        firstNameRef.current.value = config.contact.firstname || ''
        lastNameRef.current.value = config.contact.lastname || ''
      } else {
        const split = splitLegacyName(config.contact.name || '')
        firstNameRef.current.value = split.firstname
        lastNameRef.current.value = split.lastname
      }
      jobRef.current.value = config.contact.job || ''
      companyRef.current.value = config.contact.company || ''
      facebookRef.current.value = config.contact.facebook || ''
      instagramRef.current.value = config.contact.instagram || ''
      linkedinRef.current.value = config.contact.linkedin || ''

      if (!config.contact.phone) {
        // User is editing a contact
        extensionRef.current.value = config.contact.extension || ''
        workPhoneRef.current.value = config.contact.workphone || ''
        workPhone2Ref.current.value = config.contact.workphone2 || ''
        mobilePhoneRef.current.value = config.contact.cellphone || ''
        mobilePhone2Ref.current.value = config.contact.cellphone2 || ''
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
        workPhone2Ref.current.value = config.contact.workphone2 || ''
        mobilePhone2Ref.current.value = config.contact.cellphone2 || ''
      }
      emailRef.current.value = config.contact.workemail || ''
      notesRef.current.value = config.contact.notes || ''
      homePhoneRef.current.value = config.contact.homephone || ''
      faxRef.current.value = config.contact.fax || ''
      otherPhoneRef.current.value = config.contact.otherphone || ''
      websiteRef.current.value = config.contact.url || ''
      workStreetRef.current.value = config.contact.workstreet || ''
      workCityRef.current.value = config.contact.workcity || ''
      workProvinceRef.current.value = config.contact.workprovince || ''
      workPostalCodeRef.current.value = config.contact.workpostalcode || ''
      workCountryRef.current.value = config.contact.workcountry || ''
      homeEmailRef.current.value = config.contact.homeemail || ''
      otherEmailRef.current.value = config.contact.otheremail || ''

      // Reveal the optional fields that already carry a value so editing an
      // existing contact never hides its data. Work/Mobile phone and Email are
      // always visible, so they are not tracked here.
      const vis = new Set<string>()
      if (jobRef.current.value) vis.add('jobtitle')
      if (mobilePhone2Ref.current.value) vis.add('cellphone2')
      if (workPhone2Ref.current.value) vis.add('workphone2')
      if (homePhoneRef.current.value) vis.add('homephone')
      if (faxRef.current.value) vis.add('fax')
      if (otherPhoneRef.current.value) vis.add('otherphone')
      if (homeEmailRef.current.value) vis.add('homeemail')
      if (otherEmailRef.current.value) vis.add('otheremail')
      if (websiteRef.current.value) vis.add('url')
      if (linkedinRef.current.value) vis.add('linkedin')
      if (instagramRef.current.value) vis.add('instagram')
      if (facebookRef.current.value) vis.add('facebook')
      if (
        workStreetRef.current.value ||
        workCityRef.current.value ||
        workProvinceRef.current.value ||
        workPostalCodeRef.current.value ||
        workCountryRef.current.value
      ) {
        vis.add('address')
      }
      setVisibleFields(vis)
    } else if (config?.isCreateContactUserLastCalls) {
      setContactType('person')
      setContactVisibility(defaultContactVisibility)
      setSelectedGroups([])

      firstNameRef.current.value = ''
      lastNameRef.current.value = ''
      jobRef.current.value = ''
      companyRef.current.value = ''
      extensionRef.current.value = config?.contact?.extension || ''
      workPhoneRef.current.value = ''
      workPhone2Ref.current.value = ''
      mobilePhoneRef.current.value = ''
      mobilePhone2Ref.current.value = ''
      emailRef.current.value = ''
      facebookRef.current.value = ''
      instagramRef.current.value = ''
      linkedinRef.current.value = ''
      notesRef.current.value = ''
      homePhoneRef.current.value = ''
      faxRef.current.value = ''
      otherPhoneRef.current.value = ''
      websiteRef.current.value = ''
      workStreetRef.current.value = ''
      workCityRef.current.value = ''
      workProvinceRef.current.value = ''
      workPostalCodeRef.current.value = ''
      workCountryRef.current.value = ''
      homeEmailRef.current.value = ''
      otherEmailRef.current.value = ''
      setVisibleFields(new Set())
    } else {
      // creating contact
      setContactType('person')
      setContactVisibility(defaultContactVisibility)
      setSelectedGroups([])
      firstNameRef.current.value = ''
      lastNameRef.current.value = ''
      jobRef.current.value = ''
      companyRef.current.value = ''
      extensionRef.current.value = ''
      if (config.contact) {
        workPhoneRef.current.value = config.contact
      } else {
        workPhoneRef.current.value = ''
      }
      workPhone2Ref.current.value = ''
      mobilePhoneRef.current.value = ''
      mobilePhone2Ref.current.value = ''
      emailRef.current.value = ''
      facebookRef.current.value = ''
      instagramRef.current.value = ''
      linkedinRef.current.value = ''
      notesRef.current.value = ''
      homePhoneRef.current.value = ''
      faxRef.current.value = ''
      otherPhoneRef.current.value = ''
      websiteRef.current.value = ''
      workStreetRef.current.value = ''
      workCityRef.current.value = ''
      workProvinceRef.current.value = ''
      workPostalCodeRef.current.value = ''
      workCountryRef.current.value = ''
      homeEmailRef.current.value = ''
      otherEmailRef.current.value = ''
      setVisibleFields(new Set())
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

    // name (a person needs at least a first/last name or a company)
    if (
      contactType === 'person' &&
      !firstNameRef?.current?.value?.trim() &&
      !lastNameRef?.current?.value?.trim() &&
      !companyRef?.current?.value?.trim()
    ) {
      setNameError(String(t('Common.Required') || ''))

      if (isValidationOk) {
        firstNameRef?.current?.focus()
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

    // `name` is always derived from first/last name (persons) or a sentinel for
    // companies. It stays authoritative for Asterisk caller resolution.
    const composedName = composeName()

    if (contactType === 'person' && composedName) {
      contactData.name = composedName
    } else if (contactType === 'company') {
      contactData.name = '-'
    }

    if (contactType === 'person' && firstNameRef.current?.value) {
      contactData.firstname = firstNameRef.current.value
    }

    if (contactType === 'person' && lastNameRef.current?.value) {
      contactData.lastname = lastNameRef.current.value
    }

    if (contactType === 'person' && jobRef.current?.value) {
      contactData.job = jobRef.current.value
    }

    if (companyRef.current.value) {
      contactData.company = companyRef?.current?.value
    }

    if (phoneValue(extensionRef)) {
      contactData.extension = phoneValue(extensionRef)
    }

    if (phoneValue(workPhoneRef)) {
      contactData.workphone = phoneValue(workPhoneRef)
    }

    if (phoneValue(workPhone2Ref)) {
      contactData.workphone2 = phoneValue(workPhone2Ref)
    }

    if (phoneValue(mobilePhoneRef)) {
      contactData.cellphone = phoneValue(mobilePhoneRef)
    }

    if (phoneValue(mobilePhone2Ref)) {
      contactData.cellphone2 = phoneValue(mobilePhone2Ref)
    }

    if (emailRef.current.value) {
      contactData.workemail = emailRef?.current?.value
    }

    if (homeEmailRef.current.value) {
      contactData.homeemail = homeEmailRef?.current?.value
    }

    if (otherEmailRef.current.value) {
      contactData.otheremail = otherEmailRef?.current?.value
    }

    if (facebookRef.current.value) {
      contactData.facebook = facebookRef?.current?.value
    }

    if (instagramRef.current.value) {
      contactData.instagram = instagramRef?.current?.value
    }

    if (linkedinRef.current.value) {
      contactData.linkedin = linkedinRef?.current?.value
    }

    if (notesRef.current.value) {
      contactData.notes = notesRef?.current?.value
    }

    if (phoneValue(homePhoneRef)) {
      contactData.homephone = phoneValue(homePhoneRef)
    }

    if (phoneValue(faxRef)) {
      contactData.fax = phoneValue(faxRef)
    }

    if (phoneValue(otherPhoneRef)) {
      contactData.otherphone = phoneValue(otherPhoneRef)
    }

    if (websiteRef.current.value) {
      contactData.url = websiteRef?.current?.value
    }

    if (workStreetRef.current.value) {
      contactData.workstreet = workStreetRef?.current?.value
    }

    if (workCityRef.current.value) {
      contactData.workcity = workCityRef?.current?.value
    }

    if (workProvinceRef.current.value) {
      contactData.workprovince = workProvinceRef?.current?.value
    }

    if (workPostalCodeRef.current.value) {
      contactData.workpostalcode = workPostalCodeRef?.current?.value
    }

    if (workCountryRef.current.value) {
      contactData.workcountry = workCountryRef?.current?.value
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
      firstname: contactType === 'person' ? firstNameRef?.current?.value || null : null,
      lastname: contactType === 'person' ? lastNameRef?.current?.value || null : null,
      job: contactType === 'person' ? jobRef?.current?.value || null : null,
      company: companyRef?.current?.value || null,
      extension: phoneValue(extensionRef) || null,
      workphone: phoneValue(workPhoneRef),
      workphone2: phoneValue(workPhone2Ref) || null,
      cellphone: phoneValue(mobilePhoneRef) || null,
      cellphone2: phoneValue(mobilePhone2Ref) || null,
      workemail: emailRef?.current?.value || null,
      facebook: facebookRef?.current?.value || null,
      instagram: instagramRef?.current?.value || null,
      linkedin: linkedinRef?.current?.value || null,
      notes: notesRef?.current?.value || null,
      homephone: phoneValue(homePhoneRef) || null,
      fax: phoneValue(faxRef) || null,
      otherphone: phoneValue(otherPhoneRef) || null,
      url: websiteRef?.current?.value || null,
      workstreet: workStreetRef?.current?.value || null,
      workcity: workCityRef?.current?.value || null,
      workprovince: workProvinceRef?.current?.value || null,
      workpostalcode: workPostalCodeRef?.current?.value || null,
      workcountry: workCountryRef?.current?.value || null,
      homeemail: homeEmailRef?.current?.value || null,
      otheremail: otherEmailRef?.current?.value || null,
      title: config?.contact?.title,
      homestreet: config?.contact?.homestreet,
      homepob: config?.contact?.homepob,
      homecity: config?.contact?.homecity,
      homeprovince: config?.contact?.homeprovince,
      homepostalcode: config?.contact?.homepostalcode,
      homecountry: config?.contact?.homecountry,
      workpob: config?.contact?.workpob,
    }

    // `name` is always derived from first/last name (persons) or kept as the
    // sentinel for companies, so it never diverges from the visible fields and
    // stays authoritative for Asterisk caller resolution.
    if (contactType === 'person') {
      contactData.name = composeName()
    } else {
      contactData.name = '-'
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
    const composedName = composeName()
    const contactName =
      contactType === 'person' && composedName
        ? composedName
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
                    disabled={!canEditContactVisibility}
                    className={classNames(
                      'h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark',
                      !canEditContactVisibility && 'opacity-50 cursor-not-allowed',
                    )}
                  />
                  <label
                    htmlFor={option?.id}
                    className={classNames(
                      'ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200',
                      !canEditContactVisibility && 'opacity-50 cursor-not-allowed',
                    )}
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
            <MultiSelectCombobox
              className='mt-2'
              options={availableGroups}
              selected={selectedGroups}
              onChange={setSelectedGroups}
              optionIcon={faUsers}
              placeholder={String(t('Phonebook.Choose one or more groups') || '')}
              noOptionsText={String(t('Phonebook.No groups available') || '')}
              error={!!sharedGroupsError}
              removeLabel={(groupName) => `${t('Common.Delete')} ${groupName}`}
            />
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
            <div className='space-y-3'>
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
        {/* contact fields — flat list, 32px rhythm (Figma space/8) */}
        <div className='flex flex-col gap-8'>
          <div className={contactType === 'company' ? 'hidden' : ''}>
            <TextInput
              label={t('Phonebook.First name') || ''}
              name='firstname'
              ref={firstNameRef}
              placeholder={t('Phonebook.First name placeholder') || ''}
              error={!!nameError}
              helper={nameError}
            />
          </div>
          <div className={contactType === 'company' ? 'hidden' : ''}>
            <TextInput
              label={t('Phonebook.Last name') || ''}
              name='lastname'
              ref={lastNameRef}
              placeholder={t('Phonebook.Last name placeholder') || ''}
            />
          </div>

          <TextInput
            label={t('Phonebook.Company') || ''}
            name='company'
            ref={companyRef}
            error={!!companyError}
            helper={companyError}
          />

          <div className={contactType !== 'company' && isFieldVisible('jobtitle') ? '' : 'hidden'}>
            <TextInput label={t('Phonebook.Job title') || ''} name='job' ref={jobRef} />
          </div>

          {contactType !== 'company' &&
            (NAME_DETAIL_OPTIONS.some((o) => !isFieldVisible(o.key)) ? (
              <Dropdown
                position='topLeft'
                className='self-start -mt-4'
                items={
                  <>
                    {NAME_DETAIL_OPTIONS.filter((o) => !isFieldVisible(o.key)).map((o) => (
                      <Dropdown.Item key={o.key} onClick={() => revealField(o.key)}>
                        {t(o.labelKey)}
                      </Dropdown.Item>
                    ))}
                  </>
                }
              >
                <Button variant='ghost' size='base' type='button' className='gap-2'>
                  <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
                  {t('Phonebook.Add name details')}
                </Button>
              </Dropdown>
            ) : (
              <Button
                variant='ghost'
                size='base'
                type='button'
                disabled
                className='gap-2 self-start -mt-4'
              >
                <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
                {t('Phonebook.Add name details')}
              </Button>
            ))}

          <TextInput
            label={t('Phonebook.Extension') || ''}
            name='extension'
            ref={extensionRef}
            placeholder={t('Phonebook.Extension placeholder') || ''}
            helper={t('Phonebook.Extension helper') || ''}
          />

          <TextInput
            label={t('Phonebook.Work phone') || ''}
            name='workPhone'
            ref={workPhoneRef}
            placeholder={t('Phonebook.Work phone placeholder') || ''}
          />

          <TextInput
            label={t('Phonebook.Mobile phone') || ''}
            name='mobilePhone'
            ref={mobilePhoneRef}
            placeholder={t('Phonebook.Mobile phone placeholder') || ''}
          />
          <div className={isFieldVisible('workphone2') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Work phone 2') || ''}
              name='workPhone2'
              ref={workPhone2Ref}
              placeholder={t('Phonebook.Work phone placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('cellphone2') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Mobile phone 2') || ''}
              name='mobilePhone2'
              ref={mobilePhone2Ref}
              placeholder={t('Phonebook.Mobile phone placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('fax') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Fax') || ''}
              name='fax'
              ref={faxRef}
              placeholder={t('Phonebook.Work phone placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('homephone') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Home phone') || ''}
              name='homePhone'
              ref={homePhoneRef}
              placeholder={t('Phonebook.Work phone placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('otherphone') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Other phone') || ''}
              name='otherPhone'
              ref={otherPhoneRef}
              placeholder={t('Phonebook.Work phone placeholder') || ''}
            />
          </div>
          {PHONE_FIELD_OPTIONS.some((o) => !isFieldVisible(o.key)) ? (
            <Dropdown
              position='topLeft'
              className='self-start -mt-4'
              items={
                <>
                  {PHONE_FIELD_OPTIONS.filter((o) => !isFieldVisible(o.key)).map((o) => (
                    <Dropdown.Item key={o.key} onClick={() => revealField(o.key)}>
                      {t(o.labelKey)}
                    </Dropdown.Item>
                  ))}
                </>
              }
            >
              <Button variant='ghost' size='base' type='button' className='gap-2'>
                <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
                {t('Phonebook.Add phone')}
              </Button>
            </Dropdown>
          ) : (
            <Button
              variant='ghost'
              size='base'
              type='button'
              disabled
              className='gap-2 self-start -mt-4'
            >
              <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
              {t('Phonebook.Add phone')}
            </Button>
          )}

          <TextInput
            label={t('Phonebook.Email') || ''}
            name='email'
            ref={emailRef}
            placeholder={t('Phonebook.Email placeholder') || ''}
          />
          <div className={isFieldVisible('homeemail') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Home email') || ''}
              name='homeemail'
              ref={homeEmailRef}
              placeholder={t('Phonebook.Email placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('otheremail') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Other email') || ''}
              name='otheremail'
              ref={otherEmailRef}
              placeholder={t('Phonebook.Other email placeholder') || ''}
            />
          </div>
          {EMAIL_FIELD_OPTIONS.some((o) => !isFieldVisible(o.key)) ? (
            <Dropdown
              position='topLeft'
              className='self-start -mt-4'
              items={
                <>
                  {EMAIL_FIELD_OPTIONS.filter((o) => !isFieldVisible(o.key)).map((o) => (
                    <Dropdown.Item key={o.key} onClick={() => revealField(o.key)}>
                      {t(o.labelKey)}
                    </Dropdown.Item>
                  ))}
                </>
              }
            >
              <Button variant='ghost' size='base' type='button' className='gap-2'>
                <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
                {t('Phonebook.Add email')}
              </Button>
            </Dropdown>
          ) : (
            <Button
              variant='ghost'
              size='base'
              type='button'
              disabled
              className='gap-2 self-start -mt-4'
            >
              <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
              {t('Phonebook.Add email')}
            </Button>
          )}

          <TextInput label={t('Phonebook.Notes') || ''} name='notes' ref={notesRef} />

          {/* Company address sub-form (16px internal) */}
          <div className={isFieldVisible('address') ? 'flex flex-col gap-4' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Address') || ''}
              name='workstreet'
              ref={workStreetRef}
              placeholder={t('Phonebook.Address placeholder') || ''}
            />
            <TextInput
              label={t('Phonebook.City') || ''}
              name='workcity'
              ref={workCityRef}
              placeholder={t('Phonebook.City placeholder') || ''}
            />
            <div className='grid grid-cols-2 gap-4'>
              <TextInput
                label={t('Phonebook.Province') || ''}
                name='workprovince'
                ref={workProvinceRef}
                placeholder={t('Phonebook.Province placeholder') || ''}
              />
              <TextInput
                label={t('Phonebook.Postal code') || ''}
                name='workpostalcode'
                ref={workPostalCodeRef}
                placeholder={t('Phonebook.Postal code placeholder') || ''}
              />
            </div>
            <TextInput
              label={t('Phonebook.Country') || ''}
              name='workcountry'
              ref={workCountryRef}
              placeholder={t('Phonebook.Country placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('linkedin') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.LinkedIn') || ''}
              name='linkedin'
              ref={linkedinRef}
              placeholder={t('Phonebook.LinkedIn placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('instagram') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Instagram') || ''}
              name='instagram'
              ref={instagramRef}
              placeholder={t('Phonebook.Instagram placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('facebook') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Facebook') || ''}
              name='facebook'
              ref={facebookRef}
              placeholder={t('Phonebook.Facebook placeholder') || ''}
            />
          </div>
          <div className={isFieldVisible('url') ? '' : 'hidden'}>
            <TextInput
              label={t('Phonebook.Website') || ''}
              name='website'
              ref={websiteRef}
              placeholder={t('Phonebook.Website placeholder') || ''}
            />
          </div>
          {/* Add field menu (Address, Social flyout, Website) — opens upward, left-aligned */}
          <div className='relative self-start -mt-4' ref={addFieldDropdownRef}>
            <Button
              variant='ghost'
              size='base'
              type='button'
              className='gap-2'
              disabled={
                isFieldVisible('address') &&
                isFieldVisible('url') &&
                SOCIAL_FIELD_OPTIONS.every((o) => isFieldVisible(o.key))
              }
              onClick={() =>
                setIsAddFieldOpen((open) => {
                  if (open) {
                    setIsSocialSubmenuOpen(false)
                  }
                  return !open
                })
              }
            >
              <FontAwesomeIcon icon={faCirclePlus} className='h-4 w-4' />
              {t('Phonebook.Add field')}
            </Button>
            {isAddFieldOpen && (
              <div className='absolute bottom-full left-0 z-20 mb-2 w-56 rounded-md border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900'>
                {!isFieldVisible('address') && (
                  <button
                    type='button'
                    className='block w-full px-4 py-2 text-left text-sm text-secondaryNeutral transition hover:bg-gray-100 dark:text-secondaryNeutralDark dark:hover:bg-gray-800'
                    onClick={() => {
                      revealField('address')
                      setIsAddFieldOpen(false)
                      setIsSocialSubmenuOpen(false)
                    }}
                  >
                    {t('Phonebook.Address')}
                  </button>
                )}
                {SOCIAL_FIELD_OPTIONS.some((o) => !isFieldVisible(o.key)) && (
                  <div
                    className='relative'
                    onMouseEnter={openSocialSubmenu}
                    onMouseLeave={scheduleCloseSocialSubmenu}
                  >
                    <button
                      type='button'
                      className='flex w-full items-center justify-between px-4 py-2 text-left text-sm text-secondaryNeutral transition hover:bg-gray-100 dark:text-secondaryNeutralDark dark:hover:bg-gray-800'
                      aria-haspopup='menu'
                      aria-expanded={isSocialSubmenuOpen}
                      onClick={() => (isSocialSubmenuOpen ? setIsSocialSubmenuOpen(false) : openSocialSubmenu())}
                    >
                      <span>{t('Phonebook.Social')}</span>
                      <FontAwesomeIcon icon={faAngleRight} className='h-3 w-3' />
                    </button>
                    {isSocialSubmenuOpen && (
                      <div className='absolute left-full top-0 z-30 w-56 rounded-md border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900'>
                        {SOCIAL_FIELD_OPTIONS.filter((o) => !isFieldVisible(o.key)).map((o) => (
                          <button
                            key={o.key}
                            type='button'
                            className='block w-full px-4 py-2 text-left text-sm text-secondaryNeutral transition hover:bg-gray-100 dark:text-secondaryNeutralDark dark:hover:bg-gray-800'
                            onClick={() => {
                              revealField(o.key)
                              setIsSocialSubmenuOpen(false)
                              setIsAddFieldOpen(false)
                            }}
                          >
                            {t(o.labelKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!isFieldVisible('url') && (
                  <button
                    type='button'
                    className='block w-full px-4 py-2 text-left text-sm text-secondaryNeutral transition hover:bg-gray-100 dark:text-secondaryNeutralDark dark:hover:bg-gray-800'
                    onClick={() => {
                      revealField('url')
                      setIsAddFieldOpen(false)
                      setIsSocialSubmenuOpen(false)
                    }}
                  >
                    {t('Phonebook.Website')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
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
