import { FC, ReactNode, RefObject } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Button, ButtonProps } from './Button'
import { Modal } from './Modal'

export interface ConfirmationModalProps {
  show: boolean
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  onConfirm: () => void
  onClose: () => void
  focus?: RefObject<HTMLButtonElement>
  afterLeave?: () => void
  confirmDisabled?: boolean
  cancelDisabled?: boolean
  confirmVariant?: ButtonProps['variant']
  children?: ReactNode
}

export const ConfirmationModal: FC<ConfirmationModalProps> = ({
  show,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  focus,
  afterLeave,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmVariant = 'danger',
  children,
}) => {
  const { t } = useTranslation()
  const closeAriaLabel = String(t('Common.Close') || 'Close')

  return (
    <Modal show={show} focus={focus} onClose={onClose} afterLeave={afterLeave}>
      <div className='bg-white px-6 py-6 dark:bg-gray-900'>
        <div className='relative w-full pr-10'>
          <Button
            type='button'
            variant='ghost'
            size='small'
            iconOnly
            onClick={onClose}
            aria-label={closeAriaLabel}
            className='absolute right-0 top-0 !text-gray-500 hover:!text-gray-700 dark:!text-gray-400 dark:hover:!text-gray-200'
          >
            <FontAwesomeIcon icon={faXmark} className='h-5 w-5' aria-hidden='true' />
          </Button>

          <div className='flex items-start gap-4'>
            <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800'>
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className='h-5 w-5 text-amber-700 dark:text-amber-50'
                aria-hidden='true'
              />
            </div>

            <div className='min-w-0 flex-1 text-left'>
              <h3 className='font-poppins text-xl font-medium text-gray-900 dark:text-gray-50'>
                {title}
              </h3>

              {description && (
                <div className='mt-5 text-base leading-6 text-gray-600 dark:text-gray-300'>
                  {description}
                </div>
              )}

              {children && <div className='mt-4'>{children}</div>}
            </div>
          </div>
        </div>

        <div className='mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
          <Button variant='ghost' onClick={onClose} ref={focus} disabled={cancelDisabled}>
            {cancelLabel || t('Common.Cancel')}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

ConfirmationModal.displayName = 'ConfirmationModal'
