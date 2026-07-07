// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The content wrapper for the avatar group.
 *
 * @param children - The contant of the avatar group.
 *
 */

import type { FC, PropsWithChildren, ComponentProps } from 'react'
import { useTheme } from '../../../theme/Context'
import { cleanClassName } from '../../../lib/utils'
import classNames from 'classnames'

export interface AvatarGroupProps extends PropsWithChildren<ComponentProps<'div'>> {
  reversed?: boolean
}

export const AvatarGroup: FC<AvatarGroupProps> = ({ children, reversed, className, ...props }) => {
  const { avatar: theme } = useTheme().theme
  const cleanProps = cleanClassName(props)

  return (
    <div className={classNames(theme.group, reversed && theme.reverse, className)} {...cleanProps}>
      {children}
    </div>
  )
}
