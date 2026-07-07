// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The actions wrapper for the modal.
 *
 * @param children - The content of the modal actions.
 *
 */

import type { FC, PropsWithChildren, ComponentProps } from 'react'
import { useTheme } from '../../../theme/Context'
import { cleanClassName } from '../../../lib/utils'

export type ModalActionsProps = PropsWithChildren<Omit<ComponentProps<'div'>, 'className'>>

export const ModalActions: FC<ModalActionsProps> = ({ children, ...props }) => {
  const { modal: theme } = useTheme().theme
  const theirProps = cleanClassName(props)

  return (
    <div className={theme.actions} {...theirProps}>
      {children}
    </div>
  )
}
