// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SpeedDialType } from '../../../services/types'
import { useState, useEffect, useRef, MutableRefObject, useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPhone,
  faPlus,
  faEllipsisVertical,
  faPen,
  faBolt,
  faTrash,
  faFileImport,
  faFileArrowDown,
  faCheckCircle,
  faCirclePlus,
  faSortAmountAsc,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Button, Avatar, ConfirmationModal, Modal, Dropdown, InlineNotification, EmptyState } from '../../common'
import { Skeleton } from '../../common/Skeleton'
import { deleteSpeedDial, getSpeedDials, importCsvSpeedDial } from '../../../services/phonebook'
import {
  sortSpeedDials,
  openCreateSpeedDialDrawer,
  openEditSpeedDialDrawer,
  exportSpeedDial,
} from '../../../lib/speedDial'
import { canCreatePhonebookContacts, canWritePhonebookVisibility } from '../../../lib/phonebook'
import { t } from 'i18next'
import { callPhoneNumber, transferCallToExtension, customScrollbarClass } from '../../../lib/utils'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { Tooltip } from 'react-tooltip'
import { CustomThemedTooltip } from '../CustomThemedTooltip'

const SpeedDialItemSkeleton = () => (
  <div className='group relative flex items-center py-2 px-6'>
    <div className='absolute inset-0' aria-hidden='true' />
    <div className='relative flex min-w-0 flex-1 items-center justify-between'>
      <div className='flex items-center'>
        <Skeleton variant='circular' width='40px' height='40px' />
        <div className='ml-4 flex flex-col gap-1'>
          <Skeleton width='128px' height='12px' />
          <Skeleton width='80px' height='12px' className='mt-1' />
        </div>
      </div>
    </div>
  </div>
)

// Type for modal states
type ModalState = {
  delete: boolean
  deleteAll: boolean
  importCsv: boolean
}

