// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useState, useEffect, ComponentProps, ReactNode } from 'react'
import classNames from 'classnames'
import { useTheme } from '../../theme/Context'
import { Switch as HeadlessSwitch } from '@headlessui/react'

export interface IconSwitchProps extends ComponentProps<'div'> {
  on?: boolean
  offIcon?: ReactNode
  onIcon?: ReactNode
  size?: 'small' | 'base' | 'large' | 'extra_large'
  changed?: (enabled: boolean) => void
  disabled?: boolean
  lighterOnDark?: boolean
  isFavorite?: boolean
}

export const IconSwitch: FC<IconSwitchProps> = ({
  changed,
  on = false,
  offIcon,
  onIcon,
  size = 'base',
  disabled,
  lighterOnDark = false,
  isFavorite = false,
  className,
  ...props
}): JSX.Element => {
  const [enabled, setEnabled] = useState(on || false)
  const { iconSwitch: theme } = useTheme().theme

  useEffect(() => {
    setEnabled(on)
  }, [on])

  const callback = () => {
    setEnabled(!enabled)
    changed && changed(!enabled)
  }

  return (
    // eslint-disable-next-line react/no-did-mount-set-state
    <HeadlessSwitch.Group {...(props as { ref?: React.Ref<unknown> })}>
      <HeadlessSwitch
        checked={enabled}
        onChange={() => callback()}
        disabled={disabled}
        className={classNames(theme.base, size && theme.sizes[size], className)}
      >
        <span
          className={classNames(
            enabled
              ? isFavorite
                ? theme.iconEnabledFavorite
                : lighterOnDark
                ? theme.iconEnabledLighterOnDark
                : theme.iconEnabled
              : theme.iconDisabled,
          )}
        >
          {enabled ? onIcon : offIcon}
        </span>
      </HeadlessSwitch>
    </HeadlessSwitch.Group>
  )
}
