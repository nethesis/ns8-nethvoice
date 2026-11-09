// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * It can be used to render a label with an icon.
 *
 * @param children - The children/s to render.
 * @param size - The button size.
 * @param variant - The variant of the button to render.
 * @param fullWidth - Sets the button full width.
 * @param fullHieght - Sets the button full height.
 *
 */

import { ComponentPropsWithRef, forwardRef, ReactNode } from 'react'
import classNames from 'classnames'
import { useTheme } from '../../theme/Context'

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'color' | 'style'> {
  children: ReactNode
  size?: 'small' | 'base' | 'large' | 'full'
  variant?:
    | 'primary'
    | 'secondary'
    | 'white'
    | 'ghost'
    | 'danger'
    | 'dashboard'
    | 'whiteDanger'
    | 'call'
    | 'primaryPhoneIsland'
  fullWidth?: boolean
  fullHeight?: boolean
  iconOnly?: boolean
  disabled?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      size = 'base',
      variant = 'primary',
      fullWidth,
      fullHeight,
      iconOnly,
      disabled,
      className,
      ...props
    },
    ref,
  ): JSX.Element => {
    const { button: theme } = useTheme().theme
    return (
      <button
        disabled={disabled}
        className={classNames(
          variant !== 'call' && variant !== 'primaryPhoneIsland'
            ? theme.base
            : theme.phoneIslandBase,
          theme[variant],
          !iconOnly && size && (theme.sizes as any)[size],
          iconOnly && size !== 'full' && (theme.iconOnly as any)[size],
          size === 'full'
            ? theme.rounded.full
            : size === 'small'
            ? theme.rounded.small
            : theme.rounded.base,
          fullWidth && theme.sizes.full_w,
          fullHeight && theme.sizes.full_h,
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        ref={ref}
        {...props}
      >
        {typeof children !== 'undefined' && children}
      </button>
    )
  },
)

Button.displayName = 'Button'
