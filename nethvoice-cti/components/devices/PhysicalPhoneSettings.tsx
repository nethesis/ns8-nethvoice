// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, MutableRefObject, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleInfo,
  faCirclePlus,
  faEye,
  faEyeSlash,
  faFloppyDisk,
  faGear,
} from '@fortawesome/free-solid-svg-icons'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { t } from 'i18next'
import classNames from 'classnames'
import {
  Breadcrumb,
  Button,
  ConfirmationModal,
  EmptyState,
  InlineNotification,
  TextInput,
} from '../common'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { LineKeysSection } from './LineKeysSection'
import { ExpansionModuleSection } from './ExpansionModuleSection'
import {
  getDevicesPinStatusForDevice,
  getPhoneKeysConfiguration,
  reloadPhysicalPhone,
  setPin,
} from '../../lib/devices'
import { loadPreference, savePreference } from '../../lib/storage'
import { openToast } from '../../lib/utils'
import { generateRandomPin, notifyPhoneConfigurationSaved } from './phoneKeys'

export interface PhysicalPhoneSettingsProps {
  phone: any
  pinStatus: boolean
  onBack: () => void
}

type PhoneSettingsTab = 'lineKeys' | 'generalSettings' | number

const EXPANSION_MODULES_PREFERENCE = 'phoneExpansionModules'

