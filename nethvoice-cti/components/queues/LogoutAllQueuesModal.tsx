// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useRef, MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '../common'

export interface LogoutAllQueuesModalProps extends ComponentProps<'div'> {
  isShown: boolean
  queuesToLogout: any[]
  onConfirm: Function
  onClose: Function
}

export const LogoutAllQueuesModal: FC<LogoutAllQueuesModalProps> = ({
  isShown,
  queuesToLogout,
  onConfirm,
  onClose,
}): JSX.Element => {
  const { t } = useTranslation()

  const cancelButtonRef = useRef() as MutableRefObject<HTMLButtonElement>

  return (
    <Modal show={isShown} focus={cancelButtonRef} onClose={() => onClose()}>
      <Modal.Content>
        <div className='mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 bg-red-100 dark:bg-red-900'>
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className='h-6 w-6 text-red-600 dark:text-red-200'
            aria-hidden='true'
          />
        </div>
        <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
          <h3 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100'>
            {t('Queues.Logout from all queues')}
          </h3>
          <div className='mt-3'>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              {t('Queues.You are about to logout from the following queues')}:
              <ul className='list-disc list-inside mt-2'>
                {queuesToLogout.map((queue: any, index: number) => (
                  <li key={index}>{`${queue.name} (${queue.queue})`}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button variant='danger' onClick={() => onConfirm()}>
          {t('Queues.Logout')}
        </Button>
        <Button variant='ghost' onClick={() => onClose()} ref={cancelButtonRef}>
          {t('Common.Cancel')}
        </Button>
      </Modal.Actions>
    </Modal>
  )
}

LogoutAllQueuesModal.displayName = 'LogoutAllQueuesModal'
