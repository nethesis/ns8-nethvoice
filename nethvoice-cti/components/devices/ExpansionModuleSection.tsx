// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, MutableRefObject, useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleMinus, faEllipsisVertical, faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { isEmpty } from 'lodash'
import { RootState } from '../../store'
import { Button, ConfirmationModal, Dropdown, InlineNotification, Skeleton } from '../common'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { getKeyTypeBadgeText, PhysicalPhoneKeyBadge } from './PhysicalPhoneKeyBadge'
import { PhoneKeyLabel } from './PhoneKeyLabel'
import {
  getPhoneKeysConfiguration,
  openEditExpansionKeyDrawer,
  reloadPhysicalPhone,
  saveBtnsConfig,
} from '../../lib/devices'
import { customScrollbarClass, openToast } from '../../lib/utils'
import {
  EXPANSION_KEY_CARD_CLASSES,
  getPhoneKeyTargetText,
  isPhoneKeyTypeWithValue,
  normalizePhoneKeyType,
  notifyPhoneConfigurationSaved,
} from './phoneKeys'

export interface ExpansionModuleSectionProps {
  deviceId: string
  phoneName: string
  moduleIndex: number
  isLastModule: boolean
  onRemoved: () => void
}

const RELOAD_DEBOUNCE_MS = 3000

interface ExpansionKey {
  number: number
  globalIndex: number
  type: string
  value: string
  label: string
}

