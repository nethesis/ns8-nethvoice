// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import classNames from 'classnames'
import {
  faQrcode,
  faKey,
  faEye,
  faEyeSlash,
  faCopy,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InlineNotification, OTPInput, TextInput, Button } from '../../common'
import type { OTPInputRef } from '../../common/OTPInput'
import { DrawerHeader } from '../../common/DrawerHeader'
import { Divider } from '../../common/Divider'
import { DrawerFooter } from '../../common/DrawerFooter'
import { RootState } from '../../../store'
import { otpVerify, getQRcode, getBackupCodes } from '../../../services/twoFactor'
import dynamic from 'next/dynamic'
import { TwoFactorSetupResponse } from '../../../services/types/twoFactor'
import { saveCredentials } from '../../../lib/login'
import { axiosSetup } from '../../../config/axios'
import { closeSideDrawer } from '../../../lib/utils'

const QRCode = dynamic(() => import('../QRCode'), {
  ssr: false,
})

export interface Setup2FADrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: {
    onComplete: () => void
  }
}

export const Setup2FADrawerContent = forwardRef<HTMLButtonElement, Setup2FADrawerContentProps>(
  ({ config }) => {
    const { t } = useTranslation()
    const authenticationStore = useSelector((state: RootState) => state.authentication)

    // State management
    const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
    const [totpCode, setTotpCode] = useState('')
    const [secretVisible, setSecretVisible] = useState(false)
    const [error, setError] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<'qrcode' | 'secret'>('qrcode')
    const [isCopied, setIsCopied] = useState(false)

    const otpInputRef = useRef<OTPInputRef>(null)

    // Fetch setup data when component mounts
    useEffect(() => {
      getSetupData()
    }, [])

    const getSetupData = async () => {
      try {
        setIsProcessing(true)
        setError('')
        const data = await getQRcode()
        setSetupData(data)
      } catch (error) {
        setError('Error fetching setup data')
      } finally {
        setIsProcessing(false)
      }
    }

    const handleEnable2FA = async () => {
      if (!totpCode || totpCode.length !== 6) {
        setError('Please enter a valid 6-digit code')
        return
      }

      try {
        setIsProcessing(true)
        setError('')
        const response = await otpVerify(authenticationStore.username, totpCode)
        if (response?.code === 200) {
          saveCredentials(authenticationStore.username, response.data.token)
          axiosSetup()

          // Close side drawer and notify parent
          closeSideDrawer()
          config.onComplete()
        }
      } catch (error) {
        setError('Invalid verification code. Please try again.')
      } finally {
        setIsProcessing(false)
      }
    }

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }

    const renderMethodCard = (
      method: 'qrcode' | 'secret',
      icon: any,
      title: string,
      description: string,
    ) => (
      <div
        className={classNames(
          'relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-200',
          'hover:border-primary hover:border-opacity-50',
          {
            'border-primary bg-primary/5 dark:bg-primaryDark/10': selectedMethod === method,
            'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800':
              selectedMethod !== method,
          },
        )}
        onClick={() => setSelectedMethod(method)}
        role='button'
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setSelectedMethod(method)
          }
        }}
      >
        {/* Checkmark when selected */}
        {selectedMethod === method && (
          <div className='absolute top-2 right-2'>
            <div className='w-5 h-5 bg-primary dark:bg-primaryDark rounded-full flex items-center justify-center'>
              <FontAwesomeIcon icon={faCheck} className='w-2.5 h-2.5 text-white' />
            </div>
          </div>
        )}

        {/* Icon and Content in horizontal layout */}
        <div className='flex items-center gap-2'>
          {/* Icon */}
          <div
            className={classNames(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              {
                'bg-primary/10 text-primary dark:bg-primaryDark/20 dark:text-primaryDark':
                  selectedMethod === method,
                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400':
                  selectedMethod !== method,
              },
            )}
          >
            <FontAwesomeIcon icon={icon} className='w-5 h-5' />
          </div>

          {/* Content */}
          <div className='flex-1 min-w-0'>
            <h3
              className={classNames('font-medium text-sm mb-0.5', {
                'text-gray-900 dark:text-gray-100': selectedMethod === method,
                'text-gray-700 dark:text-gray-300': selectedMethod !== method,
              })}
            >
              {title}
            </h3>
            <p
              className={classNames('text-xs leading-relaxed', {
                'text-gray-600 dark:text-gray-400': selectedMethod === method,
                'text-gray-500 dark:text-gray-500': selectedMethod !== method,
              })}
            >
              {description}
            </p>
          </div>
        </div>
      </div>
    )

    return (
      <>
        <DrawerHeader title={t('Settings.Configure 2FA')} />
        <div className='px-5'>
          <Divider />
          <div className='flex flex-col gap-4'>
            <InlineNotification type='info' title={t('Settings.Download a 2FA application')}>
              <p>
                {t(
                  'Settings.Configure a two-factor authentication require an authenticator app. Scan the QR code with the app or enter the secret key, then enter the 6-digit code provided.',
                )}
              </p>
            </InlineNotification>

            <div className='flex flex-col gap-2'>
              <p className='text-sm font-medium'>{t('Settings.Setup method')}</p>
              <div className='grid grid-cols-2 gap-4'>
                {renderMethodCard(
                  'qrcode',
                  faQrcode,
                  t('Settings.QR code'),
                  t('Settings.Scan with app'),
                )}
                {renderMethodCard(
                  'secret',
                  faKey,
                  t('Settings.Secret key'),
                  t('Settings.Enter manually'),
                )}
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              {selectedMethod === 'qrcode' && setupData?.url ? (
                <>
                  <p className='text-sm font-medium'>{t('Settings.Scan QR code')}</p>
                  <QRCode
                    data={setupData.url}
                    showDownloadButton={false}
                    customOptions={{ width: 250, height: 250 }}
                  />
                </>
              ) : (
                <>
                  <p className='text-sm font-medium'>{t('Settings.Secret key')}</p>
                  <div className='flex'>
                    <TextInput
                      value={
                        secretVisible
                          ? setupData?.key || ''
                          : '•'.repeat(setupData?.key?.length || 0)
                      }
                      readOnly
                      className='w-full'
                      trailingComponent={
                        <button
                          type='button'
                          onClick={() => setSecretVisible(!secretVisible)}
                          className='text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200'
                        >
                          <FontAwesomeIcon
                            icon={secretVisible ? faEyeSlash : faEye}
                            className='h-4 w-4'
                          />
                        </button>
                      }
                    />
                    <div className='items-center flex gap-1'>
                      <Button
                        variant='white'
                        size='small'
                        onClick={() => copyToClipboard(setupData?.key || '')}
                        className='ml-4 h-full'
                      >
                        <FontAwesomeIcon
                          icon={isCopied ? faCheck : faCopy}
                          className='h-4 w-4 mr-2'
                        />
                        {isCopied ? t('Common.Copied') : t('Common.Copy')}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className='flex flex-col gap-2'>
              <p className='text-sm font-medium'>{t('Settings.OTP code')}</p>
              <OTPInput ref={otpInputRef} value={totpCode} onChange={setTotpCode} length={6} />
              <p className='text-sm text-gray-500 dark:text-gray-300'>
                {t('Settings.Enter the 6-digit code from authenticator app')}
              </p>
              {error && <InlineNotification type='error' title={error} />}
            </div>
          </div>
          <Divider />
          <DrawerFooter confirmLabel={t('Common.Configure')} onConfirm={handleEnable2FA} />
        </div>
      </>
    )
  },
)

Setup2FADrawerContent.displayName = 'Setup2FADrawerContent'
