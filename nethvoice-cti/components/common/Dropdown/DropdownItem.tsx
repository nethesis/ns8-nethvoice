// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps } from 'react'
import { Menu, MenuItem } from '@headlessui/react'
import classNames from 'classnames'
import { useTheme } from '../../../theme/Context'
import { cleanClassName } from '../../../lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-common-types'

export interface DropdownItemProps extends Omit<ComponentProps<'div'>, 'className'> {
  onClick?: () => void
  icon?: IconDefinition
  iconClassName?: string
  centered?: boolean
  variantTop?: boolean
  isRed?: boolean
}

export const DropdownItem: FC<DropdownItemProps> = ({
  children,
  onClick,
  icon: Icon,
  iconClassName = '',
  centered,
  variantTop,
  isRed,
  ...props
}) => {
  const { dropdown: theme } = useTheme().theme
  const theirProps = cleanClassName(props)

  return (
    <MenuItem>
      {({ active }) => (
        <div
          className={classNames(
            !isRed ? theme?.item?.base : theme?.item?.baseRed,
            !isRed && active ? theme?.item?.active : isRed && active ? theme.item.activeRed : '',
            isRed && !active ? theme.item.textRed : '',
            centered && theme.item.centered,
            variantTop ? '' : 'py-2',
          )}
          onClick={onClick}
          {...theirProps}
        >
          {Icon && (
            <FontAwesomeIcon
              icon={Icon}
              className={classNames(
                isRed && !active ? theme?.item?.iconRed : !isRed ? theme?.item?.icon : '',
                iconClassName,
              )}
            />
          )}
          {children}
        </div>
      )}
    </MenuItem>
  )
}