export const PhysicalPhoneSettings: FC<PhysicalPhoneSettingsProps> = ({
  phone,
  pinStatus,
  onBack,
}) => {
  const [currentTab, setCurrentTab] = useState<PhoneSettingsTab>('lineKeys')
  const phoneName = phone?.description || t('Devices.IP phone')
  const operators: any = useSelector((state: RootState) => state.operators)
  const authUsername = useSelector((state: RootState) => state.authentication.username)

  const [macAddress, setMacAddress] = useState('')
  const [expansionModules, setExpansionModules] = useState(0)
  const [maxExpansionModules, setMaxExpansionModules] = useState(0)
  const [expansionKeysPerModule, setExpansionKeysPerModule] = useState(0)
  const [showAddModuleModal, setShowAddModuleModal] = useState(false)
  const cancelAddModuleRef = useRef() as MutableRefObject<HTMLButtonElement>

  useEffect(() => {
    const phoneMacAddress = operators?.extensions?.[phone?.id]?.mac?.toUpperCase() || ''
    setMacAddress((previousMacAddress) =>
      previousMacAddress === phoneMacAddress ? previousMacAddress : phoneMacAddress,
    )
  }, [operators?.extensions, phone?.id])

  useEffect(() => {
    if (!macAddress) {
      return
    }
    const loadExpansionModules = async () => {
      try {
        const phoneKeys = await getPhoneKeysConfiguration(macAddress)
        if (!phoneKeys) {
          return
        }
        const { configuration, expansionKeysPerModule, expansionModulesCount } = phoneKeys
        setMaxExpansionModules(expansionModulesCount)
        setExpansionKeysPerModule(expansionKeysPerModule)
        if (!expansionKeysPerModule || !expansionModulesCount) {
          return
        }
        let lastConfiguredKey = 0
        for (let i = 1; i <= expansionKeysPerModule * expansionModulesCount; i++) {
          if (configuration?.variables?.[`expkey_type_${i}`]) {
            lastConfiguredKey = i
          }
        }
        const modulesFromKeys = Math.ceil(lastConfiguredKey / expansionKeysPerModule)
        const storedModules =
          loadPreference(EXPANSION_MODULES_PREFERENCE, authUsername)?.[macAddress] || 0
        setExpansionModules(
          Math.min(Math.max(modulesFromKeys, storedModules), expansionModulesCount),
        )
      } catch (error) {
        setExpansionModules(0)
      }
    }
    loadExpansionModules()
  }, [macAddress, authUsername])

  useEffect(() => {
    if (typeof currentTab === 'number' && currentTab >= expansionModules) {
      setCurrentTab('generalSettings')
    }
  }, [currentTab, expansionModules])

  const rememberExpansionModules = (modules: number) => {
    if (!macAddress) {
      return
    }
    const storedModules = loadPreference(EXPANSION_MODULES_PREFERENCE, authUsername) || {}
    savePreference(
      EXPANSION_MODULES_PREFERENCE,
      { ...storedModules, [macAddress]: modules },
      authUsername,
    )
  }

  const addExpansionModule = () => {
    const newModules = expansionModules + 1
    setExpansionModules(newModules)
    rememberExpansionModules(newModules)
    setShowAddModuleModal(false)
    setCurrentTab(newModules - 1)
    openToast(
      'success',
      `${t('Devices.Expansion module added description')}`,
      `${t('Devices.Expansion module added')}`,
    )
  }

  const removeExpansionModule = (moduleIndex: number) => {
    const newModules = Math.max(expansionModules - 1, 0)
    setExpansionModules(newModules)
    rememberExpansionModules(newModules)
    if (newModules === 0) {
      setCurrentTab('generalSettings')
    } else {
      setCurrentTab(Math.max(moduleIndex - 1, 0))
    }
  }

  const [pinValue, setPinValue] = useState('')
  const [savedPinValue, setSavedPinValue] = useState('')
  const [pinVisible, setPinVisible] = useState(false)
  const [isSavingPin, setIsSavingPin] = useState(false)
  const [savePinError, setSavePinError] = useState('')

  useEffect(() => {
    if (!pinStatus) {
      return
    }
    const retrievePinStatus = async () => {
      try {
        const pinInformation = await getDevicesPinStatusForDevice()
        const currentPin =
          pinInformation?.[phone?.id]?.enabled && pinInformation?.[phone?.id]?.pin !== ''
            ? pinInformation[phone?.id].pin
            : ''
        setPinValue(currentPin)
        setSavedPinValue(currentPin)
      } catch (error) {
        setPinValue('')
        setSavedPinValue('')
      }
    }
    retrievePinStatus()
  }, [phone?.id, pinStatus])

  const setRandomPin = () => {
    setPinValue(generateRandomPin())
  }

  const savePin = async () => {
    try {
      setIsSavingPin(true)
      setSavePinError('')
      await setPin({
        extension: phone?.id,
        enabled: pinValue !== '',
        pin: pinValue !== '' ? pinValue : generateRandomPin(),
      })
      if (phone?.id) {
        await reloadPhysicalPhone(phone?.id)
      }
      setSavedPinValue(pinValue)
      notifyPhoneConfigurationSaved(phoneName)
    } catch (error) {
      setSavePinError('Cannot save the pin')
    } finally {
      setIsSavingPin(false)
    }
  }

  const tabs: { id: PhoneSettingsTab; label: string }[] = [
    { id: 'lineKeys', label: t('Devices.Line keys') },
    { id: 'generalSettings', label: t('Devices.General settings') },
    ...Array.from({ length: expansionModules }, (_, index) => ({
      id: index as PhoneSettingsTab,
      label: t('Devices.Expansion module', { number: index + 1 }),
    })),
  ]

  return (
    <div className='flex flex-col gap-8 flex-1 min-h-0 min-w-0 pr-1'>
      <div className='flex flex-col gap-2'>
        <Breadcrumb
          size='xs'
          className='mb-0'
          previousLink={{ label: t('Devices.Devices'), onClick: onBack }}
          currentPage={t('Devices.Phone settings', { name: phoneName })}
        />
        <div className='flex items-center justify-between gap-4'>
          <h2 className='text-xl font-medium leading-7 text-primaryNeutral dark:text-primaryNeutralDark'>
            {t('Devices.Phone settings', { name: phoneName })}
          </h2>
          <Button
            variant='ghost'
            onClick={() => setShowAddModuleModal(true)}
            disabled={
              maxExpansionModules === 0 ||
              expansionKeysPerModule === 0 ||
              expansionModules >= maxExpansionModules
            }
          >
            <FontAwesomeIcon icon={faCirclePlus} className='mr-3 h-4 w-4' />
            <span>{t('Devices.Add expansion module')}</span>
          </Button>
        </div>
      </div>

      <div className='flex gap-8 border-b border-layoutDivider dark:border-layoutDividerDark'>
        {tabs.map((tab) => (
          <button
            key={String(tab?.id)}
            onClick={() => setCurrentTab(tab.id)}
            className={classNames(
              'flex flex-col items-center justify-center px-1 pb-4 text-sm font-medium leading-5 cursor-pointer',
              currentTab === tab?.id
                ? 'border-b-2 border-primary dark:border-primaryDark text-primary dark:text-primaryDark'
                : 'text-tertiaryNeutral dark:text-tertiaryNeutralDark',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {typeof currentTab === 'number' ? (
        <ExpansionModuleSection
          key={currentTab}
          deviceId={phone?.id}
          phoneName={phoneName}
          moduleIndex={currentTab}
          isLastModule={currentTab === expansionModules - 1}
          onRemoved={() => removeExpansionModule(currentTab)}
        />
      ) : currentTab === 'lineKeys' ? (
        <LineKeysSection deviceId={phone?.id} phoneName={phoneName} />
      ) : (
        <div className='flex flex-col gap-6 items-start'>
          {pinStatus ? (
            <>
              <div className='flex items-end gap-6'>
                <div className='w-80'>
                  <div className='flex items-end justify-between gap-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                        {t('Devices.PIN')}
                      </span>
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className='h-4 w-4 text-primaryIndigo dark:text-primaryIndigoDark'
                        aria-hidden='true'
                        data-tooltip-id='tooltip-phone-pin-information'
                        data-tooltip-content={t('Devices.Pin information tooltip') || ''}
                      />
                      <CustomThemedTooltip
                        id='tooltip-phone-pin-information'
                        place='right'
                        className='whitespace-normal text-left'
                      />
                    </div>
                    <span className='text-sm leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                      {t('Devices.Optional')}
                    </span>
                  </div>
                  <TextInput
                    className='mt-2'
                    placeholder={t('Devices.Create a pin') || ''}
                    name='pin'
                    type={pinVisible ? 'text' : 'password'}
                    icon={pinVisible ? faEye : faEyeSlash}
                    onIconClick={() => setPinVisible(!pinVisible)}
                    trailingIcon={true}
                    pattern='[0-9]*'
                    maxLength={10}
                    value={pinValue}
                    onChange={(event) => setPinValue(event.target.value.replace(/[^0-9]/g, ''))}
                    autoComplete='off'
                  />
                </div>
                <Button variant='white' onClick={setRandomPin}>
                  <span>{t('Devices.Generate random PIN')}</span>
                </Button>
              </div>

              {savePinError && (
                <InlineNotification type='error' title={t('Common.Error')}>
                  <p>{t('Devices.Cannot save the pin')}</p>
                </InlineNotification>
              )}

              <Button
                variant='primary'
                onClick={savePin}
                disabled={isSavingPin || pinValue === savedPinValue}
              >
                <FontAwesomeIcon icon={faFloppyDisk} className='mr-3 h-4 w-4' />
                <span>{t('Common.Save')}</span>
              </Button>
            </>
          ) : (
            <EmptyState
              title={t('Devices.No general settings available') || ''}
              icon={
                <FontAwesomeIcon icon={faGear} className='mx-auto h-8 w-8' aria-hidden='true' />
              }
            />
          )}
        </div>
      )}

      <ConfirmationModal
        show={showAddModuleModal}
        focus={cancelAddModuleRef}
        title={t('Devices.Add expansion module')}
        description={t('Devices.Add expansion module modal message')}
        confirmLabel={t('Common.Add')}
        confirmVariant='primary'
        type='info'
        onConfirm={addExpansionModule}
        onClose={() => setShowAddModuleModal(false)}
      />
    </div>
  )
}

PhysicalPhoneSettings.displayName = 'PhysicalPhoneSettings'
