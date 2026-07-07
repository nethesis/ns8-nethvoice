// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useEffect, useState } from 'react'
import { t } from 'i18next'
import classNames from 'classnames'

interface keyTypeSelectProps {
  defaultSelectedType?: string
  updateSelectedTypeKey: Function
  inputMissing?: boolean
}

export const KeyTypeSelect: FC<keyTypeSelectProps> = ({
  defaultSelectedType,
  updateSelectedTypeKey,
  inputMissing,
}) => {
  const [keysTypeSelected, setKeysTypeSelected]: any = useState<string | null>(
    defaultSelectedType || null,
  )

  const typesList = [
    { id: 1, description: 'blf', label: `${t('Devices.Busy lamp field (BLF)')}` },
    { id: 2, description: 'line', label: `${t('Devices.Line')}` },
    { id: 3, description: 'dnd', label: `${t('Devices.Do not disturb (DND)')}` },
    { id: 4, description: 'speed_dial', label: `${t('Devices.Speed call')}` },
    { id: 5, description: 'toggleQueue', label: `${t('Devices.Toggle login/logout queue')}` },
  ]

  const [announcementSelected, setAnnouncementSelected] = useState<any>(null)

  function changeAnnouncementSelect(event: any) {
    const listAnnouncementValue = event.target.value

    const selectedAnnouncement = typesList.find(
      (announcementItem: any) => announcementItem.id === parseInt(listAnnouncementValue),
    )

    if (selectedAnnouncement) {
      setKeysTypeSelected(selectedAnnouncement)
      updateSelectedTypeKey(selectedAnnouncement?.description)
      setAnnouncementSelected(listAnnouncementValue)
    }
  }

  useEffect(() => {
    if (defaultSelectedType && announcementSelected === null) {
      const selectedAnnouncement = typesList.find(
        (announcementItem: any) => announcementItem.description === defaultSelectedType,
      )
      setKeysTypeSelected(selectedAnnouncement)
      setAnnouncementSelected(selectedAnnouncement?.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSelectedType])

  return (
    <>
      <div className='mb-2 mt-4'>
        <span> {t('Devices.Type')}</span>
      </div>

      <select
        id='types'
        name='types'
        className={classNames(
          inputMissing ? 'border-2 rounded-lg border-rose-500' : '',
          'mb-6 block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primary dark:focus:ring-primary dark:bg-gray-900',
        )}
        value={announcementSelected || ''}
        onChange={changeAnnouncementSelect}
      >
        {!announcementSelected && <option value=''>{t('Devices.Key type select')}</option>}
        {Object.keys(typesList).map((key: any) => (
          <option key={key} value={typesList[key].id}>
            {typesList[key].label}
          </option>
        ))}
      </select>
      {inputMissing && (
        <div className='text-rose-500 text-sm mt-1 ml-2'>
          {t('Devices.Type selection is required')}.
        </div>
      )}
    </>
  )
}
