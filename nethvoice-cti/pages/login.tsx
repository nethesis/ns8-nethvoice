// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { saveCredentials } from '../lib/login'
import { navigateAfterSignIn } from '../lib/signInSplash'
import { CSSProperties, useState, useRef, useEffect } from 'react'
import { TextInput, InlineNotification, Button, OTPInput } from '../components/common'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRightToBracket,
  faCircleCheck,
  faCircleNotch,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons'
import { checkDarkTheme } from '../lib/darkTheme'
import { checkDensity } from '../lib/density'
import { useTranslation } from 'react-i18next'
import { store } from '../store'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { axiosSetup } from '../config/axios'
import {
  getBrandName,
  getBrandedTabTitle,
  getConfiguredFaviconUrl,
  getHtmlFaviconElement,
  getProductName,
  getProductSubname,
  getSavedQueryParams,
  closeToast,
  openToast,
  reloadPage,
} from '../lib/utils'
import { getTwoFactorStatus } from '../services/twoFactor'
import {
  getStringItem,
  loadPreference,
  removeItem,
  savePreference,
  setJSONItem,
  setStringItem,
} from '../lib/storage'
import { getLoginBackgroundLayers, getLoginLogos } from '../lib/loginAppearance'
import {
  UsernameStorage,
  loadRememberedUsername,
  updateRememberedUsername,
} from '../lib/rememberedUsername'
import { CustomThemedTooltip } from '../components/common/CustomThemedTooltip'
import Head from 'next/head'
import { capitalize } from 'lodash'
import { loginBeforeDashboard } from '../services/user'
import { otpVerify } from '../services/twoFactor'
import { OTPInputRef } from '../components/common/OTPInput'
import { decodeJWT } from '../lib/jwt'
import { isSsoAuthentication } from '../lib/password'
import { PasswordChangeForm } from '../components/settings/password/PasswordChangeForm'
import { changeExpiredPassword } from '../services/password'
import { PasswordPolicy } from '../services/types/password'

const usernameStorage: UsernameStorage = {
  getItem: getStringItem,
  setItem: setStringItem,
  removeItem,
}

const getRuntimeConfig = (): Record<string, unknown> | undefined =>
  typeof window !== 'undefined' ? (window as any).CONFIG : undefined

