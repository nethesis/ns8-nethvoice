import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClone } from '@fortawesome/free-solid-svg-icons'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './Button'
import { t } from 'i18next'
import { CustomThemedTooltip } from './CustomThemedTooltip'

type NotificationPosition = 'left' | 'right' | 'top' | 'bottom'

interface CopyToClipboardProps {
  number: string
  id: string
  isWhite?: boolean
  notificationPosition?: NotificationPosition
}

const CopyToClipboard: React.FC<CopyToClipboardProps> = ({
  number,
  id,
  isWhite = false,
  notificationPosition = 'left',
}) => {
  const [showMessage, setShowMessage] = useState(false)

  const handleCopy = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    navigator.clipboard.writeText(number?.trim()).then(() => {
      setShowMessage(true)
      setTimeout(() => setShowMessage(false), 2000)
    })
  }

  const getPositionStyles = (): React.CSSProperties => {
    switch (notificationPosition) {
      case 'left':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px',
        }
      case 'right':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '8px',
        }
      case 'top':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
        }
      case 'bottom':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
        }
      default:
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px',
        }
    }
  }

  const getAnimationProps = () => {
    const isVertical = notificationPosition === 'top' || notificationPosition === 'bottom'
    return {
      initial: { opacity: 0, [isVertical ? 'y' : 'x']: isVertical ? -10 : (notificationPosition === 'left' ? 10 : -10) },
      animate: { opacity: 1, [isVertical ? 'y' : 'x']: 0 },
      exit: { opacity: 0 },
    }
  }

  return (
    <>
      <div className='relative flex items-center'>
        <div className="relative">
          <AnimatePresence>
            {showMessage && (
              <motion.div
                {...getAnimationProps()}
                transition={{ duration: 0.3 }}
                className='absolute dark:bg-gray-100 bg-gray-800 dark:text-gray-900 text-gray-50 text-xs px-2 py-2 rounded shadow-lg w-40 text-center z-10'
                style={getPositionStyles()}
              >
                {t('Common.Copied to clipboard')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button
          variant='ghost'
          className='ml-2 h-9 w-9'
          data-tooltip-id={`tooltip-${id}`}
          data-tooltip-content={t('Common.Copy to clipboard') || ''}
          onClick={handleCopy}
        >
          <FontAwesomeIcon 
            icon={faClone} 
            aria-hidden='true' 
          />
        </Button>
      </div>
      <CustomThemedTooltip id={`tooltip-${id}`} place='top' />
    </>
  )
}

export default CopyToClipboard