export const SpeedDialContent = () => {
  const [modalState, setModalState] = useState<ModalState>({
    delete: false,
    deleteAll: false,
    importCsv: false,
  })

  // Data states
  const [speedDials, setSpeedDials] = useState<SpeedDialType[]>([])
  const [currentItem, setCurrentItem] = useState<SpeedDialType | null>(null)
  const [csvBase64, setCsvBase64] = useState('')
  const [isSpeedDialLoaded, setSpeedDialLoaded] = useState(false)

  // Error states
  const [errors, setErrors] = useState({
    getSpeedDial: '',
    deleteSpeedDial: '',
    deleteAllSpeedDial: '',
    importCsv: '',
  })

  const cancelButtonRef = useRef() as MutableRefObject<HTMLButtonElement>
  const [firstRender, setFirstRender] = useState(true)

  const { profile } = useSelector((state: RootState) => state.user)
  const operators: any = useSelector((state: RootState) => state.operators)
  const authStore: any = useSelector((state: RootState) => state.authentication)
  const speedDialStore = useSelector((state: RootState) => state.speedDial)
  const canCreateSpeedDials = canCreatePhonebookContacts(profile)
  const canWriteSpeedDials = canWritePhonebookVisibility(profile, 'private')

  // Reset specific error
  const resetError = useCallback((errorType: keyof typeof errors) => {
    setErrors((prev) => ({ ...prev, [errorType]: '' }))
  }, [])

  // Sort state
  const [sort, setSort] = useState<string>('name_asc')

  // Sort speed dials
  const sortSpeedDialsList = useCallback(
    (sortType: string) => {
      setSort(sortType)
      let sortedList = [...speedDials]

      switch (sortType) {
        case 'name_asc':
          sortedList.sort((a, b) => {
            const nameA = a.name?.toUpperCase() || a.company?.toUpperCase() || ''
            const nameB = b.name?.toUpperCase() || b.company?.toUpperCase() || ''
            return nameA.localeCompare(nameB)
          })
          break
        case 'name_desc':
          sortedList.sort((a, b) => {
            const nameA = a.name?.toUpperCase() || a.company?.toUpperCase() || ''
            const nameB = b.name?.toUpperCase() || b.company?.toUpperCase() || ''
            return nameB.localeCompare(nameA)
          })
          break
        case 'number_asc':
          sortedList.sort((a, b) => {
            return (a.speeddial_num || '').localeCompare(b.speeddial_num || '')
          })
          break
        case 'number_desc':
          sortedList.sort((a, b) => {
            return (b.speeddial_num || '').localeCompare(a.speeddial_num || '')
          })
          break
        default:
          // Default to name ascending
          sortedList.sort((a, b) => {
            const nameA = a.name?.toUpperCase() || a.company?.toUpperCase() || ''
            const nameB = b.name?.toUpperCase() || b.company?.toUpperCase() || ''
            return nameA.localeCompare(nameB)
          })
      }

      setSpeedDials(sortedList)
    },
    [speedDials],
  )

  // Load speed dials
  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    const loadSpeedDials = async () => {
      if (!isSpeedDialLoaded && profile?.macro_permissions?.phonebook?.value) {
        try {
          resetError('getSpeedDial')
          const fetchedSpeedDials = await getSpeedDials()
          // remove operators favorite contacts
          const filteredSpeedDials = fetchedSpeedDials.filter(
            (speedDial) => speedDial.notes !== 'speeddial-favorite',
          )

          // Apply initial sorting
          const initialSorted = sortSpeedDials(filteredSpeedDials)
          setSpeedDials(initialSorted)
          setSpeedDialLoaded(true)

          // Apply current sort if needed
          if (sort !== 'name_asc') {
            setTimeout(() => sortSpeedDialsList(sort), 0)
          }
        } catch (error) {
          setErrors((prev) => ({ ...prev, getSpeedDial: 'Cannot retrieve speed dial' }))
        }
      }
    }

    loadSpeedDials()
  }, [
    firstRender,
    isSpeedDialLoaded,
    profile?.macro_permissions?.phonebook?.value,
    resetError,
    sort,
    sortSpeedDialsList,
  ])

  // Reload speed dials when store changes
  useEffect(() => {
    setSpeedDialLoaded(false)
  }, [speedDialStore])

  // Functions to handle modals
  const openModal = useCallback(
    (modalType: keyof ModalState, item?: SpeedDialType) => {
      if (item) setCurrentItem(item)
      resetError(
        modalType === 'delete'
          ? 'deleteSpeedDial'
          : modalType === 'deleteAll'
          ? 'deleteAllSpeedDial'
          : 'importCsv',
      )
      setModalState((prev) => ({ ...prev, [modalType]: true }))
    },
    [resetError],
  )

  const closeModal = useCallback((modalType: keyof ModalState) => {
    setModalState((prev) => ({ ...prev, [modalType]: false }))
    if (modalType === 'delete') setCurrentItem(null)
  }, [])

  // Delete a speed dial
  const handleDeleteItem = useCallback(async () => {
    if (!currentItem?.id) return

    try {
      await deleteSpeedDial({
        id: currentItem.id.toString(),
      })
      setSpeedDialLoaded(false)
      closeModal('delete')
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        deleteSpeedDial: t('SpeedDial.Cannot delete speed dial') || '',
      }))
    }
  }, [currentItem, closeModal])

  // Delete all speed dials
  const handleDeleteAllItems = useCallback(async () => {
    try {
      // Single delete post for every speed dial elements
      const deletePromises = speedDials.map(async (item) => {
        if (item?.id) {
          try {
            await deleteSpeedDial({ id: item.id.toString() })
          } catch (error) {
            console.error(`Error deleting ${item.id}:`, error)
            return false
          }
        }
        return true
      })

      await Promise.all(deletePromises)
      setSpeedDialLoaded(false)
      closeModal('deleteAll')
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        deleteAllSpeedDial: t('SpeedDial.Cannot delete speed dial') || '',
      }))
    }
  }, [speedDials, closeModal])

  // Import CSV
  const handleImportCsv = useCallback(async () => {
    if (!csvBase64) return

    try {
      await importCsvSpeedDial({ file64: csvBase64 })
      setSpeedDialLoaded(false)
      closeModal('importCsv')
    } catch (error) {
      setErrors((prev) => ({ ...prev, importCsv: t('SpeedDial.Cannot import speed dial') || '' }))
    }
  }, [csvBase64, closeModal])

  // Function to call speed dial
  const callSpeedDial = useCallback(
    (speedDial: any) => {
      const mainPresence = operators?.operators[authStore?.username]?.mainPresence
      const mainExtension =
        operators?.operators[authStore?.username]?.endpoints?.mainextension?.[0]?.id

      if (mainPresence && mainPresence === 'busy') {
        transferCallToExtension(speedDial?.speeddial_num)
      } else if (mainExtension !== speedDial?.speeddial_num) {
        callPhoneNumber(speedDial?.speeddial_num)
      }
    },
    [operators, authStore],
  )

  // Handle file import
  const importSpeedDial = useCallback(
    (selectedFile: any) => {
      if (!selectedFile?.target?.files || !selectedFile.target.files[0]) {
        setErrors((prev) => ({ ...prev, importCsv: t('SpeedDial.Upload failed') || '' }))
        return
      }

      const reader = new FileReader()
      reader.onload = (ev: any) => {
        setCsvBase64(ev.target?.result as string)
        if (selectedFile.target) {
          selectedFile.target.value = ''
        }
      }
      reader.readAsDataURL(selectedFile.target.files[0])
      openModal('importCsv')
    },
    [openModal],
  )

  const getItemsMenu = useCallback(
    (speedDial: any) => (
      <>
        <div className='border-b border-gray-200 dark:border-gray-700'>
          <Dropdown.Item icon={faPen} onClick={() => openEditSpeedDialDrawer(speedDial)}>
            {t('Common.Edit')}
          </Dropdown.Item>
        </div>
        <Dropdown.Item icon={faTrash} isRed onClick={() => openModal('delete', speedDial)}>
          {t('Common.Delete')}
        </Dropdown.Item>
      </>
    ),
    [openModal],
  )

  // Dropdown for import/export
  const speedDialMenuTemplate = useMemo(
    () => (
      <>
        {canCreateSpeedDials && (
          <Dropdown.Item
            icon={faFileImport}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.csv'
              input.onchange = importSpeedDial
              input.click()
            }}
          >
            {t('SpeedDial.Import CSV')}
          </Dropdown.Item>
        )}
        {speedDials.length > 0 && (
          <>
            <Dropdown.Item icon={faFileArrowDown} onClick={() => exportSpeedDial(speedDials)}>
              {t('SpeedDial.Export CSV')}
            </Dropdown.Item>
            {canWriteSpeedDials && (
              <>
                <div className='relative pb-2'>
                  <div className='absolute inset-0 flex items-center' aria-hidden='true'>
                    <div className='w-full border-t border-gray-300 dark:border-gray-600' />
                  </div>
                </div>
                <Dropdown.Item icon={faTrash} isRed onClick={() => openModal('deleteAll')}>
                  {t('SpeedDial.Delete all')}
                </Dropdown.Item>
              </>
            )}
          </>
        )}
      </>
    ),
    [speedDials, canCreateSpeedDials, canWriteSpeedDials, importSpeedDial, openModal],
  )

  // Main content
  return (
    <>
      <div className='flex h-full flex-col bg-sidebar dark:bg-sidebarDark'>
        <div className='py-4 px-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-medium text-textLight dark:text-textDark'>
              {t('SpeedDial.Speed dial')}
            </h2>
            <div className='flex gap-2 items-center'>
              {isSpeedDialLoaded && speedDials?.length > 0 && (
                <>
                  {canCreateSpeedDials && (
                    <div className='h-7 flex items-center'>
                      <Button
                        variant='white'
                        className='h-9'
                        onClick={() => openCreateSpeedDialDrawer()}
                        data-tooltip-id='add-speed-dial-tooltip'
                        data-tooltip-content={t('SpeedDial.Create speed dial') || ''}
                      >
                        <FontAwesomeIcon
                          icon={faCirclePlus}
                          className='h-4 w-4 text-primaryActive dark:text-primaryActiveDark'
                        />
                        <CustomThemedTooltip id='add-speed-dial-tooltip' place='bottom' />
                      </Button>
                    </div>
                  )}

                  {/* Sort dropdown */}
                  <Dropdown
                    items={
                      <>
                        <Dropdown.Header>
                          <span>{t('SpeedDial.Sort by')}</span>
                        </Dropdown.Header>
                        <Dropdown.Item onClick={() => sortSpeedDialsList('name_asc')}>
                          <span>{t('SpeedDial.Name (A-Z)')}</span>
                          {sort === 'name_asc' && (
                            <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                          )}
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => sortSpeedDialsList('name_desc')}>
                          <span>{t('SpeedDial.Name (Z-A)')}</span>
                          {sort === 'name_desc' && (
                            <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                          )}
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => sortSpeedDialsList('number_asc')}>
                          <span>{t('SpeedDial.Number (ascending)')}</span>
                          {sort === 'number_asc' && (
                            <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                          )}
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => sortSpeedDialsList('number_desc')}>
                          <span>{t('SpeedDial.Number (descending)')}</span>
                          {sort === 'number_desc' && (
                            <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                          )}
                        </Dropdown.Item>
                      </>
                    }
                    position='left'
                  >
                    <Button
                      className='h-9 w-9'
                      variant='white'
                      data-tooltip-id='sort-speed-dial-tooltip'
                      data-tooltip-content={t('SpeedDial.Sort speed dials') || ''}
                    >
                      <FontAwesomeIcon icon={faSortAmountAsc} className='h-4 w-4' />
                      <CustomThemedTooltip id='sort-speed-dial-tooltip' place='bottom' />
                    </Button>
                  </Dropdown>
                </>
              )}
              <Dropdown items={speedDialMenuTemplate} position='left'>
                <Button variant='ghost' className='!py-2 !px-2 h-9 w-9'>
                  <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                  <span className='sr-only'>{t('SpeedDial.Open speed dial menu')}</span>
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>
        <span className='border-b border-gray-200 dark:border-gray-700'></span>
        <ul
          role='list'
          className={`flex-1 divide-y ${customScrollbarClass} divide-gray-200 dark:divide-gray-700`}
        >
          {/* get speed dial error */}
          {errors.getSpeedDial && (
            <InlineNotification type='error' title={errors.getSpeedDial} className='my-6' />
          )}
          {/* skeleton */}
          {!isSpeedDialLoaded &&
            !errors.getSpeedDial &&
            Array.from(Array(4)).map((_, index) => (
              <li key={index}>
                <SpeedDialItemSkeleton />
              </li>
            ))}
          {/* empty state */}
          {isSpeedDialLoaded && !errors.getSpeedDial && !speedDials.length && (
            <div className='px-6 py-4'>
              <EmptyState
                title={t('SpeedDial.No speed dials')}
                icon={
                  <FontAwesomeIcon icon={faBolt} className='mx-auto h-12 w-12' aria-hidden='true' />
                }
              >
                {canCreateSpeedDials && (
                  <Button variant='white' onClick={() => openCreateSpeedDialDrawer()}>
                    <FontAwesomeIcon icon={faPlus} className='mr-2 h-4 w-4' />
                    <span>{t('SpeedDial.Create')}</span>
                  </Button>
                )}
              </EmptyState>
            </div>
          )}
          {/* Iterate through speed dial list */}
          {isSpeedDialLoaded &&
            speedDials.map((speedDial: any, key: any) => (
              <li key={key}>
                <div className='group relative flex items-center py-2 px-6'>
                  <div
                    className='absolute inset-0 group-hover:bg-dropdownBgHover dark:group-hover:bg-dropdownBgHoverDark'
                    aria-hidden='true'
                  />
                  <div className='relative flex min-w-0 flex-1 items-center justify-between'>
                    <div className='flex items-center'>
                      <Avatar
                        size='base'
                        src={
                          operators?.avatars[
                            operators?.extensions[speedDial?.speeddial_num]?.username
                          ]
                        }
                        status={
                          operators?.operators[
                            operators?.extensions[speedDial?.speeddial_num]?.username
                          ]?.mainPresence
                        }
                        placeholderType='operator'
                        star={
                          operators?.operators?.[
                            operators?.extensions?.[speedDial?.speeddial_num]?.username
                          ]?.favorite
                        }
                      />
                      <div className='ml-4 truncate max-w-40'>
                        <p
                          className='truncate text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'
                          data-tooltip-id='tooltip-speed-dial-name'
                          data-tooltip-content={speedDial?.name || speedDial?.company || '-'}
                        >
                          {speedDial?.name || speedDial?.company || '-'}
                        </p>
                        <div className='truncate text-sm mt-1'>
                          <div className='flex items-center'>
                            <FontAwesomeIcon
                              icon={faPhone}
                              className='mr-1.5 h-4 w-4 flex-shrink-0 text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
                              aria-hidden='true'
                            />
                            <span
                              className='cursor-pointer hover:underline text-textLink dark:text-textLinkDark'
                              onClick={() => callSpeedDial(speedDial)}
                            >
                              {speedDial.speeddial_num}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {canWriteSpeedDials && (
                      <div className='flex gap-2'>
                        {/* Actions */}
                        <Dropdown items={getItemsMenu(speedDial)} position='left'>
                          <Button variant='ghost' className='dark:hover:bg-gray-700 h-9 w-9'>
                            <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                            <span className='sr-only'>{t('SpeedDial.Open speed dial menu')}</span>
                          </Button>
                        </Dropdown>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>

      {/* Consolidated modals */}
      {/* Delete speed dial modal */}
      <ConfirmationModal
        show={modalState.delete}
        focus={cancelButtonRef}
        onClose={() => closeModal('delete')}
        title={t('SpeedDial.Delete speed dial')}
        description={t('SpeedDial.Speed dial delete message', { deletingName: currentItem?.name })}
        confirmLabel={t('Common.Delete')}
        onConfirm={handleDeleteItem}
      >
        {errors.deleteSpeedDial && (
          <InlineNotification type='error' title={errors.deleteSpeedDial} className='mt-4' />
        )}
      </ConfirmationModal>

      {/* Delete all speed dials modal */}
      <ConfirmationModal
        show={modalState?.deleteAll}
        focus={cancelButtonRef}
        onClose={() => closeModal('deleteAll')}
        title={t('SpeedDial.Delete all speed dials')}
        description={
          <>
            <p>{t('SpeedDial.Delete all speed dials message')}</p>
            <p className='mt-1'>{t('SpeedDial.Are you sure?')}</p>
          </>
        }
        confirmLabel={t('Common.Delete')}
        onConfirm={handleDeleteAllItems}
      >
        {errors.deleteAllSpeedDial && (
          <InlineNotification type='error' title={errors.deleteAllSpeedDial} className='mt-4' />
        )}
      </ConfirmationModal>
      {/* Upload speed dial from Csv*/}
      <Modal
        show={modalState.importCsv}
        focus={cancelButtonRef}
        onClose={() => closeModal('importCsv')}
      >
        <Modal.Content>
          <div className='mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 bg-green-100 dark:bg-green-900'>
            <FontAwesomeIcon
              icon={faCheckCircle}
              className='h-6 w-6 text-green-600 dark:text-green-200'
              aria-hidden='true'
            />
          </div>
          <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
            <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
              {t('SpeedDial.Speed dial import')}
            </h3>
            <div className='mt-3'>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                {t('SpeedDial.Start importing Speed Dial from csv file?')}
              </p>
            </div>
            {errors.importCsv && (
              <InlineNotification type='error' title={errors.importCsv} className='mt-4' />
            )}
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button variant='primary' onClick={handleImportCsv}>
            {t('SpeedDial.Import CSV')}
          </Button>
          <Button variant='ghost' onClick={() => closeModal('importCsv')} ref={cancelButtonRef}>
            {t('Common.Cancel')}
          </Button>
        </Modal.Actions>
      </Modal>
      <CustomThemedTooltip id='tooltip-speed-dial-name' place='top' />
    </>
  )
}
