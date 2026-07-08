// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  ComponentPropsWithRef,
  useEffect,
  forwardRef,
  MutableRefObject,
  useRef,
  useState,
} from 'react'
import classNames from 'classnames'
import { Avatar, Button, Dropdown, Modal, Badge } from '../common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../store'
import { callPhoneNumber, closeSideDrawer, transferCallToExtension } from '../../lib/utils'
import { startOfDay, subDays } from 'date-fns'
import {
  faArrowRight,
  faEllipsisVertical,
  faPen,
  faTriangleExclamation,
  faTrash,
  faUserGroup,
  faUserLock,
} from '@fortawesome/free-solid-svg-icons'
import {
  deleteContact,
  getContact,
  fetchContact,
  getPhonebook,
  getContactVisibilityKind,
  getContactVisibility,
  getContactSharedGroups,
  canWritePhonebookContact,
  mapContact,
  openEditContactDrawer,
  openShowContactDrawer,
  reloadPhonebook,
} from '../../lib/phonebook'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/router'
import { LastCallsDrawerTable } from '../history/LastCallsDrawerTable'
import CopyComponent from '../common/CopyComponent'

export interface ContactSummaryProps extends ComponentPropsWithRef<'div'> {
  contact: any
  isShownContactMenu: boolean
  isShownSideDrawerLink: boolean
  isGlobalSearch?: boolean
}

