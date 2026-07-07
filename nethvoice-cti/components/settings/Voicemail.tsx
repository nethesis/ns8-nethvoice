// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  faCircleArrowUp,
  faPlay,
  faEllipsisVertical,
  faVoicemail,
  faPlus,
  faCircleCheck,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { t } from 'i18next'
import { Button, ConfirmationModal, Dropdown } from '../common'
import { faRecord } from '@nethesis/nethesis-solid-svg-icons'
import { Icon } from '@fortawesome/fontawesome-svg-core'
import { deleteVoicemailGreetingMessage, getVoicemailGreetingMessage, recordingMessage } from '../../services/voicemail'
import { useEffect, useState } from 'react'
import { playFileAudioBase64 } from '../../lib/utils'
import { useDispatch, useSelector } from 'react-redux'
import { Dispatch, RootState, store } from '../../store'
import { useEventListener } from '../../lib/hooks/useEventListener'

const STYLES = {
  tableCell: 'px-6 py-3 gap-6 text-sm font-normal font-poppins text-gray-700 dark:text-gray-200 h-14',
  tableHeader:
    'text-left relative px-6 py-3 gap-2 bg-gray-100 dark:bg-gray-800 font-poppins font-medium text-sm text-gray-900 dark:text-gray-50',
  iconButton: 'text-emerald-700 dark:text-emerald-500 h-4 w-4',
  buttonText: 'font-poppins text-sm font-medium text-emerald-700 dark:text-emerald-500',
  ghostButton: 'gap-3 px-3 py-2',
  skeletonBase: 'animate-pulse rounded bg-gray-300 dark:bg-gray-700',
}

