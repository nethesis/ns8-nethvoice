// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useEffect, useState } from 'react'
import { t } from 'i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo, faGripVertical, faXmark } from '@fortawesome/free-solid-svg-icons'

import { DeviceSectionOperatorSearch } from './DeviceSectionOperatorSearch'
import ComboboxNumber from '../common/ComboboxNumber'
import { Tooltip } from 'react-tooltip'
import { Button } from '../common'
import { KeyTypeSelect } from './KeyTypeSelect'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

interface ExtraRowKeyProps {
  usableKeys: number
  updateExtraRowVisbility: Function
  onAddNewButton: Function
}

export const ExtraRowKey: FC<ExtraRowKeyProps> = ({
  usableKeys,
  updateExtraRowVisbility,
  onAddNewButton,
}) => {
  const hideExtraRow = () => {
    updateExtraRowVisbility(false)
  }

  const [keysTypeSelected, setKeysTypeSelected]: any = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)

  const updateSelectedTypeKey = (newTypeKey: string) => {
    setKeysTypeSelected(newTypeKey)
  }

  //check if user select a type from combobox
  useEffect(() => {
    if (keysTypeSelected !== null && keysTypeSelected !== '') {
      setMissingInputError(false)
    }
  }, [keysTypeSelected])

  const [newKeyLabel, setNewKeyLabel] = useState<string>('')
  const [newKeyValue, setNewKeyValue] = useState<string>('')
  const [indexError, setIndexError] = useState<boolean>(false)
  const [missingInputError, setMissingInputError] = useState<boolean>(false)
  const operators: any = useSelector((state: RootState) => state.operators)
  const [selectedUserInformation, setSelectedUserNumber] = useState<any>(null)
  const [selectedUserNameInformation, setSelectedUserNameInformation] = useState<any>(null)

  const [isContactSelected, setIsContactSelected] = useState<boolean>(false)

  const updatePhonebookContactInformation = (statusModal: boolean) => {
    setIsContactSelected(statusModal)
  }

  const confirmAddRow = () => {
    if (selectedRowIndex !== null) {
      setIndexError(false)
    } else {
      setIndexError(true)
    }
    if (selectedRowIndex !== null && keysTypeSelected !== null) {
      let typeSelectedLabelValue = ''
      switch (keysTypeSelected) {
        case 'blf':
          typeSelectedLabelValue = operators?.extensions[selectedUserInformation]?.name || '-'
          break
        case 'speed_dial':
          typeSelectedLabelValue = isContactSelected
            ? selectedUserNameInformation !== ''
              ? selectedUserNameInformation
              : '-'
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

      const newKey = {
        id: selectedRowIndex + 1,
        type: keysTypeSelected,
        value: selectedUserInformation,
        label: typeSelectedLabelValue || '-',
      }

      onAddNewButton(newKey)

      hideExtraRow()
    } else {
      setMissingInputError(true)
    }
  }

  useEffect(() => {
    if (selectedRowIndex !== null) {
      setIndexError(false)
    }
  }, [selectedRowIndex])

  const updateSelectedUserNumber = (newUserNumberInformation: string) => {
    setSelectedUserNumber(newUserNumberInformation)
  }

  const updateSelectedUserName = (newUserNameInformation: string) => {
    setSelectedUserNameInformation(newUserNameInformation)
  }

  return (
    <>
      <div className='bg-gray-100 dark:bg-gray-700 grid items-center py-4 px-2 mr-2 grid-cols-2'>
        <div className='flex items-center'>
          <FontAwesomeIcon
            icon={faGripVertical}
            className='h-4 w-4 text-gray-700 dark:text-gray-400 mr-2'
          />
          <span>{t('Devices.New key')}</span>
        </div>
        <div className='flex items-end justify-end'>
          <Button
            variant='ghost'
            onClick={() => {
              hideExtraRow()
            }}
          >
            <FontAwesomeIcon
              icon={faXmark}
              className='h-4 w-4 text-primary dark:text-primaryDark cursor-pointer'
            />
          </Button>
        </div>
      </div>

      <div className='px-4'>
        <div className='flex items-center mt-4'>
          <span>{t('Devices.Key position')}</span>
          <FontAwesomeIcon
            icon={faCircleInfo}
            className='h-4 w-4 pl-2 text-primary dark:text-primaryDark flex items-center tooltip-configure-key-position-information-extra-key'
            aria-hidden='true'
          />
          {/* key position information tooltip */}
          <Tooltip
            anchorSelect='.tooltip-configure-key-position-information-extra-key'
            place='right'
          >
            {t('Devices.Key position information tooltip') || ''}
          </Tooltip>
        </div>
        <ComboboxNumber
          maxNumber={usableKeys}
          onSelect={(selectedNumber) => setSelectedRowIndex(selectedNumber - 1)}
          missingkeyError={indexError}
        />

        <div className='mb-2'>
          <KeyTypeSelect
            updateSelectedTypeKey={updateSelectedTypeKey}
            inputMissing={missingInputError}
          ></KeyTypeSelect>

          {(keysTypeSelected === 'blf' || keysTypeSelected === 'speed_dial') && (
            <>
              <div className='mb-2'>
                <span> {t('Devices.Name or number')}</span>
              </div>
              <DeviceSectionOperatorSearch
                typeSelected={keysTypeSelected}
                updateSelectedUserNumber={updateSelectedUserNumber}
                updatePhonebookContactInformation={updatePhonebookContactInformation}
                updateSelectedUserName={updateSelectedUserName}
              ></DeviceSectionOperatorSearch>
            </>
          )}

          {/* Confirm button */}
          <div className='flex items-center mb-6'>
            <Button
              variant='primary'
              onClick={() => {
                confirmAddRow()
              }}
            >
              <span className='text-sm font-medium leading-5'>{t('Common.Confirm')}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
