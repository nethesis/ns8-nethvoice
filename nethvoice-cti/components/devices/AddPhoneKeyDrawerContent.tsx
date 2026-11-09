// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState } from 'react'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { TextInput } from '../common'
import { DrawerFooter } from '../common/DrawerFooter'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { closeSideDrawer } from '../../lib/utils'
import { RootState } from '../../store'
import { DeviceSectionOperatorSearch } from './DeviceSectionOperatorSearch'
import { KeyPositionInput } from './KeyPositionInput'
import { KeyTypeSelect } from './KeyTypeSelect'
import {
  getDefaultPhoneKeyLabel,
  isPhoneKeyTypeWithValue,
  PHONE_KEY_LABEL_CLASSES,
} from './phoneKeys'

export interface AddPhoneKeyDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: {
    defaultPosition: number
    maxPosition: number
    onAdd: (key: { position: number; type: string; value: string; label: string }) => void
  }
}

export const AddPhoneKeyDrawerContent = forwardRef<
  HTMLButtonElement,
  AddPhoneKeyDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const operators: any = useSelector((state: RootState) => state.operators)

  const [position, setPosition] = useState<number>(config?.defaultPosition || 1)
  const [type, setType] = useState<string>('')
  const [value, setValue] = useState<string>('')
  const [keyLabel, setKeyLabel] = useState<string>('')
  const [isCustomTarget, setIsCustomTarget] = useState(false)

  const needsValue = isPhoneKeyTypeWithValue(type)
  const isAddDisabled = type === '' || (needsValue && value === '')

  const addKey = () => {
    if (isAddDisabled) {
      return
    }
    if (!needsValue) {
      config?.onAdd({ position, type, value: '', label: getDefaultPhoneKeyLabel(type) })
      closeSideDrawer()
      return
    }
    config?.onAdd({
      position,
      type,
      value,
      label: keyLabel || operators?.extensions[value]?.name || value,
    })
    closeSideDrawer()
  }

  return (
    <>
      <DrawerHeader title={t('Devices.Add key')} onClose={closeSideDrawer} />
      <div className='px-6 pb-6'>
        <Divider spaceAbove='pt-6' spaceBelow='pb-6' />

        <div className='flex flex-col gap-8'>
          <div className='flex flex-col gap-2'>
            <span className={PHONE_KEY_LABEL_CLASSES}>{t('Devices.Key position')}</span>
            <KeyPositionInput
              value={position}
              max={config?.maxPosition || 1}
              onChange={setPosition}
            />
          </div>

          <KeyTypeSelect
            updateSelectedTypeKey={(newType: string) => {
              setType(newType)
              setValue('')
              setKeyLabel('')
              setIsCustomTarget(false)
            }}
            helperText={t('Devices.Choose the action assigned to this key') || ''}
          />

          {needsValue && (
            <div className='flex flex-col gap-2'>
              <span className={PHONE_KEY_LABEL_CLASSES}>
                {type === 'blf' ? t('Devices.Extension') : t('Devices.Name or number')}
              </span>
              <DeviceSectionOperatorSearch
                typeSelected={type}
                value={value}
                label={keyLabel}
                onChange={(key) => {
                  setValue(key.value)
                  setIsCustomTarget(key.isCustom)
                  if (key.label !== null) {
                    setKeyLabel(key.label)
                  }
                }}
                placeholder={`${
                  type === 'blf'
                    ? t('Devices.Type or choose extension')
                    : t('Devices.Type or choose name or number')
                }`}
              />
            </div>
          )}

          {needsValue && isCustomTarget && (
            <TextInput
              label={`${t('Devices.Label')}`}
              optional
              placeholder={`${t('Devices.Label placeholder')}`}
              value={keyLabel}
              onChange={(event) => setKeyLabel(event.target.value)}
            />
          )}
        </div>

        <Divider spaceAbove='pt-8' spaceBelow='pb-6' />

        <DrawerFooter
          confirmLabel={`${t('Common.Add')}`}
          onConfirm={addKey}
          confirmDisabled={isAddDisabled}
        />
      </div>
    </>
  )
})

AddPhoneKeyDrawerContent.displayName = 'AddPhoneKeyDrawerContent'
