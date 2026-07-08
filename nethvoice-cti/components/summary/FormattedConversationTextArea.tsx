// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ChangeEvent, ComponentProps, FC, UIEvent, useRef } from 'react'
import classNames from 'classnames'
import { customScrollbarClass } from '../../lib/utils'

type FormattedContentType = 'transcript' | 'summary'

interface FormattedConversationTextAreaProps
  extends Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'className'> {
  content: string
  className?: string
  textareaClassName?: string
  rows?: number
  contentType?: FormattedContentType
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
}

interface TranscriptLine {
  speaker?: string
  text: string
  isEmpty?: boolean
}

const parseTranscriptLines = (content: string): TranscriptLine[] => {
  return content.split('\n').map((line) => {
    if (!line) {
      return { text: '', isEmpty: true }
    }

    if (/^[^\n]+:$/.test(line)) {
      return {
        speaker: line,
        text: '',
      }
    }

    return {
      text: line,
    }
  })
}

export const FormattedConversationTextArea: FC<FormattedConversationTextAreaProps> = ({
  content,
  className,
  textareaClassName,
  rows = 8,
  contentType = 'transcript',
  onChange,
  readOnly = true,
  ...props
}) => {
  const overlayContentRef = useRef<HTMLDivElement>(null)
  const shouldHighlightTranscript = readOnly && contentType === 'transcript'
  const transcriptLines = shouldHighlightTranscript ? parseTranscriptLines(content) : []

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!overlayContentRef.current) {
      return
    }

    overlayContentRef.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`
  }

  return (
    <div className={classNames('relative w-full', className)}>
      {shouldHighlightTranscript && (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-gray-200 bg-elevationL1 dark:border-gray-600 dark:bg-elevationL1Dark'
        >
          <div
            ref={overlayContentRef}
            className='px-3 py-2 text-sm leading-5'
            style={{ willChange: 'transform' }}
          >
            {transcriptLines.map((line, index) => (
              <div key={`${line.speaker || 'line'}-${index}`} className='whitespace-pre-wrap break-words'>
                {line.isEmpty ? '\u00A0' : null}
                {line.speaker && (
                  <span className='font-medium text-primaryNeutral dark:text-primaryNeutralDark'>
                    {line.speaker}
                  </span>
                )}
                {!line.speaker && (
                  <span className='text-tertiaryNeutral dark:text-tertiaryNeutralDark'>{line.text}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <textarea
        readOnly={readOnly}
        value={content}
        rows={rows}
        onChange={onChange}
        onScroll={handleScroll}
        {...props}
        className={classNames(
          'relative block w-full resize-y rounded-md border px-3 py-2',
          shouldHighlightTranscript
            ? 'z-10 border-transparent bg-transparent'
            : readOnly
              ? 'border-gray-200 bg-elevationL1 dark:border-gray-600 dark:bg-elevationL1Dark'
              : 'border-gray-300 bg-surfaceBackgroundInput dark:border-gray-600 dark:bg-surfaceBackgroundInputDark',
          shouldHighlightTranscript
            ? 'text-sm leading-5 text-transparent shadow-none'
            : 'text-sm leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark shadow-none',
          readOnly ? 'caret-transparent' : 'caret-primary dark:caret-primaryDark',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500',
          'focus:border-primaryLight focus:ring-primaryLight dark:focus:border-primaryDark dark:focus:ring-primaryDark',
          customScrollbarClass,
          textareaClassName,
        )}
        spellCheck={false}
      />
    </div>
  )
}
