import { FC, ReactNode, RefObject } from 'react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/Context'
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
  type?: 'info' | 'warning' | 'success' | 'error'
  children?: ReactNode
}

const TYPE_ICONS = {
  info: faCircleInfo,
  warning: faTriangleExclamation,
  success: faCircleCheck,
  error: faCircleXmark,
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
  type = 'warning',
  children,
}) => {
  const { modal: theme } = useTheme().theme
  const { t } = useTranslation()
  const closeAriaLabel = String(t('Common.Close') || 'Close')

  return (
    <Modal show={show} focus={focus} onClose={onClose} afterLeave={afterLeave}>
      <div className='flex items-start gap-4 bg-white p-6 dark:bg-gray-900'>
        <div className={classNames(theme.roundedIcon.base, theme.roundedIcon.surface[type])}>
              <FontAwesomeIcon
            icon={TYPE_ICONS[type]}
            className={theme.roundedIcon.iconStyle[type]}
                aria-hidden='true'
              />
        </div>

        <div className='flex min-w-0 flex-1 flex-col gap-4 text-left'>
          <div className='flex flex-col gap-2'>
            <div className='flex items-start justify-between gap-2'>
              <h3 className='min-w-0 flex-1 text-lg font-medium leading-7 text-primaryNeutral dark:text-primaryNeutralDark'>
                {title}
              </h3>
          <Button
            type='button'
            variant='ghost'
            size='small'
            iconOnly
            onClick={onClose}
            aria-label={closeAriaLabel}
                className='-mr-2 -mt-1 shrink-0 !text-gray-500 hover:!text-gray-700 dark:!text-gray-400 dark:hover:!text-gray-200'
          >
            <FontAwesomeIcon icon={faXmark} className='h-5 w-5' aria-hidden='true' />
          </Button>
            </div>

              {description && (
              <div className='text-sm leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                  {description}
                </div>
              )}
        </div>

          {children}

          <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6'>
          <Button variant='ghost' onClick={onClose} ref={focus} disabled={cancelDisabled}>
            {cancelLabel || t('Common.Cancel')}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
      </div>
    </Modal>
  )
}

ConfirmationModal.displayName = 'ConfirmationModal'
