// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, MutableRefObject, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faArrowRotateLeft,
  faAngleDown,
  faAngleUp,
  faCircleInfo,
  faCirclePlus,
  faCircleXmark,
  faFloppyDisk,
  faGripVertical,
  faMagnifyingGlass,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import classNames from 'classnames'
import { useSelector } from 'react-redux'
import { isEmpty, isEqual } from 'lodash'
import { RootState } from '../../store'
import {
  Avatar,
  Button,
  ConfirmationModal,
  EmptyState,
  InlineNotification,
  Pagination,
  Skeleton,
  TextInput,
} from '../common'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { KeyTypeSelect } from './KeyTypeSelect'
import { DeviceSectionOperatorSearch } from './DeviceSectionOperatorSearch'
import { getKeyTypeSearchText, PhysicalPhoneKeyBadge } from './PhysicalPhoneKeyBadge'
import { KeyPositionInput } from './KeyPositionInput'
import { PhoneKeyLabel } from './PhoneKeyLabel'
import {
  getDefaultPhoneKeyLabel,
  getPhoneKeyTargetText,
  isPhoneKeyTypeWithValue,
  normalizePhoneKeyType,
  notifyPhoneConfigurationSaved,
  PHONE_KEY_CARD_CLASSES,
  PHONE_KEY_LABEL_CLASSES,
} from './phoneKeys'
import {
  getPhoneKeysConfiguration,
  openAddPhoneKeyDrawer,
  reloadPhysicalPhone,
  saveBtnsConfig,
} from '../../lib/devices'
import { customScrollbarClass } from '../../lib/utils'

export interface LineKeysSectionProps {
  deviceId: string
  phoneName: string
}

export interface PhoneKey {
  uid: number
  type: string
  value: string
  label: string
  isCustomTarget?: boolean
}

const KEYS_PER_PAGE = 10

