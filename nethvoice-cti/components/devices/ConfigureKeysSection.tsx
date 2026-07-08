// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  ComponentPropsWithRef,
  MutableRefObject,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGripVertical,
  faCircleInfo,
  faArrowRight,
  faChevronLeft,
  faAngleRight,
} from '@fortawesome/free-solid-svg-icons'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash'
import {
  getPhoneModelData,
  getPhysicalDeviceButtonConfiguration,
  reloadPhysicalPhone,
  saveBtnsConfig,
  setPin,
} from '../../lib/devices'
import { Avatar, Button, InlineNotification, Modal } from '../common'
import { closeSideDrawer } from '../../lib/utils'
import { ExtraRowKey } from './ExtraRowKey'
import DraggableRows from './DraggableRows'

export interface ConfigureKeysSectionProps extends ComponentPropsWithRef<'div'> {
  deviceId: any
  modalAllOperatorsKeyStatus: Function
  viewModalAllKeys: boolean
  pinValue: any
  updateDrawerVisibility: Function
}

export const ConfigureKeysSection = forwardRef<HTMLButtonElement, ConfigureKeysSectionProps>(
  (
    {
      deviceId,
      modalAllOperatorsKeyStatus,
      viewModalAllKeys,
      pinValue,
      updateDrawerVisibility,
      className,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation()
    const operators: any = useSelector((state: RootState) => state.operators)
    const profile = useSelector((state: RootState) => state.user)

    // Drag and drop section
    // Manage drag and drop

    const [macAddressDevice, setMacAddressDevice] = useState('')

    /**
     * First step : get mac address from device id
     * Second step : get physical phone information from model name
     * Third step : set number of possible keys
     * Fourth step : create list of keys
     */

    // Call function if mac address is not been set
    useEffect(() => {
      if (macAddressDevice === '') {
        getMacAddressDeviceFromId()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operators?.extensions])

    // Get mac address from device id
    const getMacAddressDeviceFromId = () => {
      if (!isEmpty(operators?.extensions) && deviceId) {
        const macAddress = operators?.extensions[deviceId]?.mac.toUpperCase()
        setMacAddressDevice(macAddress)
        findEndpointById(deviceId)
      }
    }

    const [currentLineNum, setCurrentLineNum] = useState<any>([])

    const findEndpointById = (id: string): void => {
      for (const endpoint of profile?.endpoints?.extension) {
        if (endpoint.id === id) {
          setCurrentLineNum(endpoint?.numLineKeys)
          break
        }
      }
    }

    const [
      deviceButtonConfigurationInformationLoaded,
      setDeviceButtonConfigurationInformationLoaded,
    ] = useState(false)

    const [getConfigurationInformationError, setGetConfigurationInformationError] = useState('')

    const [modelPhoneName, setModelPhoneName] = useState('')
    const [modelPhoneNameLoaded, setModelPhoneNameLoaded] = useState(false)
    const [modelPhoneNameError, setModelPhoneNameError] = useState('')
    const [usableKeys, setUsableKeys] = useState(0)

    const [deviceButtonConfigurationInformation, setDeviceButtonConfigurationInformation] =
      useState<any>([])

    useEffect(() => {
      if (macAddressDevice !== '') {
        const getMacAddressInformation = async () => {
          try {
            setDeviceButtonConfigurationInformationLoaded(false)
            setGetConfigurationInformationError('')
            const deviceConfigurationInformation = await getPhysicalDeviceButtonConfiguration(
              macAddressDevice,
            )
            setDeviceButtonConfigurationInformation(deviceConfigurationInformation)
            setDeviceButtonConfigurationInformationLoaded(true)
            if (!isEmpty(deviceConfigurationInformation)) {
              getModelInformation(deviceConfigurationInformation)
            }
          } catch (error) {
            setGetConfigurationInformationError('Cannot retrieve configuration information')
          }
        }
        getMacAddressInformation()
      }
    }, [macAddressDevice])

    // Get all physical phone information and set the number of usable keys
    const getModelInformation = async (phoneInformation: any) => {
      try {
        setModelPhoneNameError('')
        setModelPhoneNameLoaded(false)
        const physicalPhoneModelNameInformation = await getPhoneModelData(phoneInformation?.model)
        setModelPhoneName(physicalPhoneModelNameInformation)
        if (physicalPhoneModelNameInformation?.variables?.cap_linekey_count !== undefined) {
          setUsableKeys(physicalPhoneModelNameInformation?.variables?.cap_linekey_count)
        } else {
          // No usable phone keys
          setUsableKeys(0)
        }
        setModelPhoneNameLoaded(true)
      } catch (error) {
        setModelPhoneNameError('Cannot retrieve configuration information')
      }
    }

    const updateExtraRowVisbilityStatus = (status: boolean) => {
      setIsExtraRowActive(status)
    }

    const cancelSetKeysToAllButtonRef = useRef() as MutableRefObject<HTMLButtonElement>
    const [isSetKeysToAllOperatorsClicked, setIsSetKeysToAllOperatorsClicked] = useState(false)
    const [isInformationLineShow, setIsInformationLineShow] = useState(0)

    const handleAssignAllKeys = async () => {
      setIsSetKeysToAllOperatorsClicked(true)
    }

    // On reset close modal and set status to false
    const handleResetKeysToOperatorsClicked = () => {
      setIsSetKeysToAllOperatorsClicked(false)
      modalAllOperatorsKeyStatus(false)
    }

    // On change of list index
    const handleIsInformationLineShow = (numberOfKeysEdited: any) => {
      setIsInformationLineShow(numberOfKeysEdited)
    }

    const [newKeyInformationObject, setNewKeyInformationObject] = useState<any>([])
    // On change of key information
    const handleEditNewKeysObject = (newKeyPosition: any) => {
      setNewKeyInformationObject(newKeyPosition)
    }

    const [extraRowVisibility, setExtraRowVisibity] = useState(false)
    // On change of draggable row card open or close
    const handleExtraRowVisibility = (extraRowVisibilityStatus: boolean) => {
      setExtraRowVisibity(extraRowVisibilityStatus)
    }

    // Modal with example of first two operators of operators list
    const renderDynamicRows = () => {
      return Object.keys(operators?.extensions)
        .slice(0, 2)
        .map((key, index) => {
          const exampleOperator = operators?.extensions[key]

          return (
            <div
              key={key}
              className='grid grid-cols-[8rem,2rem,3rem] whitespace-nowrap w-full items-center py-2'
            >
              {/* Operator avatar and name */}
              <div className='flex space-x-2 items-center truncate'>
                <Avatar
                  size='base'
                  placeholderType='person'
                  src={operators?.avatars[exampleOperator?.username]}
                  status={operators?.operators[exampleOperator?.username]?.mainPresence}
                />
                <div className='max-w-sm truncate'>
                  <span>{`${exampleOperator?.name}`}</span>
                </div>
              </div>

              {/* Arrow icon*/}
              <div className='mx-2'>
                <FontAwesomeIcon icon={faArrowRight} className='h-4 w-4' />
              </div>

              {/* Operator icon, name, and number */}
              <div className='flex items-center ml-2'>
                <FontAwesomeIcon
                  icon={faGripVertical}
                  className='h-4 w-4 text-gray-700 dark:text-gray-400 mr-2'
                />

                {/* operator name */}
                <span className='ml-2 mr-2'>{index + 1} -</span>

                {/* extension */}
                <div className=''>
                  <span>{`${exampleOperator?.name}`}</span>
                </div>

                <span className='ml-1'>({`${exampleOperator?.exten || '-'}`})</span>
              </div>
              {/* Divider */}
              {/* <div className='relative flex col-span-3 mt-2 w-full'>
                <div className='absolute inset-x-0 bottom-0 flex items-center' aria-hidden='true'>
                  <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                </div>
              </div> */}
            </div>
          )
        })
    }

    //Extra row status used to add or change id for keys
    const [isExtraRowActive, setIsExtraRowActive] = useState(false)

    const activateDeactivateExtraRow = () => {
      setIsExtraRowActive(!isExtraRowActive)
    }

    const [isLeftButtonVisible, setLeftButtonVisible] = useState(false)
    const [isRightButtonVisible, setRightButtonVisible] = useState(true)

    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Pagination section
    const paginate = (pageNumber: any) => {
      setCurrentPage(pageNumber)
      setLeftButtonVisible(pageNumber > 1)

      setRightButtonVisible(pageNumber < Math.ceil(filteredButtons?.length / itemsPerPage))
    }

    const [filteredButtons, setFilteredButtons] = useState<any[]>([])

    const handleSelectFilteredButtons = (buttons: any) => {
      setFilteredButtons(buttons)
    }

    const [visibleFilter, setVisibleFilter] = useState(false)
    const handleVisibilityPagination = (status: boolean) => {
      setVisibleFilter(status)
    }

    const [newButtonData, setNewButtonData] = useState(null)

    const handleAddNewButton = (newButton: any) => {
      setNewButtonData(newButton)
    }

    const generateRandomPIN = () => {
      return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
    }

    const handleUpdateKeysList = async () => {
      let editedObject: any[] = newKeyInformationObject

      let newObject: any = {
        variables: {},
      }

      let pinObjectStatus: any = {}
      if (pinValue !== '') {
        pinObjectStatus.enabled = true
        pinObjectStatus.pin = pinValue
      } else {
        pinObjectStatus.enabled = false
        let randomNumber = generateRandomPIN()
        pinObjectStatus.pin = randomNumber
      }
      if (deviceId !== '') {
        pinObjectStatus.extension = deviceId
      }

      editedObject.forEach((item: any, index: number) => {
        newObject.variables['linekey_type_' + (index + 1)] = item?.type || ''
        newObject.variables['linekey_value_' + (index + 1)] = item?.value || ''
        newObject.variables['linekey_label_' + (index + 1)] = item?.label || ''
      })
      if (!isEmpty(newObject)) {
        try {
          // setDeviceNewConfigurationLoaded(false)
          //setDeviceNewConfigurationisLoading(true)
          if (!isEmpty(pinObjectStatus)) {
            await setPin(pinObjectStatus)
          }
          await saveBtnsConfig(macAddressDevice, newObject)
          // After new configuration upload reload physical phone
          if (deviceId !== undefined && deviceId !== '') {
            await reloadPhysicalPhone(deviceId)
          }
          updateDrawerVisibility(true)
          closeSideDrawer()
        } catch (error) {
          setGetConfigurationInformationError('Cannot retrieve configuration information')
        }
      }
    }

    // when open draggable list row close extra row card
    useEffect(() => {
      if (extraRowVisibility) {
        setIsExtraRowActive(false)
      }
    }, [extraRowVisibility])

    return (
      <>
        <DraggableRows
          deviceButtonConfigurationInformation={deviceButtonConfigurationInformation}
          usableKeys={usableKeys}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onSelectFilteredButtons={handleSelectFilteredButtons}
          onVisibilityPagination={handleVisibilityPagination}
          newButtonData={newButtonData}
          isSetKeysToAllOperatorsClicked={isSetKeysToAllOperatorsClicked}
          onResetKeysToOperatorsClicked={handleResetKeysToOperatorsClicked}
          onChangeKeysObject={handleIsInformationLineShow}
          onChangeFinalkeysObject={handleEditNewKeysObject}
          onChangeExtraRowVisibility={handleExtraRowVisibility}
          isExtraRowButtonClicked={isExtraRowActive}
        ></DraggableRows>
        {/* Button for add new row */}
        {isExtraRowActive && (
          <ExtraRowKey
            usableKeys={usableKeys}
            updateExtraRowVisbility={updateExtraRowVisbilityStatus}
            onAddNewButton={handleAddNewButton}
          ></ExtraRowKey>
        )}
        {!isExtraRowActive ? (
          <div className='flex justify-between pt-4'>
            <div className='flex justify-start'>
              <Button variant='white' onClick={() => activateDeactivateExtraRow()}>
                <span className='text-primary dark:text-primaryDark leading-5 text-sm font-medium'>
                  {t('Devices.Add key')}
                </span>
              </Button>
            </div>
            <div className='flex justify-end space-x-2'>
              <Button
                variant='white'
                onClick={() => paginate(currentPage - 1)}
                disabled={!isLeftButtonVisible}
              >
                <FontAwesomeIcon icon={faChevronLeft} className='h-4 w-4' />
              </Button>
              <Button
                variant='white'
                onClick={() => paginate(currentPage + 1)}
                disabled={!isRightButtonVisible || !visibleFilter}
              >
                <FontAwesomeIcon icon={faAngleRight} className='h-4 w-4' />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className='flex justify-end space-x-2'>
              <Button
                variant='white'
                onClick={() => paginate(currentPage - 1)}
                disabled={!isLeftButtonVisible}
              >
                <FontAwesomeIcon icon={faChevronLeft} className='h-4 w-4' />
              </Button>
              <Button
                variant='white'
                onClick={() => paginate(currentPage + 1)}
                disabled={!isRightButtonVisible || !visibleFilter}
              >
                <FontAwesomeIcon icon={faAngleRight} className='h-4 w-4' />
              </Button>
            </div>
          </>
        )}

        {/* Divider  */}
        <div className='relative flex col-span-3 my-6 w-full'>
          <div className='absolute inset-x-0 bottom-0 flex items-center' aria-hidden='true'>
            <div className='w-full border-t border-gray-300 dark:border-gray-600' />
          </div>
        </div>

        {isInformationLineShow > 0 ? (
          <div className='flex justify-between space-x-3 items-center'>
            <div className='relative '>
              <InlineNotification type='info' title={t('Devices.Edit done')}>
                <p>{t('Devices.Click on confirm')}</p>
              </InlineNotification>
            </div>
            <div className='flex justify-end'>
              <Button variant='white' type='submit' onClick={closeSideDrawer} className='mb-4'>
                <span className='text-primary dark:text-primaryDark leading-5 text-sm font-medium'>
                  {t('Common.Cancel')}
                </span>
              </Button>
              <Button
                variant='primary'
                type='submit'
                className='mb-4 ml-4'
                onClick={() => handleUpdateKeysList()}
              >
                <span className='leading-5 text-sm font-medium'>{t('Devices.Confirm edits')}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className='flex justify-end'>
            <Button variant='white' type='submit' onClick={closeSideDrawer} className='mb-4'>
              <span className='text-primary dark:text-primaryDark leading-5 text-sm font-medium'>
                {t('Common.Cancel')}
              </span>
            </Button>
            <Button
              variant='primary'
              type='submit'
              className='mb-4 ml-4'
              onClick={() => handleUpdateKeysList()}
            >
              <span className='leading-5 text-sm font-medium'>{t('Devices.Confirm edits')}</span>
            </Button>
          </div>
        )}

        {/* Set key to all operators modal */}
        <Modal
          show={viewModalAllKeys}
          focus={cancelSetKeysToAllButtonRef}
          onClose={() => modalAllOperatorsKeyStatus(false)}
        >
          <Modal.Content>
            <div className='mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 bg-blue-100 dark:bg-blue-900'>
              <FontAwesomeIcon
                icon={faCircleInfo}
                className='h-5 w-5 text-blue-700 dark:text-blue-200'
                aria-hidden='true'
              />
            </div>
            <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
              <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
                {t('Devices.Assign keys for all operators')}
              </h3>
              <div className='mt-3 mb-4'>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {t('Devices.Assign key for all operators modal message')}.
                </p>
              </div>
              <span className='font-normal text-sm leading-5 text-gray-700 dark:text-gray-200'>
                {t('Common.Example')}
              </span>
              <div className='mt-2'>{renderDynamicRows()}</div>
            </div>
          </Modal.Content>
          <Modal.Actions>
            <Button variant='primary' onClick={() => handleAssignAllKeys()}>
              {t('Devices.Assign keys')}
            </Button>
            <Button
              variant='ghost'
              onClick={() => modalAllOperatorsKeyStatus(false)}
              ref={cancelSetKeysToAllButtonRef}
            >
              <span className='text-sm leading-5 font-mediun text-primary dark:text-primaryDark'>
                {t('Common.Cancel')}
              </span>
            </Button>
          </Modal.Actions>
        </Modal>
      </>
    )
  },
)

ConfigureKeysSection.displayName = 'ConfigureKeysSection'
