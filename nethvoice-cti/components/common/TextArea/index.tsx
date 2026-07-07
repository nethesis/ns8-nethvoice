// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * It renders a textarea field.
 *
 * @param label - The label to render.
 * @param placeholder - The placeholder to render.
 * @param error - Whether the textarea has an error.
 * @param helper - The text of the helper.
 * @param disabled - Whether the textarea is disabled.
 * @param optional - Whether the field is optional.
 * @param rows - The number of rows for the textarea.
 *
 */

import { ComponentProps, FC, forwardRef } from 'react'
import { cleanClassName, customScrollbarClass } from '../../../lib/utils'
import { useTheme } from '../../../theme/Context'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export interface TextAreaProps extends Omit<ComponentProps<'textarea'>, 'ref'> {
  label?: string
  placeholder?: string
  error?: boolean
  helper?: string
  disabled?: boolean
  optional?: boolean
  rows?: number
  readonly?: boolean
  textareaClassName?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      placeholder,
      error,
      helper,
      disabled = false,
      optional = false,
      rows = 4,
      id,
      readOnly = false,
      className,
      textareaClassName,
      ...props
    },
    ref,
  ) => {
    const cleanProps = cleanClassName(props)
    const { textarea: theme } = useTheme().theme
    const { t } = useTranslation()

    return (
      <div className={classNames('text-left', 'w-full', className)}>
        {label && (
          <div className='flex items-center justify-between'>
            <label className={theme.label} htmlFor={id}>
              {label}
            </label>
            {optional && <span className={theme.optional}>{t('Common.Optional')}</span>}
          </div>
        )}
        <textarea
          id={id}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={classNames(
            theme.base,
            readOnly && 'bg-surfaceBackgroundReadonly dark:bg-surfaceBackgroundReadonlyDark',
            label && 'mt-1',
            !error ? theme.colors.gray : theme.colors.error,
            'text-gray-900',
            customScrollbarClass,
            textareaClassName,
          )}
          {...cleanProps}
          ref={ref}
          readOnly={readOnly}
        />
        {helper && (
          <p
            className={classNames(
              theme.helper.base,
              error ? theme.helper.color.error : theme.helper.color.base,
            )}
          >
            {helper}
          </p>
        )}
      </div>
    )
  },
)

TextArea.displayName = 'TextArea'