export const LineKeysSection: FC<LineKeysSectionProps> = ({ deviceId, phoneName }) => {
  const operators: any = useSelector((state: RootState) => state.operators)

  const [macAddress, setMacAddress] = useState('')
  const [usableKeys, setUsableKeys] = useState(0)
  const [keys, setKeys] = useState<PhoneKey[]>([])
  const [originalKeys, setOriginalKeys] = useState<PhoneKey[]>([])
  const [keysLoaded, setKeysLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const nextUid = useRef(0)

  useEffect(() => {
    if (!isEmpty(operators?.extensions) && deviceId) {
      setMacAddress(operators?.extensions[deviceId]?.mac?.toUpperCase() || '')
    }
  }, [operators?.extensions, deviceId])

  useEffect(() => {
    if (!macAddress) {
      return
    }
    const loadConfiguration = async () => {
      try {
        setLoadError('')
        setKeysLoaded(false)
        const phoneKeys = await getPhoneKeysConfiguration(macAddress)
        if (!phoneKeys || isEmpty(phoneKeys.configuration)) {
          setLoadError('Cannot retrieve configuration information')
          return
        }
        const { configuration, lineKeysCount: keyCount } = phoneKeys
        setUsableKeys(keyCount)

        const loadedKeys: PhoneKey[] = []
        for (let i = 1; i <= keyCount; i++) {
          loadedKeys.push({
            uid: i,
            type: normalizePhoneKeyType(configuration?.variables?.[`linekey_type_${i}`] ?? ''),
            value: configuration?.variables?.[`linekey_value_${i}`] ?? '',
            label: configuration?.variables?.[`linekey_label_${i}`] ?? '',
          })
        }
        nextUid.current = keyCount + 1
        setKeys(loadedKeys)
        setOriginalKeys(loadedKeys)
        setKeysLoaded(true)
      } catch (error) {
        setLoadError('Cannot retrieve configuration information')
      }
    }
    loadConfiguration()
  }, [macAddress])

  const areAllPositionsInUse = usableKeys > 0 && keys.length >= usableKeys

  const hasChanges = useMemo(
    () =>
      !isEqual(
        keys.map(({ type, value, label }) => ({ type, value, label })),
        originalKeys.map(({ type, value, label }) => ({ type, value, label })),
      ),
    [keys, originalKeys],
  )

  const [textFilter, setTextFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const textFilterRef = useRef() as MutableRefObject<HTMLInputElement>

  const clearTextFilter = () => {
    setTextFilter('')
    textFilterRef.current?.focus()
  }

  const keysWithPosition = useMemo(
    () => keys.map((key, index) => ({ ...key, position: index + 1 })),
    [keys],
  )

  const filteredKeys = useMemo(() => {
    const filterText = textFilter.toLowerCase()
    if (!filterText) {
      return keysWithPosition
    }
    return keysWithPosition.filter((key) =>
      `${key.position} - ${key.label} (${key.value}) ${getKeyTypeSearchText(key.type)}`
        .toLowerCase()
        .includes(filterText),
    )
  }, [keysWithPosition, textFilter])

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / KEYS_PER_PAGE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const pageKeys = useMemo(() => {
    const lastIndex = currentPage * KEYS_PER_PAGE
    return filteredKeys.slice(lastIndex - KEYS_PER_PAGE, lastIndex)
  }, [filteredKeys, currentPage])

  const [expandedUid, setExpandedUid] = useState<number | null>(null)

  const toggleKeyRow = (uid: number) => {
    setExpandedUid(expandedUid === uid ? null : uid)
  }

  const updateKey = (uid: number, changes: Partial<PhoneKey>) => {
    setKeys((previousKeys) =>
      previousKeys.map((key) => (key.uid === uid ? { ...key, ...changes } : key)),
    )
  }

  const changeKeyType = (uid: number, type: string) => {
    const currentKey = keys.find((key) => key.uid === uid)
    if (!currentKey || currentKey.type === type) {
      return
    }
    updateKey(uid, { type, value: '', label: getDefaultPhoneKeyLabel(type) })
  }

  const changeKeyPosition = (uid: number, newPosition: number) => {
    if (newPosition < 1 || newPosition > keys.length) {
      return
    }
    const fromIndex = keys.findIndex((key) => key.uid === uid)
    if (fromIndex === -1 || fromIndex === newPosition - 1) {
      return
    }
    const updatedKeys = [...keys]
    const [moved] = updatedKeys.splice(fromIndex, 1)
    updatedKeys.splice(newPosition - 1, 0, moved)
    setKeys(updatedKeys)
    setCurrentPage(Math.ceil(newPosition / KEYS_PER_PAGE))
  }

  const deleteKey = (uid: number) => {
    setKeys((previousKeys) => previousKeys.filter((key) => key.uid !== uid))
    setExpandedUid(null)
  }

  const addKey = () => {
    if (keys.length >= usableKeys) {
      return
    }
    openAddPhoneKeyDrawer({
      defaultPosition: keys.length + 1,
      maxPosition: Math.min(keys.length + 1, usableKeys),
      onAdd: ({ position, type, value, label }) => {
        const newKey: PhoneKey = { uid: nextUid.current++, type, value, label }
        setKeys((previousKeys) => {
          const updatedKeys = [...previousKeys]
          const targetIndex = Math.min(Math.max(position - 1, 0), updatedKeys.length)
          updatedKeys.splice(targetIndex, 0, newKey)
          return updatedKeys.slice(0, usableKeys)
        })
        setCurrentPage(Math.ceil(position / KEYS_PER_PAGE))
        setExpandedUid(null)
      },
    })
  }

  const discardChanges = () => {
    setKeys(originalKeys)
    setExpandedUid(null)
    setTextFilter('')
  }

  const [draggedUid, setDraggedUid] = useState<number | null>(null)
  const [dragOverUid, setDragOverUid] = useState<number | null>(null)

  const isCustomTarget = (key: PhoneKey) =>
    key.isCustomTarget ?? (!!key.value && !operators?.extensions?.[key.value])

  const isDropTarget = (uid: number) => dragOverUid === uid && draggedUid !== uid

  const resetDrag = () => {
    setDraggedUid(null)
    setDragOverUid(null)
  }

  const enterDropTarget = (uid: number) => {
    setDragOverUid((previousUid) => (previousUid === uid ? previousUid : uid))
  }

  const leaveDropTarget = (event: DragEvent<HTMLLIElement>, uid: number) => {
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return
    }
    setDragOverUid((previousUid) => (previousUid === uid ? null : previousUid))
  }

  const handleDrop = (event: DragEvent<HTMLLIElement>, targetPosition: number) => {
    event.preventDefault()
    const droppedUid = Number(event.dataTransfer.getData('text/plain'))
    resetDrag()
    changeKeyPosition(droppedUid, targetPosition)
  }

  const [showAssignBlfModal, setShowAssignBlfModal] = useState(false)
  const cancelAssignBlfRef = useRef() as MutableRefObject<HTMLButtonElement>

  const sortedExtensions = useMemo(
    () =>
      Object.keys(operators?.extensions || {}).sort((extension1, extension2) =>
        extension1.localeCompare(extension2, undefined, { numeric: true }),
      ),
    [operators?.extensions],
  )

  const assignBlfToAllOperators = () => {
    const blfKeys: PhoneKey[] = []
    sortedExtensions.forEach((exten, index) => {
      if (index < usableKeys) {
        blfKeys.push({
          uid: nextUid.current++,
          type: 'blf',
          label: operators?.extensions[exten]?.name || '',
          value: exten,
        })
      }
    })
    const updatedKeys = [...keys]
    updatedKeys.splice(0, blfKeys.length, ...blfKeys)
    setKeys(updatedKeys)
    setShowAssignBlfModal(false)
    setExpandedUid(null)
  }

  const assignBlfExampleRows = () =>
    sortedExtensions.slice(0, 2).map((key, index) => {
      const exampleOperator = operators?.extensions[key]
      const operatorName = exampleOperator?.name || '-'
      const operatorExtension = exampleOperator?.exten || '-'

      return (
        <div
          key={key}
          className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)] items-center gap-3 py-2'
        >
          <div className='flex min-w-0 items-center gap-2'>
            <Avatar
              size='small'
              placeholderType='person'
              src={operators?.avatars[exampleOperator?.username]}
              status={operators?.operators[exampleOperator?.username]?.mainPresence}
            />
            <span className='truncate'>{operatorName}</span>
          </div>

          <FontAwesomeIcon
            icon={faArrowRight}
            className='h-4 w-4 shrink-0 text-tertiaryNeutral dark:text-tertiaryNeutralDark'
          />

          <div className='flex min-w-0 items-center gap-2'>
            <FontAwesomeIcon
              icon={faGripVertical}
              className='h-4 w-4 shrink-0 text-secondaryNeutral dark:text-secondaryNeutralDark'
            />
            <span className='shrink-0'>{index + 1} -</span>
            <span className='truncate'>{operatorName}</span>
            <span className='shrink-0'>({operatorExtension})</span>
          </div>
        </div>
      )
    })

  const [isSaving, setIsSaving] = useState(false)

  const saveKeys = async () => {
    const configuration: any = { variables: {} }
    for (let i = 1; i <= usableKeys; i++) {
      const key = keys[i - 1]
      configuration.variables[`linekey_type_${i}`] = key?.type || ''
      configuration.variables[`linekey_value_${i}`] = key?.value || ''
      configuration.variables[`linekey_label_${i}`] = key?.label || ''
    }

    try {
      setIsSaving(true)
      setSaveError('')
      await saveBtnsConfig(macAddress, configuration)
      if (deviceId) {
        await reloadPhysicalPhone(deviceId)
      }
      setOriginalKeys(keys)
      setExpandedUid(null)
      notifyPhoneConfigurationSaved(phoneName)
    } catch (error) {
      setSaveError('Cannot save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='flex flex-col gap-8 flex-1 min-h-0 min-w-0'>
      <div className='flex items-start justify-between gap-4'>
        <div className='w-80'>
          <TextInput
            placeholder={t('Devices.Search') || ''}
            value={textFilter}
            onChange={(event) => setTextFilter(event.target.value)}
            ref={textFilterRef}
            icon={textFilter?.length ? faCircleXmark : faMagnifyingGlass}
            onIconClick={textFilter?.length ? () => clearTextFilter() : undefined}
            trailingIcon={textFilter?.length ? true : false}
          />
        </div>
        <div className='flex items-center gap-6'>
          <span
            data-tooltip-id='tooltip-add-key-unavailable'
            data-tooltip-content={
              areAllPositionsInUse ? t('Devices.Add key unavailable tooltip') : ''
            }
          >
            <Button variant='ghost' onClick={addKey} disabled={!keysLoaded || areAllPositionsInUse}>
              <FontAwesomeIcon icon={faCirclePlus} className='mr-3 h-4 w-4' />
              <span>{t('Devices.Add key')}</span>
            </Button>
          </span>
          {areAllPositionsInUse && (
            <CustomThemedTooltip
              id='tooltip-add-key-unavailable'
              place='top'
              className='whitespace-normal text-left'
              positionStrategy='fixed'
            />
          )}
          <Button
            variant='white'
            onClick={() => setShowAssignBlfModal(true)}
            disabled={!keysLoaded || isEmpty(operators?.extensions)}
          >
            <span>{t('Devices.Assign BLF to all operators')}</span>
          </Button>
        </div>
      </div>

      {hasChanges && (
        <InlineNotification type='info' title={t('Devices.Unsaved changes')}>
          <p>{t('Devices.Unsaved changes description')}</p>
        </InlineNotification>
      )}

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
        <ul className='flex flex-col gap-3'>
          {!keysLoaded &&
            !loadError &&
            Array.from(Array(6)).map((_, index) => (
              <li key={index} className={`${PHONE_KEY_CARD_CLASSES} p-4`}>
                <Skeleton variant='rectangular' height={24} width='33%' />
              </li>
            ))}

          {keysLoaded && pageKeys.length === 0 && (
            <li>
              <EmptyState
                title={t('Devices.No keys found') || ''}
                description={t('Common.Try changing your search filters') || ''}
                icon={<FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden='true' />}
              >
                <Button variant='ghost' size='large' onClick={() => clearTextFilter()}>
                  {t('Common.Reset filters')}
                </Button>
              </EmptyState>
            </li>
          )}

          {pageKeys.map((key) => (
            <li
              key={key.uid}
              draggable
              onDragStart={(event: DragEvent<HTMLLIElement>) => {
                event.dataTransfer.setData('text/plain', String(key.uid))
                setDraggedUid(key.uid)
              }}
              onDragEnter={() => enterDropTarget(key.uid)}
              onDragOver={(event: DragEvent<HTMLLIElement>) => {
                event.preventDefault()
                enterDropTarget(key.uid)
              }}
              onDragLeave={(event: DragEvent<HTMLLIElement>) => leaveDropTarget(event, key.uid)}
              onDragEnd={resetDrag}
              onDrop={(event: DragEvent<HTMLLIElement>) => handleDrop(event, key.position)}
              className={classNames(
                'rounded-lg',
                isDropTarget(key.uid)
                  ? 'bg-surfaceBadgeEmerald dark:bg-surfaceBadgeEmeraldDark'
                  : PHONE_KEY_CARD_CLASSES,
                draggedUid === key.uid && 'bg-gray-100/70 dark:bg-gray-800/70',
                isDropTarget(key.uid) && '[&>*]:invisible',
                draggedUid !== null && '[&_*]:pointer-events-none',
              )}
            >
              <div className='flex items-center justify-between p-4'>
                <div className='flex items-center gap-6 min-w-0'>
                  <FontAwesomeIcon
                    icon={faGripVertical}
                    className='h-4 w-4 shrink-0 cursor-grab text-secondaryNeutral dark:text-secondaryNeutralDark'
                  />
                  <span className='w-[30px] shrink-0 text-base font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {key.position}-
                  </span>
                  {key.type ? (
                    <div className='flex items-center gap-3 min-w-0'>
                      <PhysicalPhoneKeyBadge type={key.type} />
                      {isPhoneKeyTypeWithValue(key.type) && (
                        <PhoneKeyLabel
                          tooltipId={`tooltip-line-key-${key.uid}`}
                          text={getPhoneKeyTargetText(key.value, key.label)}
                          className='text-base font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'
                        />
                      )}
                    </div>
                  ) : (
                    <span className='text-base font-medium text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                      {t('Devices.Not configured')}
                    </span>
                  )}
                </div>
                <Button
                  variant='ghost'
                  size='small'
                  className='-my-2.5 -mr-2.5'
                  onClick={() => toggleKeyRow(key.uid)}
                >
                  <FontAwesomeIcon
                    icon={expandedUid === key.uid ? faAngleUp : faAngleDown}
                    className='h-4 w-4 text-primaryNeutral dark:text-primaryNeutralDark'
                  />
                </Button>
              </div>

              {expandedUid === key.uid && (
                <div className='flex flex-col gap-4 px-4 pb-4'>
                  <div>
                    <div className='flex items-center'>
                      <span className={PHONE_KEY_LABEL_CLASSES}>{t('Devices.Key position')}</span>
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className='h-4 w-4 pl-2 text-primaryIndigo dark:text-primaryIndigoDark'
                        aria-hidden='true'
                        data-tooltip-id={`tooltip-key-position-${key.uid}`}
                        data-tooltip-content={t('Devices.Key position information tooltip') || ''}
                      />
                      <CustomThemedTooltip
                        id={`tooltip-key-position-${key.uid}`}
                        place='right'
                        className='whitespace-normal text-left'
                      />
                    </div>
                    <KeyPositionInput
                      value={key.position}
                      max={keys.length}
                      onChange={(newPosition) => changeKeyPosition(key.uid, newPosition)}
                      className='mt-2 w-56'
                    />
                  </div>

                  <KeyTypeSelect
                    defaultSelectedType={key.type}
                    updateSelectedTypeKey={(type: string) => changeKeyType(key.uid, type)}
                  />

                  {(key.type === 'blf' || key.type === 'speed_dial') && (
                    <div>
                      <div className='mb-2'>
                        <span className={PHONE_KEY_LABEL_CLASSES}>
                          {key.type === 'blf'
                            ? t('Devices.Name or extension')
                            : t('Devices.Name or number')}
                        </span>
                      </div>
                      <DeviceSectionOperatorSearch
                        typeSelected={key.type}
                        value={key.value}
                        label={key.label}
                        onChange={({ value, label, isCustom }) =>
                          updateKey(key.uid, {
                            value,
                            ...(label !== null ? { label } : {}),
                            isCustomTarget: isCustom,
                          })
                        }
                        placeholder={`${
                          key.type === 'blf'
                            ? t('Devices.Type or choose extension')
                            : t('Devices.Type or choose name or number')
                        }`}
                      />
                    </div>
                  )}

                  {isPhoneKeyTypeWithValue(key.type) && isCustomTarget(key) && (
                    <TextInput
                      label={`${t('Devices.Label')}`}
                      optional
                      placeholder={`${t('Devices.Label placeholder')}`}
                      value={key.label}
                      onChange={(event) => updateKey(key.uid, { label: event.target.value })}
                    />
                  )}

                  <div>
                    <Button variant='ghost' onClick={() => deleteKey(key.uid)}>
                      <FontAwesomeIcon icon={faTrash} className='mr-3 h-4 w-4' />
                      <span>{t('Devices.Delete key')}</span>
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className='-mt-4 flex items-center justify-between gap-4 border-t border-layoutDivider dark:border-layoutDividerDark pt-4 px-1 pb-1'>
        <div className='flex items-center gap-6'>
          <Button variant='ghost' onClick={discardChanges} disabled={!hasChanges || isSaving}>
            <FontAwesomeIcon icon={faArrowRotateLeft} className='mr-3 h-4 w-4' />
            <span>{t('Devices.Discard changes')}</span>
          </Button>
          <Button variant='primary' onClick={saveKeys} disabled={!hasChanges || isSaving}>
            <FontAwesomeIcon icon={faFloppyDisk} className='mr-3 h-4 w-4' />
            <span>{t('Common.Save')}</span>
          </Button>
        </div>
        <Pagination
          bare
          labelVariant='page'
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredKeys.length}
          pageSize={KEYS_PER_PAGE}
          onPreviousPage={() => setCurrentPage(currentPage - 1)}
          onNextPage={() => setCurrentPage(currentPage + 1)}
        />
      </div>

      <ConfirmationModal
        show={showAssignBlfModal}
        focus={cancelAssignBlfRef}
        type='info'
        title={t('Devices.Assign keys for all operators')}
        description={`${t('Devices.Assign key for all operators modal message')}. ${t(
          'Devices.Assign key for all operators modal warning',
        )}`}
        confirmLabel={t('Devices.Assign keys')}
        confirmVariant='primary'
        onConfirm={assignBlfToAllOperators}
        onClose={() => setShowAssignBlfModal(false)}
      >
        <div className='flex flex-col gap-2'>
          <span className={PHONE_KEY_LABEL_CLASSES}>{t('Common.Example')}</span>
          <div>{assignBlfExampleRows()}</div>
        </div>
      </ConfirmationModal>
    </div>
  )
}

LineKeysSection.displayName = 'LineKeysSection'
