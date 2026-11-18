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
import { KeyTypeSelect } from './KeyTypeSelect'
import {
  getDefaultPhoneKeyLabel,
  isPhoneKeyTypeWithValue,
  PHONE_KEY_LABEL_CLASSES,
} from './phoneKeys'

export interface EditExpansionKeyDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: {
    keyNumber: number
    type: string
    value: string
    label: string
    onSave: (key: { type: string; value: string; label: string }) => void
  }
}

export const EditExpansionKeyDrawerContent = forwardRef<
  HTMLButtonElement,
  EditExpansionKeyDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const operators: any = useSelector((state: RootState) => state.operators)

  const [type, setType] = useState<string>(config?.type || '')
  const [value, setValue] = useState<string>(config?.value || '')
  const [keyLabel, setKeyLabel] = useState<string>(config?.label || '')
  const [isCustomTarget, setIsCustomTarget] = useState(
    !!config?.value && !operators?.extensions?.[config?.value],
  )

  const needsValue = isPhoneKeyTypeWithValue(type)
  const isSaveDisabled = type === '' || (needsValue && value === '')

  const saveKey = () => {
    if (isSaveDisabled) {
      return
    }
    if (!needsValue) {
      config?.onSave({ type, value: '', label: getDefaultPhoneKeyLabel(type) })
    } else {
      config?.onSave({
        type,
        value,
        label: keyLabel || operators?.extensions[value]?.name || value,
      })
    }
    closeSideDrawer()
  }

  return (
    <>
      <DrawerHeader
        title={`${t('Devices.Edit expansion key', { number: config?.keyNumber })}`}
        onClose={closeSideDrawer}
      />
      <div className='px-6 pb-6'>
        <Divider spaceAbove='pt-6' spaceBelow='pb-6' />

        <div className='flex flex-col gap-8'>
          <KeyTypeSelect
            defaultSelectedType={config?.type}
            label={t('Devices.Line key type') || ''}
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
          confirmLabel={`${t('Common.Edit')}`}
          onConfirm={saveKey}
          confirmDisabled={isSaveDisabled}
        />
      </div>
    </>
  )
})

EditExpansionKeyDrawerContent.displayName = 'EditExpansionKeyDrawerContent'
