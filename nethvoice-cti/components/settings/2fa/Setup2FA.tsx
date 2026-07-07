// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useRef, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import {
  faTriangleExclamation,
  faCircleNotch,
  faWrench,
  faCircleInfo,
  faCircleArrowDown,
  faEye,
  faEyeSlash,
  faCheck,
  faCopy,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal, InlineNotification, Badge, TextInput } from '../../common'
import { RootState, store } from '../../../store'
import {
  getTwoFactorStatus,
  disableTwoFactor,
  getBackupCodes,
} from '../../../services/twoFactor'
import { saveCredentials } from '../../../lib/login'
import { axiosSetup } from '../../../config/axios'
import { openToast } from '../../../lib/utils'
import { getJSONItem, removeItem } from '../../../lib/storage'
import { Textarea } from '@headlessui/react'

export const Setup2FA = () => {
  const { t } = useTranslation()
  const auth = useSelector((state: RootState) => state.authentication)

  const openSetupDrawerStorageKey = 'open-2fa-setup-drawer'

  // State management
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showRecoveryCodesModal, setShowRecoveryCodesModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDisableConfirmModal, setShowDisableConfirmModal] = useState(false)
  const [passwordAction, setPasswordAction] = useState<'viewCodes' | 'disable2FA' | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const cancelButtonRef: RefObject<HTMLButtonElement> = useRef(null)
  const passwordInputRef: RefObject<HTMLInputElement> = useRef(null)

  const authenticationStore = useSelector((state: RootState) => state.authentication)

  // Load 2FA status on component mount
  useEffect(() => {
    loadTwoFactorStatus()
  }, [])

  const loadTwoFactorStatus = async () => {
    try {
      setIsLoading(true)
      const response = await getTwoFactorStatus()
      setIsEnabled(response.status)
    } catch (error) {
      console.error('Error loading 2FA status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize setup - now opens side drawer
  const handleSetupStart = async () => {
    try {
      setIsProcessing(true)
      setError('')

      // Open side drawer for 2FA setup
      store.dispatch.sideDrawer.update({
        isShown: true,
        contentType: 'setup2FA' as any,
        config: {
          onComplete: handleSetupComplete,
        },
      })
    } catch (error) {
      setError(t('Settings.Error initializing 2FA setup') || 'Error initializing 2FA setup')
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    const autoOpen = getJSONItem(openSetupDrawerStorageKey)

    if (!isLoading && autoOpen?.open) {
      if (!isEnabled) {
        handleSetupStart()
      }
      removeItem(openSetupDrawerStorageKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isEnabled])

  // Handle completion of 2FA setup
  const handleSetupComplete = () => {
    setIsEnabled(true)

    // Show success toast with button to view backup codes
    openToast(
      'success',
      <Button
        variant='primary'
        onClick={handleViewBackupCodes}
        className='mt-2'
      >
        {t('Settings.Show recovery OTP codes') || ''}
      </Button>,
      t('Settings.Two-factor authentication configured') || '',
    )
  }

  // Handle viewing backup codes (requires password)
  const handleViewBackupCodes = () => {
    setPassword('')
    setError('')
    setPasswordAction('viewCodes')
    setShowPasswordModal(true)
  }

  // Handle disable 2FA start (show confirmation modal first)
  const handleDisable2FAStart = () => {
    setShowDisableConfirmModal(true)
  }

  // Handle disable 2FA confirm (show password modal)
  const handleDisable2FAConfirm = () => {
    setShowDisableConfirmModal(false)
    setPassword('')
    setError('')
    setPasswordAction('disable2FA')
    setShowPasswordModal(true)
  }

  // Handle password verification and execute action
  const handlePasswordSubmit = async () => {
    if (!password) {
      setError(t('Settings.Please enter your password') || 'Please enter your password')
      return
    }

    try {
      setIsProcessing(true)
      setError('')

      if (passwordAction === 'viewCodes') {
        // Get and show backup codes with password
        const backupCodesResponse = await getBackupCodes(password)
        setBackupCodes(backupCodesResponse.codes || [])
        setShowPasswordModal(false)
        setShowRecoveryCodesModal(true)
      } else if (passwordAction === 'disable2FA') {
        // Disable 2FA
        const response = await disableTwoFactor(password)
        if (response?.code === 200) {
          saveCredentials(authenticationStore.username, response.data.token)
          axiosSetup()
          setIsEnabled(false)
          closePasswordModal()

          // Show success notification
          openToast('success', ``, `Two-factor authentication revoked`)
        }
      }
    } catch (error) {
      setError(
        t('Settings.Invalid password. Please try again.') || 'Invalid password. Please try again.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '2fa-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetModalState = () => {
    setPassword('')
    setError('')
    setBackupCodes([])
    setPasswordAction(null)
    setShowPassword(false)
  }

  const closeRecoveryCodesModal = () => {
    setShowRecoveryCodesModal(false)
    setTimeout(() => {
      resetModalState()
    }, 1000)
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setTimeout(() => {
      resetModalState()
    }, 1000)
  }

  const closeDisableConfirmModal = () => {
    setShowDisableConfirmModal(false)
  }

  // Auto focus inputs when modals open
  useEffect(() => {
    if (showPasswordModal) {
      setTimeout(() => passwordInputRef.current?.focus(), 100)
    }
  }, [showPasswordModal])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <>
      <section aria-labelledby='authentication-heading'>
        <div className='py-6 px-4 sm:p-6'>
          <div>
            <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
              {t('Settings.Two-Factor Authentication')}
            </h2>
          </div>

          <div className='mb-6'>
            <h4 className='text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 mb-2'>
              {t('Settings.Configuration')}
            </h4>
            <p className='text-sm font-normal text-gray-500 dark:text-gray-400'>
              {t('Settings.Two-Factor Authentication Description')}
            </p>
          </div>

          <div className='flex flex-col gap-8'>
            <div className='flex items-center gap-2'>
              <h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                {t('Settings.Status')}
              </h4>
              {isLoading ? (
                <div className='animate-pulse'>
                  <div className='h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full'></div>
                </div>
              ) : (
                <Badge variant={isEnabled ? 'enabled' : 'disabled'} size='small' rounded='full'>
                  {isEnabled ? t('Settings.Enabled') : t('Settings.Disabled')}
                </Badge>
              )}
            </div>

            <div>
              {isLoading ? (
                <div className='animate-pulse'>
                  <div className='h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-md'></div>
                </div>
              ) : isEnabled ? (
                <div className='flex gap-4'>
                  <Button variant='white' onClick={handleViewBackupCodes}>
                    {t('Settings.Show recovery OTP codes') || ''}
                  </Button>
                  <Button variant='ghost' onClick={handleDisable2FAStart}>
                    {t('Settings.Revoke 2FA') || ''}
                  </Button>
                </div>
              ) : (
                <Button variant='primary' onClick={handleSetupStart}>
                  <FontAwesomeIcon icon={faWrench} className='mr-2 h-4 w-4' />
                  {t('Settings.Configure 2FA') || 'Configure 2FA'}
                </Button>
              )}
            </div>
          </div>

          {error && <InlineNotification type='error' title={error} className='mt-4' />}
        </div>
      </section>

      {/* Recovery Codes Modal - shown after setup completion */}
      <Modal
        show={showRecoveryCodesModal}
        focus={cancelButtonRef}
        onClose={closeRecoveryCodesModal}
        size='large'
      >
        <Modal.Content>
          <div className='mt-0'>
            <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
              {t('Settings.Recovery OTP Codes') || ''}
            </h3>
            <div className='mt-4'>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-4'>
                {t(
                  'Settings.You can use recovery OTP codes if you have to login and cannot access your authenticator app.',
                )}
              </p>

              <InlineNotification
                type='warning'
                title={t('Settings.Keep codes in a safe place')}
                className='mb-4'
              >
                <p className='text-amber-800 dark:text-amber-100'>
                  {t('Settings.Each recovery code can be used only once')}
                </p>
              </InlineNotification>

              <div className='bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
                <Textarea
                  readOnly
                  value={backupCodes.join('\n')}
                  rows={backupCodes.length}
                  className='block w-full font-mono text-sm bg-transparent border-none resize-none focus:ring-0 text-gray-900 dark:text-gray-100 p-3 m-0 leading-normal'
                  placeholder={
                    t('Settings.No recovery codes available') || ''
                  }
                />
              </div>

              <div className='flex justify-between items-center mt-4'>
                <div className='flex gap-2'>
                  <Button variant='white' onClick={() => copyToClipboard(backupCodes.join('\n'))}>
                    <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} className='mr-2 h-4 w-4' />
                    {isCopied ? t('Common.Copied') : t('Settings.Copy all codes')}
                  </Button>
                  <Button variant='ghost' onClick={downloadBackupCodes}>
                    <FontAwesomeIcon icon={faCircleArrowDown} className='mr-2 h-4 w-4' />
                    {t('Common.Download') || ''}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button variant='primary' onClick={closeRecoveryCodesModal}>
            {t('Common.Close') || ''}
          </Button>
        </Modal.Actions>
      </Modal>

      {/* Password Confirmation Modal - unified for all password requests */}
      <Modal show={showPasswordModal} focus={passwordInputRef} onClose={closePasswordModal}>
        <Modal.Content>
          <div className='mx-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 bg-indigo-100 dark:bg-indigo-900'>
            <FontAwesomeIcon
              icon={faCircleInfo}
              className='h-5 w-5 text-indigo-600 dark:text-indigo-100'
              aria-hidden='true'
            />
          </div>
          <div className='flex flex-col gap-4 text-left mt-0 ml-4 w-full'>
            <div className='flex flex-col gap-2'>
              <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
                {t('Settings.Password confirmation required')}
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                {t('Settings.Please confirm your password to proceed')}
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handlePasswordSubmit()
              }}
            >
              <input
                type='text'
                name='username'
                value={auth.username}
                autoComplete='username'
                style={{ display: 'none' }}
                readOnly
              />
              <TextInput
                type={showPassword ? 'text' : 'password'}
                placeholder={t('Settings.Enter your password to confirm') || ''}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                ref={passwordInputRef}
                autoComplete='current-password'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit()
                  }
                }}
                trailingComponent={
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200'
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className='h-4 w-4' />
                  </button>
                }
              />
            </form>

            {error && <InlineNotification type='error' title={error} className='mt-4' />}
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button
            variant='primary'
            onClick={handlePasswordSubmit}
            disabled={isProcessing || !password}
          >
            {isProcessing ? (
              <>
                <FontAwesomeIcon icon={faCircleNotch} className='mr-2 h-4 w-4 animate-spin' />
                {t('Settings.Verifying...')}
              </>
            ) : (
              t('Common.Confirm') || ''
            )}
          </Button>
          <Button variant='ghost' onClick={closePasswordModal} ref={cancelButtonRef}>
            {t('Common.Cancel') || ''}
          </Button>
        </Modal.Actions>
      </Modal>

      {/* Disable 2FA Confirmation Modal */}
      <Modal
        show={showDisableConfirmModal}
        focus={cancelButtonRef}
        onClose={closeDisableConfirmModal}
      >
        <Modal.Content>
          <div className='mx-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 bg-amber-700'>
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className='h-5 w-5 text-amber-50'
              aria-hidden='true'
            />
          </div>
          <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
            <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
              {t('Settings.Revoke 2FA') || ''}
            </h3>
            <div className='mt-2'>
              <p className='text-sm text-gray-700 dark:text-gray-300'>
                {t(
                  'Settings.Revoke two-factor authentication reduce the security level of your account. The OTP code won’t be requested anymore when you login.',
                ) || ''}
              </p>
            </div>
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button variant='danger' onClick={handleDisable2FAConfirm}>
            {t('Settings.Revoke 2FA') || ''}
          </Button>
          <Button variant='ghost' onClick={closeDisableConfirmModal} ref={cancelButtonRef}>
            {t('Common.Cancel') || ''}
          </Button>
        </Modal.Actions>
      </Modal>
    </>
  )
}
