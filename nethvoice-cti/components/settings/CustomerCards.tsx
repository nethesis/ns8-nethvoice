// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from 'react'
import { faIdCardClip } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Dispatch } from '../../store'
import {
  getCustomerCardsList,
  getCustomerCardsPreference,
  getOrderValues,
  setUserSettings,
} from '../../lib/customerCard'
import { Badge, EmptyState } from '../common'
import { isEmpty } from 'lodash'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { getJSONItem, setJSONItem } from '../../lib/storage'

export const CustomerCards = () => {
  const { t } = useTranslation()
  const username = useSelector((state: RootState) => state.user.username)
  const auth = useSelector((state: RootState) => state.authentication)

  const dispatch = useDispatch<Dispatch>()

  const notificationMethods = [
    { id: 'disabled', title: `${t('Settings.Never')}` },
    { id: 'incoming', title: `${t('Settings.On incoming call')}` },
    { id: 'connected', title: `${t('Settings.On answer')}` },
  ]

  const [customerCardSelection, setCustomerCardSelection]: any = useState('')

  const [customerCardsList, setCustomerCardsList]: any = useState({})
  const [isCustomerCardsListLoaded, setIsCustomerCardsListLoaded] = useState(false)
  const [customerCardError, setCustomerCardError] = useState('')

  //Get user information from store
  const userInformation = useSelector((state: RootState) => state.user)

  //Get ccard information from store
  //Status can be of three types: - disabled - incoming - connected
  const ccardStatus = userInformation.settings?.open_ccard

  // retrieve customer cards
  useEffect(() => {
    async function getCustomerCards() {
      if (!isCustomerCardsListLoaded) {
        try {
          setCustomerCardError('')
          const res = await getCustomerCardsList()
          setCustomerCardsList(res)
        } catch (e) {
          console.error(e)
          setCustomerCardError('Cannot retrieve customer cards list')
        }
        setIsCustomerCardsListLoaded(true)
      }
    }
    getCustomerCards()
  }, [isCustomerCardsListLoaded, customerCardsList])

  // On radio button selection update storage and update settings
  function changeCallDirection(event: any) {
    const newCustomerCardSelection = event.target.id
    setCustomerCardSelection(newCustomerCardSelection)

    // Save selection inside local storage
    const preferences = getJSONItem(`preferences-${username}`) || {}
    preferences['customerCardPreference'] = newCustomerCardSelection
    setJSONItem(`preferences-${username}`, preferences)
  }

  //Customer cards list order
  const [customerCardOrder, setCustomerCardOrder]: any = useState([])
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null)
  const [dragOverCardIndex, setDragOverCardIndex] = useState<number | null>(null)

  //On radio button or drag and drop update send update settings object
  useEffect(() => {
    async function changeCCardSettings() {
      if (!isEmpty(customerCardOrder) && !isEmpty(customerCardSelection)) {
        const ccardObject = {} as Record<string, any>
        ccardObject.open_ccard = customerCardSelection
        ccardObject.ccard_order = customerCardOrder
        try {
          await setUserSettings(ccardObject)
          dispatch.user.updateSettings(ccardObject)
        } catch (e) {
          console.error(e)
        }
      }
    }
    changeCCardSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCardOrder, customerCardSelection])

  //Get order and selection from local storage
  useEffect(() => {
    const orderValueLocalStorage = getOrderValues(auth.username)
    setCustomerCardOrder(orderValueLocalStorage?.orderValue)

    const selectionFromLocalStorage = getCustomerCardsPreference(auth.username)
    // If no selection is found inside local storage, set default to disabled
    if (selectionFromLocalStorage.customerCardsPreference.length === 0) {
      setCustomerCardSelection('disabled')
    } else {
      setCustomerCardSelection(selectionFromLocalStorage.customerCardsPreference)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isEmpty(customerCardsList) && customerCardOrder?.length === 0) {
      const initialOrder = Object.keys(customerCardsList)
      setCustomerCardOrder(initialOrder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCardsList])

  // Manage drag and drop
  function saveCustomerCardOrder(updatedOrder: string[]) {
    setCustomerCardOrder(updatedOrder)

    const preferences = getJSONItem(`preferences-${username}`) || {}
    preferences['customerCardOrder'] = updatedOrder
    setJSONItem(`preferences-${username}`, preferences)
  }

  function reorderCustomerCards(sourceIndex: number, destinationIndex: number) {
    if (sourceIndex === destinationIndex) {
      return
    }

    const currentOrder = [...customerCardOrder]
    const [removed] = currentOrder.splice(sourceIndex, 1)
    currentOrder.splice(destinationIndex, 0, removed)

    saveCustomerCardOrder(currentOrder)
  }

  function resetDragState() {
    setDraggedCardIndex(null)
    setDragOverCardIndex(null)
  }

  function handleDragStart(index: number) {
    setDraggedCardIndex(index)
  }

  function handleDragOver(event: React.DragEvent<HTMLLIElement>, index: number) {
    event.preventDefault()

    if (draggedCardIndex === null || draggedCardIndex === index) {
      return
    }

    setDragOverCardIndex(index)
  }

  function handleDrop(index: number) {
    if (draggedCardIndex === null) {
      return
    }

    reorderCustomerCards(draggedCardIndex, index)
    resetDragState()
  }

  function handleDragEnd() {
    resetDragState()
  }

  return (
    <>
      <section aria-labelledby='phone-configuration-heading'>
        <div className='sm:overflow-hidden w-full'>
          <div className='py-6 px-4 sm:p-6 w-full'>
            <div>
              <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
                {t('Settings.Customer cards')}
              </h2>
            </div>
            {!isEmpty(customerCardsList) ? (
              <div>
                <div className='flex justify-between'>
                  <div className=''>
                    <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'>
                      {t('Settings.Show customer card')}
                    </h4>
                    <fieldset className='pt-4'>
                      <legend className='sr-only'>{t('Settings.Customer card show type')}</legend>
                      <div className='space-y-4'>
                        {notificationMethods.map((notificationMethod) => (
                          <div key={notificationMethod.id} className='flex items-center'>
                            <input
                              id={notificationMethod.id}
                              name='notification-method'
                              type='radio'
                              defaultChecked={notificationMethod.id === customerCardSelection}
                              onChange={changeCallDirection}
                              className='h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:text-primaryDark dark:focus:ring-primaryDark'
                            />
                            <label
                              htmlFor={notificationMethod.id}
                              className='ml-3 block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200'
                            >
                              {notificationMethod.title}
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  {/* Vertical divider */}
                  <div className='inline-block w-0.5 self-stretch bg-neutral-100 opacity-100 dark:opacity-50'></div>
                  <div className='w-1/2 pr-4'>
                    <div>
                      {/* Right section title */}
                      <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'>
                        {t('CustomerCards.Customer Card Order (drag to set your order)')}
                      </h4>

                      {/* List header */}
                    </div>

                    <div className='pt-4'>
                      <ul>
                        {customerCardOrder.map((cardId: any, index: any) => (
                          <li
                            key={cardId}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(event) => handleDragOver(event, index)}
                            onDrop={() => handleDrop(index)}
                            onDragEnd={handleDragEnd}
                            className={`cursor-move list-none transition-colors ${
                              draggedCardIndex === index
                                ? 'opacity-50'
                                : dragOverCardIndex === index
                                ? 'rounded-md bg-gray-100 dark:bg-gray-800'
                                : ''
                            }`}
                          >
                            <div
                              className={`flex items-center justify-between ${
                                index === 0 ? 'pb-2' : 'py-2'
                              }`}
                            >
                              {/* Customercard name */}
                              <div className='flex items-center'>
                                <span className='mr-4'>
                                  <FontAwesomeIcon
                                    icon={faIdCardClip}
                                    className='h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                                  />
                                </span>
                                {customerCardsList[cardId]?.descr}
                              </div>

                              {/* Order position */}
                              <Badge
                                size='small'
                                variant='offline'
                                rounded='full'
                                className='ml-2 overflow-hidden'
                              >
                                <span>{index + 1}</span>
                              </Badge>
                            </div>
                            {/* Divider */}
                            <div className='relative'>
                              <div
                                className='absolute inset-0 flex items-center'
                                aria-hidden='true'
                              >
                                <div className='w-full border-t  border-gray-300 dark:border-gray-600' />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title={t('Settings.No customer cards available')}
                description={t('Settings.Create a new customer card') || ''}
                icon={
                  <FontAwesomeIcon
                    icon={faIdCardClip}
                    className='mx-auto h-12 w-12'
                    aria-hidden='true'
                  />
                }
              />
            )}
          </div>
        </div>
      </section>
    </>
  )
}
