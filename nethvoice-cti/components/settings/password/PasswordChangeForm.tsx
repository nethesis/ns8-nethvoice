// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, forwardRef, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleNotch,
  faCircleXmark,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons'
import { Button, InlineNotification, TextInput } from '../../common'
import { Divider } from '../../common/Divider'
import { PasswordPolicy } from '../../../services/types/password'
import {
  getPasswordError,
  getPasswordRequirements,
  PASSWORD_REQUIRED_CLASSES,
  PasswordRequirement,
} from '../../../lib/password'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  autoComplete: string
  error: string
  disabled: boolean
  onChange: (value: string) => void
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ id, label, value, autoComplete, error, disabled, onChange }, ref) => {
    const { t } = useTranslation()
    const [visible, setVisible] = useState(false)

    return (
      <TextInput
        ref={ref}
        id={id}
        name={id}
        label={label}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        error={!!error}
        helper={error || undefined}
        disabled={disabled}
        trailingComponent={
          error ? (
            <FontAwesomeIcon
              icon={faCircleExclamation}
              className='h-4 w-4 text-iconError dark:text-iconErrorDark'
            />
          ) : (
            <button
              type='button'
              onClick={() => setVisible(!visible)}
              aria-label={
                visible ? t('Password.Hide password') || '' : t('Password.Show password') || ''
              }
              className='text-iconSecondaryNeutral dark:text-iconSecondaryNeutralDark'
            >
              <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} className='h-4 w-4' />
            </button>
          )
        }
      />
    )
  },
)

PasswordField.displayName = 'PasswordField'

const Requirement: FC<{ requirement: PasswordRequirement; missing: boolean }> = ({
  requirement,
  missing,
}) => (
  <li className='flex items-center gap-2'>
    {requirement.met ? (
      <FontAwesomeIcon
        icon={faCircleCheck}
        className='h-4 w-4 text-iconSuccess dark:text-iconSuccessDark'
      />
    ) : missing ? (
      <FontAwesomeIcon
        icon={faCircleXmark}
        className='h-4 w-4 text-iconError dark:text-iconErrorDark'
      />
    ) : (
      <span className='h-4 w-4 rounded-full border-[1.5px] border-iconTertiaryNeutral dark:border-iconTertiaryNeutralDark' />
    )}
    <span>{requirement.label}</span>
  </li>
)

interface PasswordChangeFormProps {
  username: string
  // when false the current password is already known, e.g. typed in the login form
  askCurrentPassword: boolean
  currentPassword?: string
  policy: PasswordPolicy | null
  submitLabel: string
  // card: login card, full width button; drawer: side drawer actions
  layout: 'card' | 'drawer'
  // rejects with the middleware error message
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
  onSuccess: () => void
  onCancel?: () => void
}

