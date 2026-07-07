// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The content wrapper for the modal.
 *
 * @param children - The content of the modal content.
 *
 */

import type { FC, PropsWithChildren, ComponentProps } from 'react'
import { useTheme } from '../../../theme/Context'
import { cleanClassName } from '../../../lib/utils'

export type ModalContentProps = PropsWithChildren<Omit<ComponentProps<'div'>, 'className'>>

export const ModalContent: FC<ModalContentProps> = ({ children, ...props }) => {
  const { modal: theme } = useTheme().theme
  const theirProps = cleanClassName(props)

  return (
    <div className={theme.content} {...theirProps}>
      {children}
    </div>
  )
}