export const Voicemail = () => {
  const [firstRender, setFirstRender] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [tablesData, setTablesData] = useState([
    {
      title: t('Settings.Greeting message'),
      type: 'greet',
      message: '',
    },
    {
      title: t('Settings.Busy status'),
      type: 'busy',
      message: '',
    },
    {
      title: t('Settings.Unavailable status'),
      type: 'unavail',
      message: '',
    },
  ])

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    typeToDelete: ''
  })

  const user = useSelector((state: RootState) => state.user)
  const dispatch = useDispatch<Dispatch>()

  useEffect(() => {
    if (firstRender) {
      setFirstRender(false)
      return
    }

    // Fetch greeting message data when component mounts or type changes
    const fetchGreetingMessage = async () => {
      setIsLoading(true)
      const updatedTables = [...tablesData]
      for (let i = 0; i < updatedTables.length; i++) {
        try {
          const message = await getVoicemailGreetingMessage(updatedTables[i].type)
          updatedTables[i].message = message
        } catch (error) {
          console.error(`Error fetching ${updatedTables[i].type} greeting message:`, error)
        }
      }
      setTablesData(updatedTables)
      setIsLoading(false)
    }
    fetchGreetingMessage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRender])

  const openUploadVoicemailDrawer = () => {
    store.dispatch.sideDrawer.update({
      isShown: true,
      contentType: 'showUploadVoicemail',
      config: { 
        isRecorded: false,
        onClose: () => {
          setFirstRender(true)
        }
      },
    })
  }

  const openDeleteModal = (type: string) => {
    setDeleteModal({
      isOpen: true,
      typeToDelete: type
    })
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      typeToDelete: ''
    })
  }

  const handleDeleteMessage = (type: string) => {
    deleteVoicemailGreetingMessage(type)
    // Update the UI after deleting the message
    setTablesData(prevTables => 
      prevTables.map(table => 
        table.type === type ? { ...table, message: '' } : table
      )
    )
    closeDeleteModal()
  }

  const getVoiceMailOptionsTemplate = (type: string) => (
    <>
      <Dropdown.Item icon={faTrash} isRed onClick={() => openDeleteModal(type)}>
        <span>{t('Settings.Delete message')}</span>
      </Dropdown.Item>
    </>
  )

  // Start recording message function
  const startRecordingMessage = () => {
    recordingMessage(user?.default_device?.type)
  }

  // Show modal announcement
  useEventListener('phone-island-recording-saved', (data) => {
    if (data?.tempFileName) {
      dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'showUploadVoicemail',
        config: {
          isRecorded: true,
          tempFileName: data.tempFileName,
          audioFileURL: data.audioFileURL,
          onClose: () => {
            setFirstRender(true)
          }
        },
      })
    }
  })

  useEventListener('phone-island-physical-recording-saved', (data) => {
    if (data?.tempFileName) {
      dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'showUploadVoicemail',
        config: {
          isRecorded: true,
          recordedFilename: data.tempFileName,
        },
      })
      dispatch.sideDrawer.setAvoidClose(true)
    }
  })

  // Skeleton loader component for a single table
  const TableSkeleton = ({ title }: { title: string }) => (
    <div>
      <span className='rounded-t-lg bg-indigo-300 dark:bg-indigo-800 pt-1 pb-3 px-6 gap-10 text-base font-normal font-poppins text-gray-900 dark:text-gray-50'>
        {title}
      </span>
      <div className='relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700'>
        <table className='w-full'>
          <thead>
            <tr>
              <th className={`${STYLES.tableHeader} w-4/12`}>
                <div className={`${STYLES.skeletonBase} h-4 w-24`}></div>
              </th>
              <th className={`${STYLES.tableHeader} w-3/12`}>
                <div className={`${STYLES.skeletonBase} h-4 w-20`}></div>
              </th>
              <th className={`${STYLES.tableHeader} w-3/12`}>
                <div className={`${STYLES.skeletonBase} h-4 w-16`}></div>
              </th>
              <th className={`${STYLES.tableHeader} w-2/12`}></th>
            </tr>
          </thead>
          <tbody>
            <tr className='border-t border-gray-300 dark:border-gray-700'>
              <td className={STYLES.tableCell}>
                <div className={`${STYLES.skeletonBase} h-4 w-32`}></div>
              </td>
              <td className={STYLES.tableCell}>
                <div className={`${STYLES.skeletonBase} h-4 w-20`}></div>
              </td>
              <td className={STYLES.tableCell}>
                <div className={`${STYLES.skeletonBase} h-4 w-24`}></div>
              </td>
              <td className={STYLES.tableCell}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <>
      <div className='p-6 flex flex-col'>
        <div>
          <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
            {t('Settings.Voicemail')}
          </h2>
        </div>
        <div className='flex flex-col'>
          <div className='flex items-center justify-between mb-4'>
            <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100'>
              {t('Settings.My voicemail messages')}
            </h4>
            <div className='gap-4 flex flex-row'>
              <Dropdown
                position='left'
                className='pb-6 sm:pb-0'
                items={
                  <>
                    <Dropdown.Item onClick={startRecordingMessage}>
                      <FontAwesomeIcon icon={faRecord as Icon} className='text-gray-500'/>
                      <span >{t('Settings.Record message')}</span>
                    </Dropdown.Item>
                    <Dropdown.Item onClick={openUploadVoicemailDrawer}>
                      <FontAwesomeIcon icon={faCircleArrowUp} className='text-gray-500'/>
                      <span>{t('Settings.Upload message')}</span>
                    </Dropdown.Item>
                  </>
                }
              >
                <Button variant='primary'>
                  <FontAwesomeIcon icon={faPlus} className='mr-2 h-4 w-4' />
                  {t('Settings.New message')}
                </Button>
              </Dropdown>
            </div>
          </div>
          <div className='flex flex-col gap-8'>
            {isLoading ? (
              // Display skeleton loaders when loading
              <>
                <TableSkeleton title={tablesData[0].title} />
                <TableSkeleton title={tablesData[1].title} />
                <TableSkeleton title={tablesData[2].title} />
              </>
            ) : (
              // Display actual data when loaded
              tablesData.map((table, index) => (
                <div key={index}>
                  <span className='rounded-t-lg bg-indigo-300 dark:bg-indigo-800 pt-1 pb-3 px-6 gap-10 text-base font-normal font-poppins text-gray-900 dark:text-gray-50'>
                    {table.title}
                  </span>
                  <div className='relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700'>
                    <table className='w-full'>
                      <thead>
                        <tr>
                          <th className={`${STYLES.tableHeader} w-4/12`}>{t('Settings.Name')}</th>
                          <th className={`${STYLES.tableHeader} w-3/12`}>{t('Settings.Creation date')}</th>
                          <th className={`${STYLES.tableHeader} w-3/12`}>{t('Settings.Status')}</th>
                          <th className={`${STYLES.tableHeader} w-2/12`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className='border-t border-gray-300 dark:border-gray-700'>
                          <td className={STYLES.tableCell}>
                            <div className='flex items-center'>
                              <span>{t('Settings.Default')}</span>
                              <FontAwesomeIcon icon={faVoicemail} className='ml-2 h-4 w-4 text-gray-700 dark:text-gray-200' />
                            </div>
                          </td>
                          <td className={STYLES.tableCell}></td>
                          <td className={STYLES.tableCell}>
                            {!table.message && 
                              <div className='flex items-center'>
                                <FontAwesomeIcon icon={faCircleCheck} className='h-4 w-4 mr-2 text-green-700' />
                                <span>{t('Settings.Enabled')}</span>
                              </div>
                            }
                          </td>
                          <td className={`${STYLES.tableCell} w-0 whitespace-nowrap text-right`}>
                            <div className='flex items-center justify-end opacity-0'>
                              <Button variant='ghost' disabled>
                                <FontAwesomeIcon icon={faPlay} className='h-4 w-4 mr-2' />
                                {t('Settings.Play')}
                              </Button>
                              <Button variant='ghost' disabled>
                                <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {table.message && (
                          <tr className='border-t border-gray-300 dark:border-gray-700'>
                            <td className={STYLES.tableCell}>
                              <div className='flex items-center'>
                                <span>{t('Settings.Custom')}</span>
                              </div>
                            </td>
                            <td className={STYLES.tableCell}></td>
                            <td className={STYLES.tableCell}>
                              <div className='flex items-center'>
                                <FontAwesomeIcon icon={faCircleCheck} className='h-4 w-4 mr-2 text-green-700' />
                                <span>{t('Settings.Enabled')}</span>
                              </div>
                            </td>
                            <td className={`${STYLES.tableCell} w-0 whitespace-nowrap text-right`}>
                              <div className='flex items-center justify-end'>
                                <Button variant='ghost' onClick={() => playFileAudioBase64(table.message)}>
                                  <FontAwesomeIcon icon={faPlay} className='h-4 w-4 mr-2' />
                                  {t('Settings.Play')}
                                </Button>
                                <Dropdown items={getVoiceMailOptionsTemplate(table.type)} position='topVoicemail'>
                                  <Button variant='ghost'>
                                    <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
                                  </Button>
                                </Dropdown>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmationModal
        show={deleteModal.isOpen}
        onClose={closeDeleteModal}
        title={t('Settings.Delete message')}
        description={t('Settings.Are you sure to delete selected message?')}
        confirmLabel={t('Common.Delete')}
        onConfirm={() => handleDeleteMessage(deleteModal.typeToDelete)}
      />
    </>
  )
}