export const PasswordChangeForm: FC<PasswordChangeFormProps> = ({
  username,
  askCurrentPassword,
  currentPassword: knownCurrentPassword = '',
  policy,
  submitLabel,
  layout,
  onSubmit,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState({ current: '', new: '', confirm: '', form: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const requirements = getPasswordRequirements(t, policy, newPassword)
  // missing requirements are highlighted only after a submit
  const metClasses = requirements.classes.filter((c) => c.met).length
  const classesMissing = submitted && metClasses < PASSWORD_REQUIRED_CLASSES

  const showError = (field: 'current' | 'new' | 'confirm' | 'form', text: string) => {
    setErrors({ current: '', new: '', confirm: '', form: '', [field]: text })
    const ref = { current: currentRef, new: newRef, confirm: confirmRef, form: null }[field]
    ref?.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const current = askCurrentPassword ? currentPassword : knownCurrentPassword
    setSubmitted(true)

    if (askCurrentPassword && !currentPassword) {
      showError('current', t('Password.Enter your current password'))
      return
    }
    if (!requirements.valid) {
      showError('new', t('Password.Choose a password that meets all requirements'))
      return
    }
    if (newPassword === current) {
      showError('new', t("Password.Choose a password you haven't used before"))
      return
    }
    if (confirmPassword !== newPassword) {
      showError('confirm', t('Password.Passwords do not match'))
      return
    }

    setErrors({ current: '', new: '', confirm: '', form: '' })
    setIsSubmitting(true)
    try {
      await onSubmit(current, newPassword)
      setIsSubmitting(false)
      // the form goes away: a password manager keeps its menu on the focused field
      ;(document.activeElement as HTMLElement | null)?.blur()
      onSuccess()
    } catch (message: any) {
      setIsSubmitting(false)
      const error = getPasswordError(t, String(message))
      // without the current password field, e.g. changed meanwhile elsewhere
      showError(error.field === 'current' && !askCurrentPassword ? 'form' : error.field, error.text)
    }
  }

  const clearError = (field: 'current' | 'new' | 'confirm') =>
    errors[field] && setErrors({ ...errors, [field]: '' })

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* username for the browser password manager */}
      <input
        type='text'
        name='username'
        value={username}
        autoComplete='username'
        style={{ display: 'none' }}
        readOnly
      />
      <div className='flex flex-col gap-8'>
        {errors.form && (
          <InlineNotification type='error' title={t('Password.Cannot update password')}>
            <p>{errors.form}</p>
          </InlineNotification>
        )}
        {askCurrentPassword && (
          <PasswordField
            ref={currentRef}
            id='current-password'
            label={t('Password.Current password')}
            value={currentPassword}
            autoComplete='current-password'
            error={errors.current}
            disabled={isSubmitting}
            onChange={(value) => {
              setCurrentPassword(value)
              clearError('current')
            }}
          />
        )}
        <div className='flex flex-col gap-3'>
          <PasswordField
            ref={newRef}
            id='new-password'
            label={t('Password.New password')}
            value={newPassword}
            autoComplete='new-password'
            error={errors.new}
            disabled={isSubmitting}
            onChange={(value) => {
              setNewPassword(value)
              clearError('new')
            }}
          />
          {(requirements.length || requirements.classes.length > 0) && (
            <ul className='flex flex-col gap-1 text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
              {requirements.length && (
                <Requirement
                  requirement={requirements.length}
                  missing={submitted && !requirements.length.met}
                />
              )}
              {requirements.classes.length > 0 && (
                <li>
                  {t('Password.Include at least {{count}} of the following', {
                    count: PASSWORD_REQUIRED_CLASSES,
                  })}
                </li>
              )}
              {requirements.classes.map((requirement) => (
                <Requirement
                  key={requirement.label}
                  requirement={requirement}
                  missing={classesMissing}
                />
              ))}
            </ul>
          )}
        </div>
        <PasswordField
          ref={confirmRef}
          id='confirm-password'
          label={t('Password.Confirm new password')}
          value={confirmPassword}
          autoComplete='new-password'
          error={errors.confirm}
          disabled={isSubmitting}
          onChange={(value) => {
            setConfirmPassword(value)
            clearError('confirm')
          }}
        />
      </div>
      {layout === 'card' ? (
        <Button variant='primary' type='submit' disabled={isSubmitting} className='w-full mt-8'>
          <span>{submitLabel}</span>
          {isSubmitting && <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />}
        </Button>
      ) : (
        <>
          <Divider spaceAbove='pt-8' spaceBelow='pb-6' />
          <div className='flex items-center justify-end gap-6'>
            {onCancel && (
              <Button variant='ghost' type='button' onClick={onCancel} disabled={isSubmitting}>
                {t('Common.Cancel')}
              </Button>
            )}
            <Button variant='primary' type='submit' disabled={isSubmitting}>
              <span>{submitLabel}</span>
              {isSubmitting && <FontAwesomeIcon icon={faCircleNotch} className='fa-spin ml-2' />}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
