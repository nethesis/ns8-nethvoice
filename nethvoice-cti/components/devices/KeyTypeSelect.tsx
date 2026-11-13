// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useEffect, useState } from 'react'
import { t } from 'i18next'
import { Select } from '../common'
import { PHONE_KEY_TYPES } from './phoneKeys'

interface keyTypeSelectProps {
  defaultSelectedType?: string
  updateSelectedTypeKey: Function
  inputMissing?: boolean
  helperText?: string
  label?: string
}

export const KeyTypeSelect: FC<keyTypeSelectProps> = ({
  defaultSelectedType,
  updateSelectedTypeKey,
  inputMissing,
  helperText,
  label,
}) => {
  const [selectedType, setSelectedType] = useState<string>(defaultSelectedType || '')

  useEffect(() => {
    setSelectedType(defaultSelectedType || '')
  }, [defaultSelectedType])

  const changeType = (newType: string) => {
    setSelectedType(newType)
    updateSelectedTypeKey(newType)
  }

  return (
    <Select
      id='types'
      value={selectedType}
      onChange={changeType}
      label={label || t('Devices.Key type')}
      placeholder={`${t('Devices.Choose type')}`}
      helperText={helperText}
      invalid={inputMissing}
      invalidMessage={`${t('Devices.Type selection is required')}.`}
      options={PHONE_KEY_TYPES.map((keyType) => ({
        value: keyType.value,
        label: t(keyType.label),
      }))}
    />
  )
}
