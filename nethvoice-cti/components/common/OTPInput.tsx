// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useRef,
  useEffect,
  KeyboardEvent,
  ClipboardEvent,
  forwardRef,
  useImperativeHandle,
} from 'react'

interface OTPInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  className?: string
  error?: boolean
}

export interface OTPInputRef {
  focus: () => void
  clear: () => void
}

export const OTPInput = forwardRef<OTPInputRef, OTPInputProps>(
  ({ value, onChange, length = 6, disabled = false, className = '', error = false }, ref) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Initialize input refs array
    useEffect(() => {
      inputRefs.current = inputRefs.current.slice(0, length)
    }, [length])

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      focus: () => {
        const firstEmptyIndex = value.length < length ? value.length : 0
        inputRefs.current[firstEmptyIndex]?.focus()
      },
      clear: () => {
        onChange('')
        inputRefs.current[0]?.focus()
      },
    }))

    // Auto-focus first input on mount
    useEffect(() => {
      if (!disabled) {
        inputRefs.current[0]?.focus()
      }
    }, [disabled])

    const focusInput = (index: number) => {
      if (inputRefs.current[index]) {
        inputRefs.current[index]?.focus()
      }
    }

    const focusNextInput = (index: number) => {
      if (index < length - 1) {
        focusInput(index + 1)
      }
    }

    const focusPrevInput = (index: number) => {
      if (index > 0) {
        focusInput(index - 1)
      }
    }

    const handleChange = (index: number, inputValue: string) => {
      // Remove any non-digit characters
      const digit = inputValue.replace(/\D/g, '')

      if (digit.length <= 1) {
        const newValue = value.split('')
        newValue[index] = digit
        const updatedValue = newValue.join('').slice(0, length)
        onChange(updatedValue)

        // Auto-focus next input if a digit was entered
        if (digit && index < length - 1) {
          focusNextInput(index)
        }
      }
    }

    const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      const { key } = event

      if (key === 'Backspace') {
        if (value[index]) {
          // Clear current input
          const newValue = value.split('')
          newValue[index] = ''
          onChange(newValue.join(''))
        } else if (index > 0) {
          // Move to previous input and clear it
          const newValue = value.split('')
          newValue[index - 1] = ''
          onChange(newValue.join(''))
          focusPrevInput(index)
        }
      } else if (key === 'ArrowLeft') {
        event.preventDefault()
        focusPrevInput(index)
      } else if (key === 'ArrowRight') {
        event.preventDefault()
        focusNextInput(index)
      } else if (key === 'Delete') {
        event.preventDefault()
        const newValue = value.split('')
        newValue[index] = ''
        onChange(newValue.join(''))
      } else if (/^[0-9]$/.test(key)) {
        // Handle direct digit input
        event.preventDefault()
        handleChange(index, key)
      }
    }

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      const pasteData = event.clipboardData.getData('text')
      const digits = pasteData.replace(/\D/g, '').slice(0, length)
      onChange(digits)

      // Focus the next empty input or the last input
      const nextFocusIndex = Math.min(digits.length, length - 1)
      setTimeout(() => focusInput(nextFocusIndex), 0)
    }

    const handleFocus = (index: number) => {
      // Select all text when focusing
      inputRefs.current[index]?.select()
    }

    return (
      <div className={`flex space-x-3 ${className}`}>
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type='text'
            inputMode='numeric'
            pattern='[0-9]*'
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            disabled={disabled}
            className={`
              w-12 h-12 text-center text-lg font-semibold
              border-2 rounded-lg
              focus:outline-none transition-colors duration-200
              ${
                error
                  ? 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400'
                  : 'focus:ring-2 focus:ring-primary focus:border-primary dark:focus:ring-primaryDark dark:focus:border-primaryDark'
              }
              ${
                !error && value[index]
                  ? 'border-primary dark:border-primaryDark bg-primary/5 dark:bg-primaryDark/5'
                  : !error && !value[index]
                  ? 'border-gray-300 dark:border-gray-600'
                  : ''
              }
              ${
                error && value[index]
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : error && !value[index]
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : ''
              }
              ${
                disabled
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>
    )
  },
)

OTPInput.displayName = 'OTPInput'