export default function Login() {
  const [pwdVisible, setPwdVisible] = useState(false)
  const [messageError, setMessaggeError] = useState('')
  const [onError, setOnError] = useState(false)
  const [onOTPError, setOnOTPError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showOTPVerification, setShowOTPVerification] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [isPasswordUpdated, setIsPasswordUpdated] = useState(false)
  const [expiredPasswordPolicy, setExpiredPasswordPolicy] = useState<PasswordPolicy | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [tempLoginData, setTempLoginData] = useState<{
    username: string
    password: string
    token?: string
  } | null>(null)
  const [rememberedUsername] = useState(() => loadRememberedUsername(usernameStorage))
  const [rememberUsername, setRememberUsername] = useState(!!rememberedUsername)
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
  const [logoFailed, setLogoFailed] = useState(false)
  const [passwordTooltipHidden, setPasswordTooltipHidden] = useState(false)

  let errorAlert = onError ? (
    <InlineNotification
      type='error'
      title={userNotAuthorized ? t('Login.User not autorized') : t('Login.Login failed')}
    >
      <p>{messageError}</p>
    </InlineNotification>
  ) : ctiStatus.webRtcError || window.location.href.includes('?error') ? (
    window.location.href.includes('ssoUserNotEnabled') ? (
      <InlineNotification type='error' title={t('Common.Warning')}>
        <p>{t('Login.SSO user not enabled')}</p>
      </InlineNotification>
    ) : window.location.href.includes('error=sso') ? (
      <InlineNotification type='error' title={t('Common.Warning')}>
        <p>{t('Login.SSO login failed')}</p>
      </InlineNotification>
    ) : ctiStatus.isUserInformationMissing || window.location.href.includes('sessionExpired') ? (
      <InlineNotification type='error' title={t('Common.Warning')}>
        <p>{t('Login.Session expired, log in again')}</p>
      </InlineNotification>
    ) : (
      <InlineNotification type='error' title={t('Common.Warning')}>
        <p>{t('Login.The application is open in another window')}</p>
      </InlineNotification>
    )
  ) : null

  let errorOTPAlert = onOTPError ? (
    <InlineNotification type='error' title={t('Login.OTP verification failed')}>
      <p>
        {t(
          'Login.The code you entered is invalid or has expired. Please check your authenticator app and try again.',
        ) || ''}
      </p>
    </InlineNotification>
  ) : null

  const router = useRouter()
  const usernameRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const passwordRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const otpInputRef = useRef() as React.MutableRefObject<OTPInputRef>
  const signingInRef = useRef(false)

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
        router.push('settings?section=Account')
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

  const showSignInError = (message: string) => {
    setUserNotAuthorized(false)
    setOnError(true)
    setMessaggeError(message)
  }

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (signingInRef.current) {
      return
    }
    signingInRef.current = true
    setLoading(true)
    setOnError(false)

    try {
      const username = usernameRef?.current?.value?.toLowerCase()
      const password = passwordRef?.current?.value

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
          // Focus OTP input after showing it
          setTimeout(() => otpInputRef.current?.focus(), 100)
          return
        } else {
          // No 2FA required, proceed with login
          await handleLogin(token, username)
        }
      } else {
        const data = await res.json().catch(() => null)
        if (callStatus === 401 && data?.message === 'password_expired') {
          // right credentials, but the password must be changed first
          setTempLoginData({ username: username, password: password })
          setExpiredPasswordPolicy(data?.data?.policy || null)
          setShowPasswordChange(true)
        } else if (callStatus === 401) {
          showSignInError(`${t('Login.Wrong username or password')}`)
        } else if (callStatus === 404) {
          showSignInError(`${t('Login.Network connection is lost')}`)
        } else if (callStatus === 429) {
          showSignInError(
            `${t('Login.Too many failed attempts. Wait a few minutes and try again.')}`,
          )
        } else {
          showSignInError(
            `${t('Login.The server did not answer as expected. Try again in a moment.')}`,
          )
        }
      }
    } catch (error) {
      showSignInError(
        error instanceof TypeError
          ? `${t('Login.Network connection is lost')}`
          : `${t('Login.The server did not answer as expected. Try again in a moment.')}`,
      )
    } finally {
      signingInRef.current = false
      setLoading(false)
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
        updateRememberedUsername(usernameStorage, username, rememberUsername)
        await showTwoFactorToastIfNeeded(username)
        navigateAfterSignIn(() => router.push('/'))
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
    checkDensity()
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

  const runtimeConfig = getRuntimeConfig()
  const loginLogos = getLoginLogos(runtimeConfig)
  const loginBackgrounds = getLoginBackgroundLayers(runtimeConfig)
  const brandName = getBrandName() || 'NethVoice'
  const backgroundStyle = {
    '--login-bg-light': loginBackgrounds.light,
    '--login-bg-dark': loginBackgrounds.dark,
  } as CSSProperties

  const signInIcon = (
    <FontAwesomeIcon
      icon={loading ? faCircleNotch : faArrowRightToBracket}
      className={loading ? 'fa-spin mr-2 h-4 w-4' : 'mr-2 h-4 w-4'}
      aria-hidden='true'
    />
  )

  const otpVerificationTemplate = () => (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <h2 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
          {t('Login.Two-Factor Authentication')}
        </h2>
        <p className='text-sm text-gray-600 dark:text-gray-400'>
          {t(
            'Login.Enter the 6-digit code (OTP code) from your authenticator app. If you cannot access the app, you can use one recovery OTP code.',
          )}
        </p>
      </div>
      {errorOTPAlert}
      <form onSubmit={verifyOTP} className='flex flex-col gap-6'>
        <div className='flex flex-col gap-2 text-center'>
          <p className='text-sm text-gray-600 dark:text-gray-200'>{t('Login.OTP code')}</p>
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
        <Button
          size='large'
          fullWidth={true}
          variant='primary'
          type='submit'
          className='h-9'
          disabled={loading || otpCode.length !== 6}
        >
          {signInIcon}
          <span>{t('Login.Sign in')}</span>
        </Button>
      </form>
    </div>
  )

  const logoClassName = 'h-10 w-auto max-w-full object-contain'
  const logoAlt = t('Common.Brand logo', { brand: brandName }) || ''

  const onLogoError = () => setLogoFailed(true)

  const productHeader = () => (
    <div className='mb-6 flex flex-col items-center gap-5 text-center'>
      {!loginLogos || logoFailed ? (
        <span className='text-2xl font-medium text-primary dark:text-primaryDark'>{brandName}</span>
      ) : loginLogos.light === loginLogos.dark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={logoClassName} src={loginLogos.light} alt={logoAlt} onError={onLogoError} />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${logoClassName} dark:hidden`}
            src={loginLogos.light}
            alt={logoAlt}
            onError={onLogoError}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${logoClassName} hidden dark:block`}
            src={loginLogos.dark}
            alt={logoAlt}
            onError={onLogoError}
          />
        </>
      )}
      {productSubname ? (
        <h1 className='text-2xl font-normal text-primary dark:text-primaryDark'>
          {productSubname}
        </h1>
      ) : (
        <h1 className='sr-only'>{productTabTitle}</h1>
      )}
    </div>
  )

  // back to the login form, to sign in with the new password
  const continueToSignIn = () => {
    const username = tempLoginData?.username || ''
    setShowPasswordChange(false)
    setIsPasswordUpdated(false)
    setTempLoginData(null)
    setExpiredPasswordPolicy(null)
    setTimeout(() => {
      if (usernameRef.current && passwordRef.current) {
        usernameRef.current.value = username
        passwordRef.current.focus()
      }
    })
  }

  const passwordChangeTemplate = () => {
    if (isPasswordUpdated) {
      return (
        <div className='flex flex-col gap-8'>
          <div className='flex flex-col items-center gap-3 text-center'>
            <div className='flex h-12 w-12 items-center justify-center rounded-full bg-surfaceToastSuccess dark:bg-surfaceToastSuccessDark'>
              <FontAwesomeIcon
                icon={faCircleCheck}
                className='h-6 w-6 text-iconSuccess dark:text-iconSuccessDark'
                aria-hidden='true'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <h2 className='text-2xl font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
                {t('Password.Password updated')}
              </h2>
              <p className='text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
                {t('Password.Sign in with your new password to continue.')}
              </p>
            </div>
          </div>
          <Button size='large' fullWidth={true} variant='primary' onClick={continueToSignIn}>
            <span>{t('Password.Continue to sign in')}</span>
          </Button>
        </div>
      )
    }

    return (
      <div className='flex flex-col gap-8'>
        <div className='flex flex-col gap-1'>
          <h2 className='text-xl font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
            {t('Password.Update your password')}
          </h2>
          <p className='text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
            {t('Password.Your password has expired, create a new one to continue')}
          </p>
        </div>
        <PasswordChangeForm
          username={tempLoginData?.username || ''}
          askCurrentPassword={false}
          currentPassword={tempLoginData?.password || ''}
          policy={expiredPasswordPolicy}
          submitLabel={t('Password.Update password')}
          layout='card'
          onSubmit={(currentPassword, newPassword) =>
            changeExpiredPassword(tempLoginData?.username || '', currentPassword, newPassword)
          }
          onSuccess={() => setIsPasswordUpdated(true)}
        />
      </div>
    )
  }

  const passwordToggleLabel = pwdVisible ? t('Password.Hide password') : t('Password.Show password')

  const passwordToggle = (
    <button
      type='button'
      onClick={() => setPwdVisible(!pwdVisible)}
      onFocus={() => setPasswordTooltipHidden(false)}
      onMouseEnter={() => setPasswordTooltipHidden(false)}
      onBlur={() => setPasswordTooltipHidden(true)}
      aria-label={passwordToggleLabel}
      data-tooltip-id='tooltip-login-password-visibility'
      data-tooltip-content={passwordToggleLabel}
      data-tooltip-hidden={passwordTooltipHidden}
      className='flex items-center justify-center rounded text-inputIcon focus:outline-none focus-visible:ring-2 focus-visible:ring-primaryLight dark:text-inputIconDark dark:focus-visible:ring-primaryDark'
    >
      <FontAwesomeIcon icon={pwdVisible ? faEyeSlash : faEye} className='h-4 w-4' aria-hidden='true' />
    </button>
  )

  const fieldLabelClassName = 'block text-sm font-medium text-gray-700 dark:text-gray-200'

  const loginTemplate = () => {
    const ssoConfig: any = runtimeConfig || {}
    const isSsoMethod = isSsoAuthentication(ssoConfig)
    const ssoLoginUrl = isSsoMethod ? ssoConfig.SSO_LOGIN_URL || '/sso' : ''
    const ssoButtonLabel = ssoConfig.SSO_BUTTON_LABEL || t('Login.Sign in with SSO')
    const ssoIdpName = ssoConfig.SSO_IDP_NAME || ''
    const ssoIdpLogo = ssoConfig.SSO_IDP_LOGO || ''

    if (ssoLoginUrl) {
      return (
        <div className='flex flex-col gap-6'>
          {errorAlert}
          <div className='flex flex-col gap-4'>
            <Button
              size='large'
              fullWidth={true}
              variant='primary'
              className='h-9'
              onClick={() => {
                window.location.href = ssoLoginUrl
              }}
            >
              <FontAwesomeIcon
                icon={faArrowRightToBracket}
                className='mr-2 h-4 w-4'
                aria-hidden='true'
              />
              <span>{ssoButtonLabel}</span>
            </Button>
            {(ssoIdpName || ssoIdpLogo) && (
              <div className='flex items-center justify-center gap-2'>
                {ssoIdpLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ssoIdpLogo} alt='' className='h-5 w-auto' />
                )}
                {ssoIdpName && (
                  <span className='text-sm text-gray-700 dark:text-gray-200'>{ssoIdpName}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <form action='#' method='POST' onSubmit={doLogin} className='flex flex-col gap-6'>
        {errorAlert}
        <div className='flex flex-col gap-8'>
          <div>
            <label htmlFor='username' className={fieldLabelClassName}>
              {t('Login.User')}
            </label>
            <div className='mt-2'>
              <TextInput
                placeholder=''
                name='username'
                ref={usernameRef}
                error={onError}
                required
                autoComplete='username'
                autoFocus={!rememberedUsername}
                defaultValue={rememberedUsername}
                id='username'
                className='[&_input]:h-9'
              />
            </div>
          </div>
          <div className='flex flex-col gap-3'>
            <div>
              <label htmlFor='password' className={fieldLabelClassName}>
                {t('Login.Password')}
              </label>
              <div className='mt-2'>
                <TextInput
                  placeholder=''
                  name='password'
                  type={pwdVisible ? 'text' : 'password'}
                  trailingComponent={passwordToggle}
                  error={onError}
                  ref={passwordRef}
                  required
                  autoComplete='current-password'
                  autoFocus={!!rememberedUsername}
                  id='password'
                  className='[&_input]:h-9'
                />
              </div>
            </div>
            <div className='flex h-6 items-center'>
              <input
                id='remember-username'
                name='remember-username'
                type='checkbox'
                checked={rememberUsername}
                onChange={(event) => setRememberUsername(event.target.checked)}
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primaryLight focus:ring-offset-gray-50 dark:border-gray-600 dark:bg-bgInputDark dark:text-primaryDark dark:checked:bg-primaryDark dark:focus:ring-primaryDark dark:focus:ring-offset-gray-900'
              />
              <label
                htmlFor='remember-username'
                className='ml-2.5 text-sm font-normal leading-5 text-gray-700 dark:text-gray-200'
              >
                {t('Login.Remember username')}
              </label>
            </div>
          </div>
        </div>
        <Button
          size='large'
          fullWidth={true}
          variant='primary'
          type='submit'
          className='h-9'
          disabled={loading}
        >
          {signInIcon}
          <span>{t('Login.Sign in')}</span>
        </Button>
        <CustomThemedTooltip id='tooltip-login-password-visibility' place='top' />
      </form>
    )
  }

  return (
    <div
      className='fixed inset-0 overflow-y-auto bg-body bg-cover bg-center bg-no-repeat text-gray-700 [--density:1] [--spacing:0.25rem] bg-[image:var(--login-bg-light)] dark:bg-bodyDark dark:bg-[image:var(--login-bg-dark)] dark:text-gray-100'
      style={backgroundStyle}
    >
      <Head>
        <title>{productTabTitle}</title>
      </Head>
      <div className='flex min-h-full items-center justify-center p-4'>
        <main className='w-full max-w-[31.25rem] rounded-xl bg-gray-50 px-6 py-14 shadow-lg dark:bg-gray-900 sm:px-10'>
          {productHeader()}
          {showOTPVerification
            ? otpVerificationTemplate()
            : showPasswordChange
            ? passwordChangeTemplate()
            : loginTemplate()}
        </main>
      </div>
    </div>
  )
}
