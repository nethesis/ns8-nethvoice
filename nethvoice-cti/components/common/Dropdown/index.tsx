// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, Fragment, ReactNode } from 'react'
import { Menu, MenuButton, MenuItems, Transition } from '@headlessui/react'
import { DropdownItem } from './DropdownItem'
import { DropdownHeader } from './DropdownHeader'
import { useTheme } from '../../../theme/Context'
import classNames from 'classnames'

export interface DropdownProps extends ComponentProps<'div'> {
  items: ReactNode
  divider?: boolean
  position?:
    | 'left'
    | 'right'
    | 'top'
    | 'bottom'
    | 'leftSingleItem'
    | 'topMultipleItem'
    | 'leftUpTwoItems'
    | 'leftUpVoicemail'
    | 'leftDownVoicemail'
    | 'topVoicemail'
    | 'bottomVoicemail'
    | 'oneVoicemail'
  size?: 'full'
}

const DropdownComponent: FC<DropdownProps> = ({
  children,
  items,
  divider,
  position,
  size,
  className,
}) => {
  const { dropdown: theme } = useTheme().theme

  return (
    <Menu as='div' className={classNames(theme.base, className)}>
      <MenuButton as='div' className={classNames(size && theme.size[size])}>
        {children}
      </MenuButton>
      <MenuItems
        className={classNames(
          theme.items.base,
          divider && theme.items.divider,
          position ? theme.items.position[position] : theme.items.position.right,
          position === 'top' ? 'py-1' : '',
        )}
      >
        {items}
      </MenuItems>
    </Menu>
  )
}

DropdownItem.displayName = 'Dropdown.Item'
DropdownHeader.displayName = 'Dropdown.Header'

export const Dropdown = Object.assign(DropdownComponent, {
  Item: DropdownItem,
  Header: DropdownHeader,
})
