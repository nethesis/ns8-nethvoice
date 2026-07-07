// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { saveCredentials } from '../lib/login'
import { useState, useRef, useEffect } from 'react'
import { TextInput, InlineNotification, Button, OTPInput } from '../components/common'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch, faEye, faEyeSlash, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { checkDarkTheme } from '../lib/darkTheme'
import { useTranslation } from 'react-i18next'
import { store } from '../store'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { axiosSetup } from '../config/axios'
import {
  getBrandedTabTitle,
  getConfiguredFaviconUrl,
  getHtmlFaviconElement,
  getPeopleImageVisibilityValue,
  getProductName,
  getProductSubname,
  getSavedQueryParams,
  closeToast,
  openToast,
  reloadPage,
} from '../lib/utils'
import { getTwoFactorStatus } from '../services/twoFactor'
import { loadPreference, savePreference, setJSONItem } from '../lib/storage'
import Head from 'next/head'
import { capitalize } from 'lodash'
import { loginBeforeDashboard } from '../services/user'
import { otpVerify } from '../services/twoFactor'
import { OTPInputRef } from '../components/common/OTPInput'
import { decodeJWT } from '../lib/jwt'

export default function Login() {
  const [pwdVisible, setPwdVisible] = useState(false)
  const [messageError, setMessaggeError] = useState('')
  const [onError, setOnError] = useState(false)
  const [onOTPError, setOnOTPError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showOTPVerification, setShowOTPVerification] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [tempLoginData, setTempLoginData] = useState<{
    username: string
    password: string
    token?: string
  } | null>(null)
  const ctiStatus = useSelector((state: RootState) => state.ctiStatus)

  const { t } = useTranslation()

  const queryParams = getSavedQueryParams()

  const [idInterval, setIdInterval] = useState<any>(0)
  const [linkHtmlFaviconElement, setLinkHtmlFaviconElement] = useState<any>(null)
  const [variableCheck, setVariableCheck] = useState(false)

  useEffect(() => {
    if (queryParams != undefined && queryParams.includes('error')) {
      const newUrl = `login?${queryParams}`

      window.history.pushState({ path: newUrl }, '', newUrl)
      if (queryParams === 'error=sessionExpired') {
        store.dispatch.ctiStatus.setUserInformationMissing(true)
        store.dispatch.ctiStatus.setWebRtcError(true)
      } else {
        store.dispatch.ctiStatus.setWebRtcError(true)
      }
      setLinkHtmlFaviconElement(getHtmlFaviconElement())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams, window.location.href])

  const visibilityChangeHandler = () => {
    if (
      document?.visibilityState &&
      queryParams &&
      queryParams != undefined &&
      queryParams.includes('error') &&
      window.location.href.includes('/login')
    ) {
      reloadPage()
    }
  }

  // Manage change of visibility
  document.addEventListener('visibilitychange', visibilityChangeHandler)

  useEffect(() => {
    if (linkHtmlFaviconElement) {
      manageFaviconInterval()
      return () => {
        clearFaviconInterval()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctiStatus.webRtcError, ctiStatus.isPhoneRinging, window.location, linkHtmlFaviconElement])

  function manageFaviconInterval() {
    const warningMessageFavicon = t('Common.DoubleLogin')
    const callingMessageFavicon = t('Common.Calling')
    const sessionExpiredMessageFavicon = t('Common.SessionExpired')
    setVariableCheck(true)
    // setVariableCheck(true)

    let flashFavicon = true
    if (ctiStatus.webRtcError || ctiStatus.isPhoneRinging) {
      const intervalId = setInterval(() => {
        if (flashFavicon) {
          if (ctiStatus.webRtcError) {
            if (linkHtmlFaviconElement) {
              linkHtmlFaviconElement.href = 'favicon-warn.ico'
            }
            if (ctiStatus.isUserInformationMissing) {
              window.document.title = sessionExpiredMessageFavicon
              linkHtmlFaviconElement.href = 'favicon-warn.ico'
            } else {
              window.document.title = warningMessageFavicon
            }
          } else {
            if (linkHtmlFaviconElement) {
              linkHtmlFaviconElement.href = 'favicon-call.ico'
            }
            window.document.title = callingMessageFavicon
          }
        } else {
          if (linkHtmlFaviconElement) {
            linkHtmlFaviconElement.href = getConfiguredFaviconUrl()
          }
          window.document.title = productTabTitle
        }
        flashFavicon = !flashFavicon
      }, 800)
      store.dispatch.ctiStatus.setIdInterval(intervalId)
      setIdInterval(intervalId)
    } else {
      clearFaviconInterval()
    }
  }

  // Get current page name, clean the path from / and capitalize page name
  function cleanProductNamePageTitle() {
    if (router.pathname) {
      // Delete slash at the beginning of the path
      const cleanRouterPath: string = router.pathname.replace(/^\/|\/$/g, '')
      // Return path with the uppercase first character
      return t(`Common.${capitalize(cleanRouterPath)}`) + ' - ' + productTabTitle
    }
  }

  function clearFaviconInterval() {
    let cleanTitlePageName: any = cleanProductNamePageTitle()

    if (idInterval > 0) {
      clearInterval(idInterval)
    } else {
      // Use the interval id from the store
      clearInterval(ctiStatus.idInterval)
    }

    if (linkHtmlFaviconElement) {
      linkHtmlFaviconElement.href = getConfiguredFaviconUrl()
    }
    window.document.title = cleanTitlePageName
  }

  let iconSelect = loading ? (
    <FontAwesomeIcon icon={faCircleNotch} className='fa-spin loader fa-lg' />
  ) : (
    <></>
  )

  useEffect(() => {
    function showNotification() {
      if (document.visibilityState !== 'visible' && variableCheck) {
        if (Notification.permission === 'granted') {
          if (ctiStatus.webRtcError) {
            if (ctiStatus.isUserInformationMissing) {
              // Create notification with caller informations
              const notification = new Notification(`${t('Common.Session expired')}`, {
                body: `${t('Common.Click to redirect')}`,
              })

              setVariableCheck(false)

              notification.onclick = function () {
                notification.close()
                window.focus()
              }
            } else {
              // Create notification with caller informations
              const notification = new Notification(`${t('Common.User login duplicated')}`, {
                body: `${t('Common.You have made login in another tab')}`,
              })

              setVariableCheck(false)

              notification.onclick = function () {
                notification.close()
                window.focus()
              }
            }
          }
        } else {
          Notification.requestPermission()

            .then((permission) => {
              if (permission === 'granted') {
                showNotification()
              }
            })
            .catch((error) => {
              console.error('No permissions', error)
            })
        }
      }
    }

    showNotification()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableCheck])

  const [userNotAuthorized, setUserNotAuthorized] = useState(false)

  let errorAlert = onError ? (
    <div className='relative w-full mt-2'>
      <InlineNotification
        type='error'
        title={userNotAuthorized ? t('Login.User not autorized') : t('Login.Login failed')}
      >
        <p>{messageError}</p>
      </InlineNotification>
    </div>
  ) : ctiStatus.webRtcError || window.location.href.includes('?error') ? (
    ctiStatus.isUserInformationMissing || window.location.href.includes('sessionExpired') ? (
      <div className='relative w-full mt-6'>
        <InlineNotification type='error' title={t('Common.Warning')}>
          <p>{t('Login.Session expired, log in again')}</p>
        </InlineNotification>
      </div>
    ) : (
      <div className='relative w-full mt-6'>
        <InlineNotification type='error' title={t('Common.Warning')}>
          <p>{t('Login.The application is open in another window')}</p>
        </InlineNotification>
      </div>
    )
  ) : (
    <></>
  )

  let errorOTPAlert = onOTPError ? (
    <div className='relative w-full mt-2'>
      <InlineNotification
        type='error'
        title={t('Login.OTP verification failed')}
      >
        <p>{t('Login.The code you entered is invalid or has expired. Please check your authenticator app and try again.') || ''}</p>
      </InlineNotification>
    </div>
  ) : (
    <></>
  )

  const router = useRouter()
  const usernameRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const passwordRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const otpInputRef = useRef() as React.MutableRefObject<OTPInputRef>

  const suppress2faToastPreferenceKey = 'suppress-2fa-toast'
  const openSetupDrawerStorageKey = 'open-2fa-setup-drawer'

  const showTwoFactorToastIfNeeded = async (username: string) => {
    const suppressToast = loadPreference(suppress2faToastPreferenceKey, username)
    if (suppressToast) {
      return
    }

    try {
      const statusResponse = await getTwoFactorStatus()
      if (statusResponse?.status) {
        return
      }

      const handleOpenSettings = () => {
        setJSONItem(openSetupDrawerStorageKey, { open: true })
        closeToast()
        router.push('settings?section=Two-Factor+Authentication')
      }

      const handleDontAskAgain = () => {
        savePreference(suppress2faToastPreferenceKey, true, username)
        closeToast()
      }

      openToast(
        'info',
        <div className='flex flex-col gap-3'>
          <span>
            {t('Login.Enable 2FA to improve account security') ||
              'Enable 2FA to improve account security'}
          </span>
          <div className='flex flex-wrap gap-2'>
            <Button variant='primary' onClick={handleOpenSettings}>
              {t('Settings.Configure 2FA') || 'Enable 2FA'}
            </Button>
            <Button variant='ghost' onClick={handleDontAskAgain}>
              {t("Common.Don't ask again") || "Don't ask again"}
            </Button>
          </div>
        </div>,
        t('Login.Two-factor authentication is disabled') ||
          'Two-factor authentication is disabled',
          10000
      )
    } catch (error) {
      console.error('Error loading 2FA status:', error)
    }
  }

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (window !== undefined) {
      const username = usernameRef?.current?.value?.toLowerCase()
      const password = passwordRef?.current?.value
      setOnError(false)

      const res = await fetch(
        // @ts-ignore
        window.CONFIG.API_SCHEME + window.CONFIG.API_ENDPOINT + '/api/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password,
          }),
        },
      )

      const callStatus = res.status

      if (callStatus === 200) {
        const data = await res.json()
        const token = data?.token

        setTempLoginData({
          username: username,
          password: password,
          token: token,
        })

        // Initialize axios configuration
        saveCredentials(username, token)
        axiosSetup()

        const jwtClaims = decodeJWT(token)

        if (jwtClaims && jwtClaims['2fa']) {
          setShowOTPVerification(true)
          setLoading(false)
          // Focus OTP input after showing it
          setTimeout(() => otpInputRef.current?.focus(), 100)
          return
        } else {          
          // No 2FA required, proceed with login
          handleLogin(token, username)
        }
      } else {
        if (callStatus === 401) {
          setOnError(true)
          setMessaggeError(`${t('Login.Wrong username or password')}`)
        } else if (callStatus === 404) {
          setOnError(true)
          setMessaggeError(`${t('Login.Network connection is lost')}`)
        }
        setLoading(false)
      }
    }
  }

  const handleLogin = async (token: any, username: any) => {
    let userPreferenceOnLogin: any = {}
    try {
      userPreferenceOnLogin = await loginBeforeDashboard(username, token)
      if (
        // TO DO - remove this check when the backend will be ready
        userPreferenceOnLogin?.profile?.macro_permissions?.nethvoice_cti?.value === undefined ||
        // not this
        userPreferenceOnLogin?.profile?.macro_permissions?.nethvoice_cti?.value
      ) {
        setUserNotAuthorized(false)
        await showTwoFactorToastIfNeeded(username)
        router.push('/')
      } else {
        setUserNotAuthorized(true)
        setOnError(true)
        setMessaggeError(`${t('Login.Contact administrator for access')}`)
      }
    } catch (error) {
      console.log(error)
    }

    // clean errors from storage
    sessionStorage.clear()
    if (ctiStatus.webRtcError || window.location.href.includes('webrtcError')) {
      store?.dispatch?.ctiStatus?.setWebRtcError(false)
    }
    if (ctiStatus.isUserInformationMissing || window.location.href.includes('sessionExpired')) {
      store?.dispatch?.ctiStatus?.setUserInformationMissing(false)
    }
    setLoading(false)
    checkDarkTheme()
  }

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempLoginData || !otpCode || otpCode.length !== 6) {
      setOnOTPError(true)
      return
    }

    setLoading(true)
    setOnOTPError(false)

    try {
      const response = await otpVerify(tempLoginData.username, otpCode)
      if (response?.data?.token) {
        // Use the new token from OTP verification
        saveCredentials(tempLoginData.username, response.data.token)
        axiosSetup()

        handleLogin(response.data.token, tempLoginData.username)
      }
    } catch (error) {
      setOnOTPError(true)
      setLoading(false)
    }
  }

  // Get product name to show in the tab
  const productName = getProductName()

  const productSubname = getProductSubname()
  const productTabTitle = getBrandedTabTitle(productSubname || 'CTI')

  const [isFirsThemeControl, setIsFirsThemeControl] = useState(true)
  const [isDarkTheme, setIsDarkTheme] = useState(false)

  useEffect(() => {
    if (isFirsThemeControl) {
      setIsFirsThemeControl(false)
      return
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkTheme(true)
    } else {
      setIsDarkTheme(false)
    }
  }, [isFirsThemeControl])

  const showPeopleImage = getPeopleImageVisibilityValue()

  const otpVerificationTemplate = () => {
    return (
      <div className='max-w-sm sm:w-96'>
        <div>
          <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-2'>
            {t('Login.Two-Factor Authentication')}
          </h3>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            {t(
              'Login.Enter the 6-digit code (OTP code) from your authenticator app. If you cannot access the app, you can use one recovery OTP code.',
            )}
          </p>
        </div>

        <div className='pt-6'>{errorOTPAlert}</div>

        {/* OTP input section */}
        <div className='pt-6'>
          <form onSubmit={verifyOTP} className='space-y-6'>
            <div className='flex flex-col space-y-2 text-center'>
              <p className='text-sm text-gray-600 dark:text-gray-200 mb-2'>{t('Login.OTP code')}</p>
              <OTPInput
                ref={otpInputRef}
                value={otpCode}
                onChange={setOtpCode}
                length={6}
                disabled={loading}
                className='justify-center'
                error={onOTPError}
              />
            </div>

            <div className='space-y-4'>
              <Button
                size='large'
                fullHeight={true}
                fullWidth={true}
                variant='primary'
                type='submit'
                disabled={loading || otpCode.length !== 6}
              >
                <span className='font-medium leading-5 text-sm'>{t('Login.Sign in')}</span>
                {loading && <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const loginTemplate = () => {
    return (
      <div className='max-w-sm sm:w-96'>
        <div className='flex flex-col items-center justify-center'>
          {/* Nextjs <Image> is not suitable for rebranding: it always uses the aspect ratio of the original logo  */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className='mx-auto w-auto max-h-[70px] items-center object-contain object-bottom fill-current text-primary dark:text-primaryDark'
            src={!isDarkTheme ? '/login_logo.svg' : '/login_logo_dark.svg'}
            alt='logo'
          />
          <div className='text-primary dark:text-primaryDark pt-5 text-lg font-regular'>
            {productSubname}
          </div>
        </div>
        {errorAlert}
        <div className='pt-6'>
          <form action='#' method='POST' onSubmit={doLogin} className='space-y-8'>
            <div>
              <label
                htmlFor='username'
                className='block text-sm font-medium text-gray-700 dark:text-gray-200'
              >
                {t('Login.User')}
              </label>
              <div className='mt-2'>
                <TextInput
                  placeholder=''
                  name='username'
                  ref={usernameRef}
                  error={onError ? true : false}
                  required
                  autoComplete='username'
                  autoFocus
                  id='username'
                ></TextInput>
              </div>
            </div>
            <div>
              <label
                htmlFor='password'
                className='block text-sm font-medium text-gray-700 dark:text-gray-200'
              >
                {t('Login.Password')}
              </label>
              <div className='mt-2'>
                <TextInput
                  placeholder=''
                  name='password'
                  type={pwdVisible ? 'text' : 'password'}
                  icon={pwdVisible ? faEye : faEyeSlash}
                  onIconClick={() => setPwdVisible(!pwdVisible)}
                  trailingIcon={true}
                  error={onError ? true : false}
                  ref={passwordRef}
                  required
                  autoComplete='current-password'
                  id='password'
                />
              </div>
            </div>
            <div>
              <Button
                size='large'
                fullHeight={true}
                fullWidth={true}
                variant='primary'
                type='submit'
              >
                <span className='font-medium leading-5 text-sm'>{t('Login.Sign in')}</span>
                {iconSelect}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className='relative min-h-screen'>
      <Head>
        <title>{productTabTitle}</title>
      </Head>

      {/* Background image */}
      {/* Nextjs <Image> is not suitable for rebranding: it always uses the aspect ratio of the original logo  */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className='absolute inset-0 w-full h-full object-cover z-[-1]'
        src='/login_background.svg'
        alt='background'
      />
      <div className='text-gray-700 dark:text-gray-100'>
        <div className='absolute inset-0 z-[1000rem] hidden lg:block'>
          {showPeopleImage === 'show' && (
            <>
              {/* Nextjs <Image> is not suitable for rebranding: it always uses the aspect ratio of the original logo  */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className='w-full h-full object-contain transform -translate-x-[-20rem] xl:-translate-x-[-16rem] lg:scale-[40%] xl:scale-[60%] 2xl:scale-75'
                src='/action_voice-cti.svg'
                alt='image'
              />
            </>
          )}
        </div>

        {/* login card */}
        <div className='w-1/2'>
          <div className='absolute top-1/2 left-1/2 lg:left-40 transform -translate-y-1/2 -translate-x-1/2 lg:-translate-x-0'>
            <div className='border-b border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 p-10'>
              {showOTPVerification ? otpVerificationTemplate() : loginTemplate()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
