// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The Modal component shows elements in foreground
 *
 * @param show - The parameter to show the modal.
 * @param size - The size of the modal.
 * @param focus - The size of the modal.
 * @param onClose - The size of the modal.
 * @param afterLeave - The callback for the after leave event.
 *
 */

import { FC, ComponentProps, PropsWithChildren, RefObject } from 'react'
import { Fragment, createRef } from 'react'
import { useTheme } from '../../../theme/Context'
import { cleanClassName, customScrollbarClass } from '../../../lib/utils'
import { ModalContent } from './ModalContent'
import { ModalActions } from './ModalActions'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
import classNames from 'classnames'

export interface ModalProps extends PropsWithChildren<ComponentProps<'div'>> {
  show?: boolean
  size?: 'base' | 'large'
  focus?: RefObject<HTMLElement>
  onClose: () => void
  afterLeave?: () => void
}

const ModalComponent: FC<ModalProps> = ({
  children,
  show,
  size = 'base',
  focus = createRef(),
  onClose,
  className,
  afterLeave,
  ...props
}) => {
  const { modal: theme } = useTheme().theme
  const cleanProps = cleanClassName(props)

  return (
    <Transition show={show} as={Fragment} afterLeave={() => afterLeave && afterLeave()}>
      <Dialog
        as='div'
        className={classNames('relative', 'z-50', className)}
        onClose={() => onClose()}
        initialFocus={focus && focus}
        {...cleanProps}
      >
        <TransitionChild as={Fragment} {...theme.panel.transition}>
          <div className={theme.background.base} />
        </TransitionChild>
        <div className={`fixed inset-0 z-50 ${customScrollbarClass}`}>
          <div className='flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0'>
            <TransitionChild as={Fragment} {...theme.background.transition}>
              <DialogPanel className={theme.panel.base}>{children}</DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

ModalComponent.displayName = 'Modal'
ModalContent.displayName = 'Modal.Content'
ModalActions.displayName = 'Modal.Actions'

export const Modal = Object.assign(ModalComponent, {
  Content: ModalContent,
  Actions: ModalActions,
})