export const ExpansionModuleSection: FC<ExpansionModuleSectionProps> = ({
  deviceId,
  phoneName,
  moduleIndex,
  isLastModule,
  onRemoved,
}) => {
  const operators: any = useSelector((state: RootState) => state.operators)

  const [macAddress, setMacAddress] = useState('')
  const [keys, setKeys] = useState<ExpansionKey[]>([])
  const [keysLoaded, setKeysLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [keyToRemove, setKeyToRemove] = useState<ExpansionKey | null>(null)
  const cancelRemoveRef = useRef() as MutableRefObject<HTMLButtonElement>
  const cancelRemoveKeyRef = useRef() as MutableRefObject<HTMLButtonElement>

  useEffect(() => {
    if (!isEmpty(operators?.extensions) && deviceId) {
      setMacAddress(operators?.extensions[deviceId]?.mac?.toUpperCase() || '')
    }
  }, [operators?.extensions, deviceId])

  const loadKeys = useCallback(async () => {
    if (!macAddress) {
      return
    }
    try {
      setLoadError(false)
      setKeysLoaded(false)
      const phoneKeys = await getPhoneKeysConfiguration(macAddress)
      if (!phoneKeys) {
        setLoadError(true)
        return
      }
      const { configuration, expansionKeysPerModule } = phoneKeys
      const moduleKeys: ExpansionKey[] = []
      for (let i = 1; i <= expansionKeysPerModule; i++) {
        const globalIndex = moduleIndex * expansionKeysPerModule + i
        moduleKeys.push({
          number: i,
          globalIndex,
          type: normalizePhoneKeyType(
            configuration?.variables?.[`expkey_type_${globalIndex}`] ?? '',
          ),
          value: configuration?.variables?.[`expkey_value_${globalIndex}`] ?? '',
          label: configuration?.variables?.[`expkey_label_${globalIndex}`] ?? '',
        })
      }
      setKeys(moduleKeys)
      setKeysLoaded(true)
    } catch (error) {
      setLoadError(true)
    }
  }, [macAddress, moduleIndex])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const pendingReloadRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleReload = () => {
    if (!deviceId) {
      return
    }
    if (pendingReloadRef.current) {
      clearTimeout(pendingReloadRef.current)
    }
    pendingReloadRef.current = setTimeout(() => {
      pendingReloadRef.current = null
      reloadPhysicalPhone(deviceId).catch(() => setSaveError(true))
    }, RELOAD_DEBOUNCE_MS)
  }

  useEffect(() => {
    return () => {
      if (pendingReloadRef.current) {
        clearTimeout(pendingReloadRef.current)
        reloadPhysicalPhone(deviceId).catch(() => undefined)
      }
    }
  }, [deviceId])

  const saveExpansionKeys = async (variables: any, reloadNow = false) => {
    await saveBtnsConfig(macAddress, { variables })
    if (!deviceId) {
      return
    }
    if (reloadNow) {
      if (pendingReloadRef.current) {
        clearTimeout(pendingReloadRef.current)
        pendingReloadRef.current = null
      }
      await reloadPhysicalPhone(deviceId)
      return
    }
    scheduleReload()
  }

  const editKey = (key: ExpansionKey) => {
    openEditExpansionKeyDrawer({
      keyNumber: key.number,
      type: key.type,
      value: key.value,
      label: key.label,
      onSave: async ({ type, value, label }) => {
        try {
          setSaveError(false)
          await saveExpansionKeys({
            [`expkey_type_${key.globalIndex}`]: type,
            [`expkey_value_${key.globalIndex}`]: value,
            [`expkey_label_${key.globalIndex}`]: label,
          })
          setKeys((previousKeys) =>
            previousKeys.map((item) =>
              item.globalIndex === key.globalIndex ? { ...item, type, value, label } : item,
            ),
          )
          notifyPhoneConfigurationSaved(phoneName)
        } catch (error) {
          setSaveError(true)
        }
      },
    })
  }

  const removeKeyConfiguration = async () => {
    if (!keyToRemove) {
      return
    }
    try {
      setSaveError(false)
      await saveExpansionKeys({
        [`expkey_type_${keyToRemove.globalIndex}`]: '',
        [`expkey_value_${keyToRemove.globalIndex}`]: '',
        [`expkey_label_${keyToRemove.globalIndex}`]: '',
      })
      setKeys((previousKeys) =>
        previousKeys.map((item) =>
          item.globalIndex === keyToRemove.globalIndex
            ? { ...item, type: '', value: '', label: '' }
            : item,
        ),
      )
      openToast(
        'success',
        `${t('Devices.Configuration removed description', {
          key: t('Devices.Key number', { number: keyToRemove.number }),
        })}`,
        `${t('Devices.Configuration removed')}`,
      )
    } catch (error) {
      setSaveError(true)
    } finally {
      setKeyToRemove(null)
    }
  }

  const getKeyDescription = (key: ExpansionKey) => {
    const badge = getKeyTypeBadgeText(key.type)
    const target = [key.value, key.label === key.value ? '' : key.label].filter(Boolean).join(', ')
    return target ? `${badge} - ${target}` : badge
  }

  const removeModule = async () => {
    try {
      setIsRemoving(true)
      setSaveError(false)
      const variables: any = {}
      keys.forEach((key) => {
        variables[`expkey_type_${key.globalIndex}`] = ''
        variables[`expkey_value_${key.globalIndex}`] = ''
        variables[`expkey_label_${key.globalIndex}`] = ''
      })
      await saveExpansionKeys(variables, true)
      openToast(
        'success',
        `${t('Devices.Expansion module removed description')}`,
        `${t('Devices.Expansion module removed')}`,
      )
      onRemoved()
    } catch (error) {
      setSaveError(true)
    } finally {
      setIsRemoving(false)
      setShowRemoveModal(false)
    }
  }

  return (
    <div className='flex flex-col gap-6 flex-1 min-h-0 min-w-0'>
      <div className='flex items-center justify-between gap-4'>
        <p className='text-sm leading-5 text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
          {t('Devices.Expansion module description')}
        </p>
        <span
          data-tooltip-id={`tooltip-remove-module-${moduleIndex}`}
          data-tooltip-content={
            isLastModule ? '' : `${t('Devices.Remove module unavailable tooltip')}`
          }
        >
          <Button
            variant='ghost'
            onClick={() => setShowRemoveModal(true)}
            disabled={!keysLoaded || !isLastModule}
          >
            <FontAwesomeIcon icon={faCircleMinus} className='mr-3 h-4 w-4' />
            <span>{t('Devices.Remove module')}</span>
          </Button>
        </span>
        {!isLastModule && (
          <CustomThemedTooltip
            id={`tooltip-remove-module-${moduleIndex}`}
            place='left'
            className='whitespace-normal text-left'
            positionStrategy='fixed'
          />
        )}
      </div>

      {(loadError || saveError) && (
        <InlineNotification type='error' title={t('Common.Error')}>
          <p>
            {saveError
              ? t('Devices.Cannot save configuration')
              : t('Devices.Cannot retrieve configuration information')}
          </p>
        </InlineNotification>
      )}

      <div className={`flex-1 min-h-0 pr-4 ${customScrollbarClass}`}>
        <div className='grid grid-cols-1 gap-3 xl:grid-cols-2'>
          {!keysLoaded &&
            !loadError &&
            Array.from(Array(8)).map((_, index) => (
              <div key={index} className={`${EXPANSION_KEY_CARD_CLASSES} p-4`}>
                <Skeleton variant='rectangular' height={32} width='50%' />
              </div>
            ))}

          {keysLoaded &&
            keys.map((key) => (
              <div
                key={key.globalIndex}
                className={`${EXPANSION_KEY_CARD_CLASSES} flex items-start gap-4 p-4`}
              >
                <div className='flex min-w-0 flex-1 flex-col gap-1'>
                  <span className='text-sm font-medium leading-5 text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                    {t('Devices.KEY', { number: key.number })}
                  </span>
                  {key.type ? (
                    <div className='flex min-w-0 items-center gap-4'>
                      <PhysicalPhoneKeyBadge type={key.type} />
                      {isPhoneKeyTypeWithValue(key.type) && (
                        <PhoneKeyLabel
                          tooltipId={`tooltip-expansion-key-${key.globalIndex}`}
                          text={getPhoneKeyTargetText(key.value, key.label)}
                          className='text-base font-medium leading-6 text-secondaryNeutral dark:text-secondaryNeutralDark'
                        />
                      )}
                    </div>
                  ) : (
                    <span className='text-base font-medium leading-6 text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                      {t('Devices.Not configured')}
                    </span>
                  )}
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='small'
                    onClick={() => editKey(key)}
                    data-tooltip-id={`tooltip-edit-expansion-key-${key.globalIndex}`}
                    data-tooltip-content={`${t('Common.Edit')}`}
                  >
                    <FontAwesomeIcon icon={faPenToSquare} className='h-4 w-4' />
                  </Button>
                  <CustomThemedTooltip
                    id={`tooltip-edit-expansion-key-${key.globalIndex}`}
                    place='top'
                    positionStrategy='fixed'
                  />
                  <Dropdown
                    position='left'
                    items={
                      <Dropdown.Item
                        icon={faCircleMinus}
                        onClick={() => setKeyToRemove(key)}
                        disabled={!key.type}
                      >
                        {t('Devices.Remove configuration')}
                      </Dropdown.Item>
                    }
                  >
                    <Button variant='ghost' size='small'>
                      <FontAwesomeIcon
                        icon={faEllipsisVertical}
                        className='h-4 w-4 text-primary dark:text-primaryDark'
                      />
                    </Button>
                  </Dropdown>
                </div>
              </div>
            ))}
        </div>
      </div>

      <ConfirmationModal
        show={keyToRemove !== null}
        focus={cancelRemoveKeyRef}
        title={t('Devices.Remove configuration')}
        description={
          keyToRemove
            ? t('Devices.Remove configuration modal message', {
                key: t('Devices.Key number', { number: keyToRemove.number }),
                description: getKeyDescription(keyToRemove),
              })
            : ''
        }
        confirmLabel={t('Common.Remove')}
        confirmVariant='primary'
        onConfirm={removeKeyConfiguration}
        onClose={() => setKeyToRemove(null)}
      />

      <ConfirmationModal
        show={showRemoveModal}
        focus={cancelRemoveRef}
        title={t('Devices.Remove module')}
        description={t('Devices.Remove expansion module modal message', {
          module: t('Devices.Expansion module', { number: moduleIndex + 1 }),
        })}
        confirmLabel={t('Common.Remove')}
        confirmVariant='primary'
        confirmDisabled={isRemoving}
        cancelDisabled={isRemoving}
        onConfirm={removeModule}
        onClose={() => setShowRemoveModal(false)}
      />
    </div>
  )
}

ExpansionModuleSection.displayName = 'ExpansionModuleSection'