export const ContactSummary = forwardRef<HTMLButtonElement, ContactSummaryProps>(
  (
    {
      contact,
      isShownContactMenu,
      isShownSideDrawerLink = false,
      isGlobalSearch,
      className,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation()
    const auth = useSelector((state: RootState) => state.authentication)
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
    const [contactToDelete, setContactToDelete] = useState<any>(null)
    const [resolvedCompanyContacts, setResolvedCompanyContacts] = useState<any[]>([])
    const cancelDeleteButtonRef = useRef() as MutableRefObject<HTMLButtonElement>
    const { profile } = useSelector((state: RootState) => state.user)

    const operatorsStore = useSelector((state: RootState) => state.operators)
    const contactVisibility = getContactVisibility(contact)
    const sharedGroups = getContactSharedGroups(contact)
    const showCustomerCardButton =
      !!profile?.macro_permissions?.customer_card?.value &&
      !!(contact?.workphone || contact?.homephone || contact?.cellphone)
    const showLastCalls = !!profile?.macro_permissions?.cdr?.permissions?.ad_cdr?.value

    //Get sideDrawer status from store
    const sideDrawer = useSelector((state: RootState) => state.sideDrawer)

    //Get global search status from store
    const globalSearchStore = useSelector((state: RootState) => state.globalSearch)

    const contactMenuItems = (
      <>
        <Dropdown.Item icon={faPen} onClick={() => openEditContactDrawer(contact)}>
          {t('Common.Edit')}
        </Dropdown.Item>
        <Dropdown.Item icon={faTrash} onClick={() => showDeleteContactModal(contact)}>
          {t('Common.Delete')}
        </Dropdown.Item>
      </>
    )

    const showDeleteContactModal = (contact: any) => {
      setContactToDelete(contact)
      setShowDeleteModal(true)
    }

    const prepareDeleteContact = async () => {
      if (contactToDelete.id) {
        deleteContact(contactToDelete.id.toString())

        //// TODO show toast notification

        reloadPhonebook()
        setShowDeleteModal(false)
        setContactToDelete(null)
        closeSideDrawer()
      }
    }

    const maybeShowSideDrawer = (contact: any) => {
      if (!isShownSideDrawerLink) {
        return
      }
      // close global search
      openShowContactDrawer(contact)
      store.dispatch.globalSearch.setOpen(false)
      store.dispatch.globalSearch.setFocused(false)

      // To avoid blur effect when click on operator information
      store.dispatch.globalSearch.setRightSideTitleClicked(true)
    }

    const router = useRouter()

    function goToCCardCompany(companyExtension: any) {
      let phoneNumber: string = ''
      // companyExtension.kind doesn't exist set person to default
      let contactType = companyExtension?.kind || 'person'

      // Priority: workphone -> cellphone -> homephone
      if (companyExtension.workphone) {
        phoneNumber = companyExtension.workphone
      } else if (companyExtension.cellphone) {
        phoneNumber = companyExtension.cellphone
      } else if (companyExtension.homephone) {
        phoneNumber = companyExtension.homephone
      }

      phoneNumber = phoneNumber.trim()

      // If phoneNumber and contactType is defined, add to customercards path
      if (phoneNumber && contactType) {
        const customerType = 'person'
        const ccardObject = `?${phoneNumber}-${customerType}`

        store.dispatch.customerCards.updateCallerCustomerCardInformation(ccardObject)

        router.push(`/customercards${ccardObject}`)

        // Close side drawer after click open customer cards
        if (sideDrawer?.isShown) {
          store.dispatch.sideDrawer.setShown(false)
        }

        // Close global search after click open customer cards
        if (globalSearchStore?.isOpen) {
          store.dispatch.globalSearch.setOpen(false)
          store.dispatch.globalSearch.setCustomerCardsRedirect(true)
        }
      }
    }

    const [companyInformation, setCompanyInformation] = useState<any>([])
    const showCompanyInformation =
      !!companyInformation?.company || !!companyInformation?.workcity || !!companyInformation?.notes

    const getCompanyContactLabel = (companyContact: any) => {
      const label =
        companyContact?.displayName || companyContact?.name || companyContact?.company || ''

      if (typeof label !== 'string') {
        return '-'
      }

      const normalizedLabel = label.trim()
      return normalizedLabel && normalizedLabel !== '-' ? normalizedLabel : '-'
    }

    // Get all company information
    useEffect(() => {
      async function searchCompanyInformation() {
        if (contact && contact?.kind === 'person' && contact?.company) {
          try {
            //Remove space and slash characters
            let noSlashCharactersCompanyInformation = contact?.company?.replace(/\//g, '')
            const res = await getPhonebook(
              1,
              noSlashCharactersCompanyInformation,
              'company',
              'name',
            )
            let companyAllInformation = res?.rows[0]
            setCompanyInformation(companyAllInformation)
          } catch (e) {
            console.error(e)
            return []
          }
        }
      }
      searchCompanyInformation()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contact])

    useEffect(() => {
      let isMounted = true

      async function resolveCompanyContacts() {
        const companyContacts = Array.isArray(contact?.contacts) ? contact.contacts : []

        if (!companyContacts.length) {
          if (isMounted) {
            setResolvedCompanyContacts([])
          }
          return
        }

        const updatedContacts = await Promise.all(
          companyContacts.map(async (companyContact: any) => {
            if (
              getCompanyContactLabel(companyContact) !== '-' ||
              !companyContact?.id ||
              !companyContact?.source
            ) {
              return companyContact
            }

            try {
              const fullContact = await getContact(companyContact.id, companyContact.source)
              return {
                ...companyContact,
                ...mapContact(fullContact),
              }
            } catch (error) {
              console.error(error)
              return companyContact
            }
          }),
        )

        if (isMounted) {
          setResolvedCompanyContacts(updatedContacts)
        }
      }

      resolveCompanyContacts()

      return () => {
        isMounted = false
      }
    }, [contact?.contacts])

    const companyInformationData = () => {
      return (
        <div className='rounded-md border-gray-600 bg-gray-100 px-5 py-4 dark:border-gray-100 dark:bg-gray-800'>
            {/* Company name  */}
            <h3 className='flex text-sm font-medium leading-5 text-gray-900 dark:text-gray-50'>
              {t('CustomerCards.Business name')}
            </h3>
            <span className='flex pt-2 text-base font-normal text-gray-600 dark:text-gray-300'>
              {companyInformation?.company || '-'}
            </span>

            {/* Company city address */}
            <h3 className='flex text-sm font-medium leading-5 text-gray-900 dark:text-gray-50 pt-8'>
              {t('CustomerCards.City')}
            </h3>
            <span className='flex pt-2 text-base font-normal text-gray-600 dark:text-gray-300'>
              {companyInformation?.workcity || '-'}
            </span>

            {/* Company notes  */}
            <h3 className='flex text-sm font-medium leading-5 text-gray-900 dark:text-gray-50 pt-8'>
              {t('CustomerCards.Notes')}
            </h3>
            <span className='flex pt-2 text-base font-normal text-gray-600 dark:text-gray-300'>
              {companyInformation?.notes || '-'}
            </span>
          </div>
      )
    }

    const companyContacts =
      resolvedCompanyContacts?.length > 0 || !contact?.contacts?.length
        ? resolvedCompanyContacts
        : contact?.contacts

    return (
      <>
        {/* delete contact modal */}
        <Modal
          show={showDeleteModal}
          focus={cancelDeleteButtonRef}
          onClose={() => setShowDeleteModal(false)}
          afterLeave={() => setContactToDelete(null)}
        >
          <Modal.Content>
            <div className='mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 bg-red-100 dark:bg-red-900'>
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className='h-6 w-6 text-red-600 dark:text-red-200'
                aria-hidden='true'
              />
            </div>
            <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
              <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
                {t('Phonebook.Delete contact')}
              </h3>
              <div className='mt-3'>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {t('Phonebook.contactDeletionMessage', {
                    name: contactToDelete?.displayName || '-',
                  })}
                </p>
              </div>
            </div>
          </Modal.Content>
          <Modal.Actions>
            <Button variant='danger' onClick={() => prepareDeleteContact()}>
              {t('Phonebook.Delete contact')}
            </Button>
            <Button
              variant='ghost'
              onClick={() => setShowDeleteModal(false)}
              ref={cancelDeleteButtonRef}
            >
              {t('Common.Cancel')}
            </Button>
          </Modal.Actions>
        </Modal>
        <div
          className={classNames('flex min-w-0 items-center justify-between', className)}
          {...props}
        >
          <div className='flex min-w-0 items-center'>
            <div className='mr-4 flex-shrink-0'>
              <Avatar
                placeholderType={contact?.kind}
                onClick={() => maybeShowSideDrawer(contact)}
                className={classNames(isShownSideDrawerLink && 'cursor-pointer')}
              />
            </div>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <h2
                  className={classNames(
                    'truncate text-xl font-medium text-gray-900 dark:text-gray-100',
                    isShownSideDrawerLink && 'cursor-pointer hover:underline',
                  )}
                  onClick={() => maybeShowSideDrawer(contact)}
                >
                  {contact?.displayName !== '' && contact?.displayName !== ' '
                    ? contact?.displayName
                    : contact?.name !== '' && contact?.name !== ' '
                    ? contact?.name
                    : contact?.company && contact?.company !== '' && contact?.company !== ' '
                    ? contact?.company
                    : '-'}
                </h2>
              </div>
            </div>
          </div>

          {/* contact menu: only when the user can actually write this contact,
              so Edit/Delete are not offered for actions the server would 403 */}
          {isShownContactMenu &&
            canWritePhonebookContact(profile, contact, auth?.username) && (
              <div>
                <Dropdown
                  items={contactMenuItems}
                  position='left'
                  divider={true}
                  className='mt-1 mr-2'
                >
                  <Button variant='ghost'>
                    <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                    <span className='sr-only'>{t('Phonebook.Open contact menu')}</span>
                  </Button>
                </Dropdown>
              </div>
            )}
        </div>
        <div className='mt-6 pb-5'>
          <dl className='space-y-6'>
            {/* visibility */}
            {(contactVisibility === 'private' ||
              (contactVisibility === 'group' && sharedGroups.length > 0)) && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                  {t('Phonebook.Visibility')}
                </dt>
                <dd className='mt-2 sm:col-span-2 sm:mt-0'>
                  {contactVisibility === 'private' ? (
                    <Badge variant='indigoNethLink' rounded='full' size='small'>
                        <FontAwesomeIcon
                        icon={faUserLock}
                        className='h-4 w-4 mr-2'
                        aria-hidden='true'
                      />
                      {t('Phonebook.Private')}
                    </Badge>
                  ) : (
                    <div className='flex flex-wrap items-center gap-2'>
                      {sharedGroups.map((groupName: string) => (
                        <Badge
                          key={groupName}
                          variant='blueNethLink'
                          rounded='full'
                          size='small'
                          icon={<FontAwesomeIcon icon={faUserGroup} className='h-3.5 w-3.5' />}
                        >
                          {groupName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </dd>
              </div>
            )}
            {/* company */}
            {contact.kind == 'person' && contact?.company && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Company')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='text-sm'>
                    <span>{contact?.company}</span>
                  </div>
                </dd>
              </div>
            )}
            {/* extension */}
            {contact?.extension && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='flex items-center text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Extension')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='flex items-center gap-2 text-sm font-normal text-primaryActive dark:text-primaryActiveDark'>
                    <span
                      className='truncate cursor-pointer hover:underline'
                      onClick={() =>
                        operatorsStore?.operators?.[auth?.username]?.mainPresence === 'busy'
                          ? transferCallToExtension(contact?.extension)
                          : callPhoneNumber(contact?.extension)
                      }
                    >
                      {contact?.extension}
                    </span>
                    {/* copy component */}
                    <CopyComponent number={contact?.extension} id='extension' />
                  </div>
                </dd>
              </div>
            )}
            {/* work phone */}
            {contact.workphone && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='flex items-center text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Work phone')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='flex items-center gap-2 text-sm text-primary dark:text-primaryDark'>
                    <span
                      className='truncate cursor-pointer hover:underline'
                      onClick={() =>
                        operatorsStore?.operators[auth.username]?.mainPresence === 'busy'
                          ? transferCallToExtension(contact?.workphone)
                          : callPhoneNumber(contact?.workphone)
                      }
                    >
                      {contact?.workphone}
                    </span>
                    {/* copy component */}
                    <CopyComponent number={contact?.workphone} id='workphone' />
                  </div>
                </dd>
              </div>
            )}
            {/* mobile phone */}
            {contact.cellphone && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='flex items-center text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Mobile phone')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='flex items-center gap-2 text-sm text-primary dark:text-primaryDark'>
                    <span
                      className='truncate cursor-pointer hover:underline'
                      onClick={() =>
                        operatorsStore?.operators[auth.username]?.mainPresence === 'busy'
                          ? transferCallToExtension(contact?.cellphone)
                          : callPhoneNumber(contact?.cellphone)
                      }
                    >
                      {contact?.cellphone}
                    </span>
                    {/* copy component */}
                    <CopyComponent number={contact?.cellphone} id='mobile-phone' />
                  </div>
                </dd>
              </div>
            )}
            {/* home phone */}
            {contact.homephone && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='flex items-center text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Home phone')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='flex items-center gap-2 text-sm text-primary dark:text-primaryDark'>
                    <span
                      className='truncate cursor-pointer hover:underline'
                      onClick={() =>
                        operatorsStore?.operators[auth.username]?.mainPresence === 'busy'
                          ? transferCallToExtension(contact?.homephone)
                          : callPhoneNumber(contact?.homephone)
                      }
                    >
                      {contact?.homephone}
                    </span>
                    {/* copy component */}
                    <CopyComponent number={contact?.homephone} id='home-phone' />
                  </div>
                </dd>
              </div>
            )}
            {/* work email */}
            {contact.workemail && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Email')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='flex items-center gap-2 text-sm'>
                    <a
                      target='_blank'
                      rel='noreferrer'
                      href={`mailto:${contact?.workemail?.trim()}`}
                      className='truncate hover:underline text-gray-900 dark:text-gray-100'
                    >
                      {contact?.workemail}
                    </a>
                    {/* copy component */}
                    <CopyComponent number={contact?.workemail} id='work-email' />
                  </div>
                </dd>
              </div>
            )}
            {/* notes */}
            {contact?.notes && (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Notes')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <div className='text-sm'>
                    <div>{contact?.notes}</div>
                  </div>
                </dd>
              </div>
            )}
            {/* company contacts */}
            {contact?.contacts && contact?.contacts?.length ? (
              <div className='sm:grid sm:grid-cols-3 sm:gap-4'>
                <dt className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark leading-5'>
                  {t('Phonebook.Company contacts')}
                </dt>
                <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                  <ul role='list'>
                    {companyContacts.map((contact: any, index: number) => (
                      <li
                        key={index}
                        className='flex items-center justify-between pb-3 pr-4 text-sm'
                      >
                        <div className='flex w-0 flex-1 items-center'>
                          <span
                            className='w-0 flex-1 truncate text-primary dark:text-primaryDark cursor-pointer'
                            onClick={() => fetchContact(contact?.id, contact?.source)}
                          >
                            {getCompanyContactLabel(contact)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
          {contact?.kind === 'person' && (showCompanyInformation || showCustomerCardButton || showLastCalls) && (
            <div className='mt-6'>
              {showCompanyInformation && <div>{companyInformationData()}</div>}

              {showCustomerCardButton && (
                <div className={showCompanyInformation ? 'mt-6 flex' : 'flex'}>
                  <Button size='small' variant='white' onClick={() => goToCCardCompany(contact)}>
                    <span className='inline-flex items-center gap-3 text-sm font-medium leading-5'>
                      <span>{t('CustomerCards.Go to customer card')}</span>
                      <FontAwesomeIcon icon={faArrowRight} className='h-4 w-4' aria-hidden='true' />
                    </span>
                  </Button>
                </div>
              )}

              {showLastCalls && (
                <div className={showCompanyInformation || showCustomerCardButton ? 'mt-6 h-full' : 'h-full'}>
                  <LastCallsDrawerTable
                    callType={'switchboard'}
                    dateFrom={startOfDay(subDays(new Date(), 7))}
                    dateTo={new Date()}
                    phoneNumbers={[
                      contact?.extension ||
                        contact?.workphone ||
                        contact?.cellphone ||
                        contact?.homephone,
                    ]}
                    limit={10}
                    isCustomerCard={true}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </>
    )
  },
)

ContactSummary.displayName = 'ContactSummary'
