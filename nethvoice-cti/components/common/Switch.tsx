// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The switch can be used to manage boolean values.
 *
 * @param on - To render the button on.
 * @param changed - The callback when changed.
 * @param disabled - To render the button disabled.
 * @param label - The label to show.
 *
 */

import { FC, useState, useEffect, ComponentProps } from 'react'
import classNames from 'classnames'
import { useTheme } from '../../theme/Context'
import { Switch as HeadlessSwitch } from '@headlessui/react'

export interface SwitchProps extends ComponentProps<'div'> {
  on?: boolean
  changed?: (enabled: boolean) => void
  disabled?: boolean
  label?: string
}

export const Switch: FC<SwitchProps> = ({
  changed,
  on = false,
  disabled,
  label,
  className,
}): JSX.Element => {
  const [enabled, setEnabled] = useState(on || false)
  const { switch: switchTheme } = useTheme().theme
  const backgroundOn = disabled ? switchTheme.off.primary : switchTheme.on.primary
  const backgroundOff = disabled ? switchTheme.off.gray : switchTheme.on.gray

  useEffect(() => {
    setEnabled(on)
  }, [on])

  const callback = () => {
    setEnabled(!enabled)
    changed && changed(!enabled)
  }

  return (
    <div>
      <HeadlessSwitch.Group>
        <div
          className={classNames('w-fit ', 'flex', 'items-center', 'flex-row-reverse', className)}
        >
          {label && (
            <HeadlessSwitch.Label className='ml-3 text-sm text-gray-900 dark:text-gray-100'>
              {label}
            </HeadlessSwitch.Label>
          )}
          <HeadlessSwitch
            checked={enabled}
            onChange={() => callback()}
            disabled={disabled}
            className={classNames(enabled ? backgroundOn : backgroundOff, switchTheme.background)}
          >
            <span
              className={classNames(
                switchTheme.circle,
                enabled ? switchTheme.on.translate : switchTheme.off.translate,
              )}
            />
          </HeadlessSwitch>
        </div>
      </HeadlessSwitch.Group>
    </div>
  )
}
