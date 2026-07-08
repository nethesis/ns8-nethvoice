import React, { FC, ComponentProps, useRef, useEffect, useState } from 'react'
import { useTheme } from '../../theme/Context'
import { Transition } from '@headlessui/react'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleInfo,
  faTriangleExclamation,
  faCircleCheck,
  faCircleXmark,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from './Button'

export interface ToastProps extends ComponentProps<'div'> {
  type: 'info' | 'warning' | 'success' | 'error' | 'failed'
  title: string
  children: React.ReactNode
  className?: string
  onClose: () => void
  show: boolean
  timeout: number
  pauseTimerOnHover?: boolean
  onTimerEnd?: () => void
  smaller?: boolean
}

export const Toast: FC<ToastProps> = ({
  type,
  title,
  children,
  className,
  onClose,
  show,
  timeout,
  pauseTimerOnHover = false,
  onTimerEnd,
  smaller = false,
}): JSX.Element => {
  const { toast: theme } = useTheme().theme
  const isTextOnly = typeof children === 'string' || typeof children === 'number'
  const [isHovered, setIsHovered] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [remainingTime, setRemainingTime] = useState(timeout * 1000)

  useEffect(() => {
    if (!show) return

    const handleTimeout = () => {
      onTimerEnd?.()
      onClose()
    }

    if (pauseTimerOnHover && isHovered) {
      // Pause timer when hovering
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    } else {
      // Resume timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(handleTimeout, remainingTime)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [show, isHovered, pauseTimerOnHover, remainingTime, onClose, onTimerEnd])

  const handleMouseEnter = () => {
    if (pauseTimerOnHover) {
      setIsHovered(true)
    }
  }

  const handleMouseLeave = () => {
    if (pauseTimerOnHover) {
      setIsHovered(false)
    }
  }

  let checkIcon =
    type === 'info' ? (
      <div
        className={`bg-surfaceToastInfo dark:bg-surfaceToastInfoDark text-iconInfo dark:text-iconInfoDark rounded-3xl w-10 h-10 flex items-center justify-center shrink-0`}
      >
        <FontAwesomeIcon icon={faCircleInfo} className='h-4 w-4' aria-hidden='true' />
      </div>
    ) : type === 'warning' ? (
      <div
        className={`bg-surfaceToastWarning dark:bg-surfaceToastWarningDark text-iconWarning dark:text-iconWarningDark rounded-3xl w-10 h-10 flex items-center justify-center shrink-0`}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} className='h-4 w-4' aria-hidden='true' />
      </div>
    ) : type === 'success' ? (
      <div
        className={`bg-surfaceToastSuccess dark:bg-surfaceToastSuccessDark text-iconSuccess dark:text-iconSuccessDark rounded-3xl w-10 h-10 flex items-center justify-center shrink-0`}
      >
        <FontAwesomeIcon icon={faCircleCheck} className='h-4 w-4' aria-hidden='true' />
      </div>
    ) : (
      <div
        className={`bg-surfaceToastError dark:bg-surfaceToastErrorDark text-iconError dark:text-iconErrorDark rounded-3xl w-10 h-10 flex items-center justify-center shrink-0`}
      >
        <FontAwesomeIcon icon={faCircleXmark} className='h-4 w-4' aria-hidden='true' />
      </div>
    )

  return (
    <Transition
      show={show}
      as={React.Fragment}
      enter='transform ease-out duration-300 transition'
      enterFrom='translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2'
      enterTo='translate-y-0 opacity-100 sm:translate-x-0'
      leave='transition ease-in duration-100'
      leaveFrom='opacity-100'
      leaveTo='opacity-0'
    >
      <div
        className={classNames(
          'pointer-events-auto relative overflow-hidden rounded-lg bg-elevationL2Invert dark:bg-elevationL2InvertDark shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200/5 dark:border-gray-700/60 p-6 w-full flex items-start gap-4',
          smaller ? 'max-w-sm' : 'max-w-xl',
          className,
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {checkIcon}
        <div className='flex-1 flex flex-col gap-4 relative'>
          <div className='flex flex-col gap-2 pr-6'>
            <p className='text-lg font-medium leading-7 text-primaryNeutral dark:text-primaryNeutralDark'>
              {title}
            </p>
            {isTextOnly ? (
              <p className='text-sm font-normal leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                {children}
              </p>
            ) : (
              <div className='text-sm font-normal leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
                {children}
              </div>
            )}
          </div>
          <button
            className='absolute right-0 top-1 p-0 bg-transparent border-0 cursor-pointer'
            onClick={onClose}
            aria-label='Close'
          >
            <FontAwesomeIcon
              icon={faXmark}
              className='h-4 w-4 text-primaryNeutral dark:text-primaryNeutralDark'
              aria-hidden='true'
            />
          </button>
        </div>
      </div>
    </Transition>
  )
}

export default Toast
