// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useRef, type DragEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faChevronDown,
  faChevronUp,
  faCircleInfo,
  faCircleXmark,
  faGripVertical,
  faSearch,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { DeviceSectionOperatorSearch } from './DeviceSectionOperatorSearch'
import { KeyTypeSelect } from './KeyTypeSelect'
import { isEmpty, isEqual } from 'lodash'
import { Button, EmptyState, TextInput } from '../common'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { motion } from 'framer-motion'
import { customScrollbarClass } from '../../lib/utils'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

interface DraggableRowsProps {
  deviceButtonConfigurationInformation: any
  usableKeys: number
  currentPage: number
  itemsPerPage: number
  onSelectFilteredButtons: (filteredButtons: any) => void
  onVisibilityPagination: (visibility: any) => void
  newButtonData: any
  isSetKeysToAllOperatorsClicked: any
  onResetKeysToOperatorsClicked: () => void
  onChangeKeysObject: (numberEdited: any) => void
  onChangeFinalkeysObject: (finalKeysObject: any) => void
  onChangeExtraRowVisibility: Function
  isExtraRowButtonClicked: boolean
}

export default function DraggableRows({
  deviceButtonConfigurationInformation,
  usableKeys,
  currentPage,
  itemsPerPage,
  onSelectFilteredButtons,
  onVisibilityPagination,
  newButtonData,
  isSetKeysToAllOperatorsClicked,
  onResetKeysToOperatorsClicked,
  onChangeKeysObject,
  onChangeFinalkeysObject,
  onChangeExtraRowVisibility,
  isExtraRowButtonClicked,
}: DraggableRowsProps) {
  const [buttonsStatusObject, setButtonsStatusObject] = useState<any>([])

  const [filteredButtons, setFilteredButtons] = useState([])
  const [originalButtonsStatus, setOriginalButtonsStatus]: any = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [missingInputError, setMissingInputError] = useState<boolean>(false)
  const [keysTypeSelected, setKeysTypeSelected] = useState<any>(null)
  const [selectedUserNumber, setSelectedUserNumber] = useState<any>(null)

  const updateSelectedUserNumber = (newUserNumberInformation: string) => {
    setSelectedUserNumber(newUserNumberInformation)
  }

  const updateSelectedTypeKey = (newTypeKey: string) => {
    setKeysTypeSelected(newTypeKey)
  }

  const [isContactSelected, setIsContactSelected] = useState<boolean>(false)

  const updatePhonebookContactInformation = (statusModal: boolean) => {
    setIsContactSelected(statusModal)
  }

  const [selectedUserNameInformation, setSelectedUserNameInformation] = useState<any>(null)

  const updateSelectedUserName = (newUserNameInformation: string) => {
    setSelectedUserNameInformation(newUserNameInformation)
  }

  const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>

  const operators: any = useSelector((state: RootState) => state.operators)

  const clearTextFilter = () => {
    setTextFilter('')
    textFilterRef.current.focus()
  }

  function changeTextFilter(event: any) {
    const newTextFilter = event.target.value
    setTextFilter(newTextFilter)
  }
  const [keyInformationJsonLoaded, setKeyInformationJsonLoaded] = useState(false)
  //create a json with all the information of the keys
  useEffect(() => {
    if (!isEmpty(deviceButtonConfigurationInformation)) {
      // Extract information on keys
      if (usableKeys) {
        setKeyInformationJsonLoaded(false)
        const buttonsStatus = []
        for (let i = 1; i <= usableKeys; i++) {
          const typeKey = `linekey_type_${i}`
          const valueKey = `linekey_value_${i}`
          const labelKey = `linekey_label_${i}`

          // Check if the keys exist in the object
          const typeValue = deviceButtonConfigurationInformation?.variables[typeKey] ?? ''
          const valueValue = deviceButtonConfigurationInformation?.variables[valueKey] ?? ''
          const labelValue = deviceButtonConfigurationInformation?.variables[labelKey] ?? ''

          const buttonInfo = {
            id: i,
            type: typeValue,
            value: valueValue,
            label: labelValue,
          }

          buttonsStatus.push(buttonInfo)
        }

        if (!isEmpty(buttonsStatus)) {
          setButtonsStatusObject(buttonsStatus)
          setOriginalButtonsStatus(buttonsStatus)
          setKeyInformationJsonLoaded(true)
        }
      } else {
        return
      }
    }
  }, [deviceButtonConfigurationInformation, usableKeys])

  // Insert new key information from operators store
  useEffect(() => {
    if (isSetKeysToAllOperatorsClicked) {
      const updatedButtons: any = [...buttonsStatusObject]
      const blfRowsToAdd: any[] = []

      Object.keys(operators?.extensions || {}).forEach((exten, index) => {
        // Check max number of keys
        if (index < usableKeys) {
          const operator: any = operators?.extensions[exten]

          // New row information
          const newButton: any = {
            id: index + 1,
            type: 'blf',
            label: `${operator?.name}`,
            value: exten,
          }

          blfRowsToAdd.push(newButton)
        }
      })

      updatedButtons.splice(0, blfRowsToAdd.length, ...blfRowsToAdd)

      const updatedButtonsWithIndices = updatedButtons.map((button: any, index: number) => ({
        ...button,
        id: index + 1,
      }))

      setFilteredButtons(updatedButtonsWithIndices)
      setButtonsStatusObject(updatedButtonsWithIndices)

      // Set modal to false
      onResetKeysToOperatorsClicked()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetKeysToAllOperatorsClicked, operators?.extensions])

  // Input field section
  const [textFilter, setTextFilter] = useState('')

  const [visibleFilter, setVisibleFilter] = useState(false)

  const [updatedFilterButtons, setUpdatedFilterButtons] = useState<any>([])
  const [currentFilteredItems, setCurrentFilteredItems] = useState<any>([])

  const updateFilterButtonsValue = () => {
    const updatedFilteredButtons = buttonsStatusObject?.filter((button: any) => {
      const buttonLabel = `${button?.id} - ${button?.label} (${button?.value})`.toLowerCase()
      const filterText = textFilter.toLowerCase()
      return buttonLabel.includes(filterText)
    })
    setUpdatedFilterButtons(updatedFilteredButtons)
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentFilterItems = updatedFilteredButtons.slice(indexOfFirstItem, indexOfLastItem)
    setCurrentFilteredItems(currentFilterItems)
  }

  useEffect(() => {
    updateFilterButtonsValue()
    if (updatedFilterButtons?.length < 11) {
      setVisibleFilter(false)
      onVisibilityPagination(false)
    } else {
      setVisibleFilter(true)
      onVisibilityPagination(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buttonsStatusObject,
    textFilter,
    currentPage,
    itemsPerPage,
    usableKeys,
    deviceButtonConfigurationInformation,
    filteredButtons,
  ])

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)

  const [editedRowIndex, setEditedRowIndex] = useState<number | null>(null)

  const [isUserEditingIndex, setIsUserEditingIndex] = useState(false)

  const resetInput = () => {
    setSelectedUserNumber(null)
    setSelectedUserNameInformation(null)
    setKeysTypeSelected(null)
    setEditedRowIndex(null)
    setIsUserEditingIndex(false)
    setSelectedRowIndex(null)
  }

  const [numberOfKeysEdited, setNumberOfkeysEdited] = useState<number>(0)

  const confirmEditRow = (rowData: any) => {
    if (editedRowIndex !== null && keysTypeSelected !== null) {
      const targetIndex = editedRowIndex - 1
      const oldIndex = rowData?.id - 1
      if (targetIndex >= 0 && targetIndex < filteredButtons?.length) {
        const updatedButtons: any = [...filteredButtons]

        // Save selected row data before swapping
        const selectedOldRow: any = { ...updatedButtons[targetIndex] }

        let typeSelectedLabelValue = ''
        switch (keysTypeSelected) {
          case 'blf':
            selectedUserNumber !== null
              ? (typeSelectedLabelValue = operators?.extensions[selectedUserNumber]?.name || '-')
              : rowData?.label
              ? (typeSelectedLabelValue = rowData?.label)
              : '-'
            break
          case 'speed_dial':
            isContactSelected && selectedUserNumber !== null
              ? selectedUserNameInformation !== ''
                ? (typeSelectedLabelValue = selectedUserNameInformation)
                : rowData?.label
                ? (typeSelectedLabelValue = rowData?.label)
                : (typeSelectedLabelValue = '-')
              : !isContactSelected && selectedUserNumber !== null
              ? (typeSelectedLabelValue = operators?.extensions[selectedUserNumber]?.name || '-')
              : rowData?.label
              ? (typeSelectedLabelValue = rowData?.label)
              : '-'
            break
          case 'line':
            typeSelectedLabelValue = t('Devices.Line')
            break
          case 'dnd':
            typeSelectedLabelValue = t('Devices.Do not disturb (DND)')
            break
          case 'toggleQueue':
            typeSelectedLabelValue = t('Devices.Toggle login/logout queue')
            break
          default:
            break
        }

        if (keysTypeSelected === '' || keysTypeSelected === null) {
          setMissingInputError(true)
        } else {
          setMissingInputError(false)
          // Update the row with new data
          updatedButtons[targetIndex] = {
            ...selectedOldRow,
            type: keysTypeSelected,
            // if user doesn't type anything, keep the previous value
            value:
              selectedUserNumber !== null
                ? selectedUserNumber
                : rowData?.value !== null
                ? rowData?.value
                : null,
            label: typeSelectedLabelValue || '-',
          }

          if (oldIndex !== targetIndex) {
            updatedButtons[oldIndex] = {
              ...selectedOldRow,
              id: oldIndex + 1,
            }
          }

          // Update status with new data
          setFilteredButtons(updatedButtons)
          setButtonsStatusObject(updatedButtons)

          setIsEditing(true)
          resetInput()
          const changes = getChanges(originalButtonsStatus, updatedButtons)
          if (changes?.length > 0) {
            setNumberOfkeysEdited(changes?.length)
            onChangeKeysObject(changes?.length)
          }
        }
      }
    }
  }

  const getChanges = (original: any[], updated: any[]) => {
    const changes = []

    for (let i = 0; i < original?.length; i++) {
      if (!isEqual(original[i], updated[i])) {
        changes.push({
          original: original[i],
          updated: updated[i],
        })
      }
    }

    return changes
  }

  const deleteRow = (rowData: any) => {
    const targetIndex = rowData?.id - 1

    const updatedButtons: any = [...filteredButtons]

    // Remove row data
    updatedButtons.splice(targetIndex, 1)

    // Update index after delete
    for (let i = targetIndex; i < updatedButtons.length; i++) {
      updatedButtons[i] = {
        ...updatedButtons[i],
        id: i + 1,
      }
    }

    // Update status
    setFilteredButtons(updatedButtons)
    setButtonsStatusObject(updatedButtons)
    setIsEditing(true)
  }

  useEffect(() => {
    if (newButtonData) {
      // Find the index of the row to update with same id
      const existingRowIndex = buttonsStatusObject.findIndex(
        (button: any) => button?.id === newButtonData?.id,
      )

      if (existingRowIndex !== -1) {
        //
        const updatedButtons = [...buttonsStatusObject]
        updatedButtons[existingRowIndex] = newButtonData
        setButtonsStatusObject(updatedButtons)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newButtonData])

  const [rowSelectedStatus, setRowSelectedStatus] = useState(false)

  const handleClickIcon = (clickedIndex: number, typeSelected: string) => {
    const correctPage = currentPage - 1
    const globalIndex = clickedIndex + correctPage * itemsPerPage

    setSelectedRowIndex((prevIndex) => (prevIndex === globalIndex ? null : globalIndex))
    setIsEditing(false)
    setKeysTypeSelected((prevIndex: any) => (prevIndex === globalIndex ? undefined : typeSelected))
    setRowSelectedStatus(!rowSelectedStatus)
    onChangeExtraRowVisibility(!rowSelectedStatus)
  }

  useEffect(() => {
    if (isExtraRowButtonClicked) {
      resetInput()
    }
  }, [isExtraRowButtonClicked])

  const [query, setQuery] = useState('')
  // const [selectedNumber, setSelectedNumber] = useState<number | null>(null)

  const numbers = Array.from({ length: usableKeys }, (_, index) => index + 1)

  const filteredNumbers =
    query === ''
      ? numbers
      : numbers.filter((number) => {
          return number.toString().toLowerCase().includes(query.toLowerCase())
        })

  const selectNewRowIndex = (value: any) => {
    setEditedRowIndex(value as number)
  }

  useEffect(() => {
    if (selectedRowIndex !== null) {
      setEditedRowIndex(selectedRowIndex + 1)
    }
  }, [selectedRowIndex])

  useEffect(() => {
    setFilteredButtons(buttonsStatusObject)
    onChangeFinalkeysObject(buttonsStatusObject)
  }, [buttonsStatusObject, filteredButtons, textFilter])

  useEffect(() => {
    onSelectFilteredButtons(filteredButtons)
  }, [filteredButtons, onSelectFilteredButtons])

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: DragEvent<HTMLLIElement>, index: number) => {
    e.dataTransfer.setData('text/plain', String(index))
    setDraggedIndex(index)
  }

  const handleDragOver = (e: DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragEnter = (index: number) => {
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: DragEvent<HTMLLIElement>, targetIndex: number) => {
    e.preventDefault()
    const droppedIndex = Number(e.dataTransfer.getData('text/plain'))
    const newItems = [...buttonsStatusObject]

    const [removed] = newItems.splice(droppedIndex, 1)
    newItems.splice(targetIndex, 0, removed)

    const updatedItems = newItems.map((item, index) => ({
      ...item,
      id: index + 1,
    }))

    const changes = getChanges(originalButtonsStatus, updatedItems)
    if (changes?.length > 0) {
      setNumberOfkeysEdited(changes?.length)
      onChangeKeysObject(changes?.length)
    }

    setButtonsStatusObject(updatedItems)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <>
      <div className='flex items-center'>
        <TextInput
          placeholder={t('Devices.Search') || ''}
          className='max-w-xl py-4 placeholder:dark:text-gray-100'
          value={textFilter}
          onChange={changeTextFilter}
          ref={textFilterRef}
          icon={textFilter?.length ? faCircleXmark : undefined}
          onIconClick={() => clearTextFilter()}
          trailingIcon={true}
        />
      </div>
      <div className={customScrollbarClass}>
        <div className='pt-2 max-h-[24rem]'>
          <ul>
            {/* skeleton */}
            {!keyInformationJsonLoaded &&
              Array.from(Array(4)).map((e, index) => (
                <div
                  key={index}
                  className='flex cursor-default select-none items-center rounded-md p-2 h-14'
                >
                  <div className='animate-pulse rounded-full h-8 w-8 bg-gray-300 dark:bg-gray-600'></div>
                  <div className='ml-2 animate-pulse h-3 rounded w-[40%] bg-gray-300 dark:bg-gray-600'></div>
                </div>
              ))}
            {/* no search results */}
            {keyInformationJsonLoaded && currentFilteredItems?.length === 0 && (
              <div className='flex justify-center cursor-default select-none items-center rounded-md p-2'>
                <EmptyState
                  title={t('Devices.No results') || ''}
                  description={t('Devices.Try changing your search query') || ''}
                  icon={
                    <FontAwesomeIcon
                      icon={faSearch}
                      className='mx-auto h-14 w-14'
                      aria-hidden='true'
                    />
                  }
                />
              </div>
            )}
            {currentFilteredItems.map((buttonRow: any, index: number) => (
              <li
                key={buttonRow?.id}
                draggable
                onDragStartCapture={(e: DragEvent<HTMLLIElement>) => handleDragStart(e, index)}
                onDragOverCapture={(e: DragEvent<HTMLLIElement>) => handleDragOver(e, index)}
                onDragEnterCapture={() => handleDragEnter(index)}
                onDragLeaveCapture={handleDragLeave}
                onDropCapture={(e: DragEvent<HTMLLIElement>) => handleDrop(e, index)}
              >
                <motion.div
                  initial={{ opacity: 2, y: 0 }}
                  animate={{
                    opacity: draggedIndex === index ? 0.5 : 1,
                    y: draggedIndex === index ? -0.1 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                  className={`${selectedRowIndex === index && !isEditing ? 'bg-gray-100' : ''}
                  ${draggedIndex === index ? 'dark:text-gray-600' : ''}
                   grid items-center py-4 px-2 grid-cols-[4rem,auto,1rem]`}
                  style={{
                    background:
                      dragOverIndex === index
                        ? '#d1fae5'
                        : draggedIndex === index
                        ? '#f3f4f6'
                        : 'transparent',
                    border: draggedIndex === index ? '2px dashed #10b981' : 'none',
                  }}
                >
                  <div className='flex items-center'>
                    <FontAwesomeIcon
                      icon={faGripVertical}
                      className='h-4 w-4 text-gray-700 dark:text-gray-400 mr-2'
                    />
                    <span className=''>{buttonRow?.id} -</span>
                  </div>

                  <div className='flex items-center justify-start whitespace-nowrap'>
                    <span>
                      {buttonRow?.label !== '' ? buttonRow?.label : t('Devices.Not configurated')}
                    </span>
                    {buttonRow?.type !== 'dnd' &&
                      buttonRow?.type !== 'line' &&
                      buttonRow?.value !== '' && <span className='ml-1'>({buttonRow?.value})</span>}
                  </div>
                  <div className='flex items-end justify-end'>
                    <Button variant='ghost' onClick={() => handleClickIcon(index, buttonRow?.type)}>
                      <FontAwesomeIcon
                        icon={
                          selectedRowIndex === index && !isEditing ? faChevronUp : faChevronDown
                        }
                        className='h-4 w-4 cursor-pointer'
                      />
                    </Button>
                  </div>
                </motion.div>

                {selectedRowIndex === index + (currentPage - 1) * itemsPerPage && !isEditing && (
                  <div className='px-2'>
                    <div className='flex items-center mt-4'>
                      <span>{t('Devices.Key position')}</span>
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className='h-4 w-4 pl-2 text-primary dark:text-primaryDark flex items-center tooltip-configure-key-position-information'
                        aria-hidden='true'
                        data-tooltip-id='tooltip-configure-key-position-information'
                        data-tooltip-content={t('Devices.Key position information tooltip') || ''}
                      />

                      <CustomThemedTooltip
                        id='tooltip-configure-key-position-information'
                        place='right'
                      />
                    </div>

                    {/* Choose new index for selected key */}
                    <Combobox
                      as='div'
                      value={editedRowIndex}
                      onChange={(value: any) => {
                        selectNewRowIndex(value)
                      }}
                      defaultValue={selectedRowIndex + 1}
                    >
                      <div className='relative mt-2 mb-4'>
                        <ComboboxInput
                          className='w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6'
                          onChange={(event) => setQuery(event?.target?.value)}
                          displayValue={(number: any) => number?.toString()}
                          placeholder={`${t(
                            'Devices.Search physical phone draggable row index placeholder message',
                            {
                              usableKeys,
                            },
                          )}`}
                        />

                        {/* Choose a number from 1 to {usableKeys} */}
                        <ComboboxButton className='absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none'>
                          <FontAwesomeIcon
                            icon={faChevronDown}
                            className='h-4 w-4 mr-1 flex items-center'
                            aria-hidden='true'
                          />
                        </ComboboxButton>

                        {filteredNumbers?.length > 0 && (
                          <ComboboxOptions className='absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm'>
                            {filteredNumbers.map((number) => (
                              <ComboboxOption
                                key={number}
                                value={number}
                                className={({ active }) =>
                                  classNames(
                                    'relative cursor-default select-none py-2 pl-8 pr-4',
                                    active
                                      ? 'bg-emerald-600 text-white'
                                      : 'text-gray-900 dark:text-gray-200',
                                  )
                                }
                              >
                                {({ active, selected }) => (
                                  <>
                                    <span
                                      className={`${
                                        selected ? 'block truncate font-semibold' : ''
                                      } `}
                                    >
                                      {number}
                                    </span>

                                    {selected && (
                                      <span
                                        className={classNames(
                                          'absolute inset-y-0 left-0 flex items-center pl-1.5',
                                          active ? 'text-white' : 'text-emerald-600',
                                        )}
                                      >
                                        <FontAwesomeIcon
                                          icon={faCheck}
                                          className='h-4 w-4 mr-3 text-primary dark:text-primaryDark flex items-center tooltip-configure-key-position-information'
                                          aria-hidden='true'
                                        />
                                      </span>
                                    )}
                                  </>
                                )}
                              </ComboboxOption>
                            ))}
                          </ComboboxOptions>
                        )}
                      </div>
                    </Combobox>

                    {/* Choose new type for selected key */}
                    <KeyTypeSelect
                      defaultSelectedType={buttonRow?.type}
                      updateSelectedTypeKey={updateSelectedTypeKey}
                      inputMissing={missingInputError}
                    />

                    {/* Insert name or number only if type equal to blf or speed_dial */}
                    {((keysTypeSelected === undefined && buttonRow?.type === 'blf') ||
                      (keysTypeSelected === undefined && buttonRow?.type === 'speed_dial') ||
                      keysTypeSelected === 'blf' ||
                      keysTypeSelected === 'speed_dial') && (
                      <>
                        <div className='mb-2'>
                          <span>
                            {keysTypeSelected === 'blf'
                              ? t('Devices.Name or extension')
                              : t('Devices.Name or number')}
                          </span>
                        </div>
                        {/* Search user input */}
                        <DeviceSectionOperatorSearch
                          typeSelected={keysTypeSelected}
                          updateSelectedUserNumber={updateSelectedUserNumber}
                          defaultValue={buttonRow?.label}
                          updatePhonebookContactInformation={updatePhonebookContactInformation}
                          updateSelectedUserName={updateSelectedUserName}
                        ></DeviceSectionOperatorSearch>
                      </>
                    )}
                    <div className='flex items-center space-x-3'>
                      {/* Confirm button */}
                      <div className='flex items-center mb-6'>
                        <Button
                          variant='primary'
                          onClick={() => {
                            confirmEditRow(buttonRow)
                          }}
                        >
                          <span className='text-sm font-medium leading-5'>
                            {t('Common.Confirm')}
                          </span>
                        </Button>
                      </div>

                      {/* Delete key button */}
                      <div className='flex items-center mb-6'>
                        <Button
                          variant='ghost'
                          onClick={() => {
                            deleteRow(buttonRow)
                          }}
                        >
                          <FontAwesomeIcon
                            icon={faTrash}
                            className='h-4 w-4 mr-3 text-primary dark:text-primaryDark flex items-center tooltip-configure-key-position-information'
                            aria-hidden='true'
                          ></FontAwesomeIcon>
                          <span className='text-primary dark:text-primaryDark text-sm font-medium leading-5'>
                            {t('Common.Delete')}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Divider */}
                <div className='relative col-span-3 z-0'>
                  <div className='absolute inset-0 flex items-center' aria-hidden='true'>
                    <div className='w-full border-t border-gray-300 dark:border-gray-600 mr-3' />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
