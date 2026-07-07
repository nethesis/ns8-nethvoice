// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * It renders an input field.
 *
 * @param label - The label to render.
 * @param placeholder - The placeholder to render.
 * @param leadingIcon - The leading icon (before the input).
 * @param leadingIconClick - The callback on leading icon click.
 * @param icon - The icon to show (trailing or leading based on trailingIcon).
 * @param trailingIcon - Whether the icon is trailing.
 * @param error - Whether the input has an error.
 * @param helper - The text of the helper.
 * @param size - The size of the input.
 * @param rounded - The border radius of the input.
 * @param squared - The squared corners of the input.
 * @param onIconClick - The callback on icon click.
 * @param trailingComponent - The component to render at the end of the input.
 *
 */

import { ComponentProps, FC, forwardRef, ReactNode } from 'react'
import { cleanClassName } from '../../lib/utils'
import { useTheme } from '../../theme/Context'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-common-types'

export interface TextInputProps extends Omit<ComponentProps<'input'>, 'ref' | 'color' | 'size'> {
  label?: string
  placeholder?: string
  leadingIcon?: IconDefinition
  leadingIconClick?: () => void
  icon?: IconDefinition
  trailingIcon?: boolean
  error?: boolean
  helper?: string
  size?: 'base' | 'large'
  rounded?: 'base' | 'full'
  squared?: 'left' | 'right' | 'top' | 'bottom'
  onIconClick?: () => void
  trailingComponent?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      placeholder,
      leadingIcon,
      leadingIconClick,
      icon: Icon,
      trailingIcon,
      type = 'text',
      error,
      helper,
      size,
      rounded,
      squared,
      onIconClick,
      id,
      className,
      trailingComponent,
      ...props
    },
    ref,
  ) => {
    const cleanProps = cleanClassName(props)
    const { input: theme } = useTheme().theme
    return (
      <div className={classNames('text-left', 'w-full', className)}>
        {label && (
          <label className={theme.label} htmlFor={id}>
            {label}
          </label>
        )}
        <div className='relative'>
          {leadingIcon && (
            <div className={classNames(theme.icon.base, theme.icon.left)}>
              <FontAwesomeIcon
                icon={leadingIcon}
                className={classNames(
                  size === 'large' ? theme.icon.size.large : theme.icon.size.base,
                  error ? theme.icon.red : theme.icon.gray,
                  leadingIconClick && 'cursor-pointer',
                )}
                onClick={() => leadingIconClick && leadingIconClick()}
              />
            </div>
          )}
          {Icon && (
            <div
              className={classNames(
                theme.icon.base,
                trailingIcon ? theme.icon.right : theme.icon.left,
              )}
            >
              <FontAwesomeIcon
                icon={Icon}
                className={classNames(
                  size === 'large' ? theme.icon.size.large : theme.icon.size.base,
                  error ? theme.icon.red : theme.icon.gray,
                  onIconClick && 'cursor-pointer',
                )}
                onClick={() => onIconClick && onIconClick()}
              />
            </div>
          )}
          <div className='relative flex items-center'>
            <input
              type={type}
              id={id}
              placeholder={placeholder}
              className={classNames(
                theme.base,
                label && 'mt-1',
                rounded === 'full' ? theme.rounded.full : theme.rounded.base,
                squared ? theme.squared[squared] : '',
                size && size === 'large' ? theme.size.large : theme.size.base,
                !error ? theme.colors.gray : theme.colors.error,
                leadingIcon || (Icon && !trailingIcon) ? 'pl-10' : '',
                trailingComponent ? 'pr-10' : '',
                error ? theme.placeholder.error : theme.placeholder.base,
                'text-gray-900',
              )}
              {...cleanProps}
              ref={ref}
            />
            {trailingComponent && (
              <div className='absolute right-3 flex items-center h-full'>{trailingComponent}</div>
            )}
          </div>
        </div>
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

TextInput.displayName = 'TextInput'
