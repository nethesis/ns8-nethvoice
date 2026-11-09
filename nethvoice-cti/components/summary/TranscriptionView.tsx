// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useState, useCallback, useEffect } from 'react'
import { TextArea, Button, Label, InlineNotification } from '../common'
import { Skeleton } from '../common/Skeleton'
import { t } from 'i18next'
import { Divider } from '../common/Divider'
import { getTranscription } from '../../services/user'
import { closeSideDrawer } from '../../lib/utils'
import { CallInformationSection, SummaryCallInfo } from './CallInformationSection'
import { FormattedConversationTextArea } from './FormattedConversationTextArea'

const formatTranscriptText = (value: string) =>
  value
    .split('\n')
    .reduce<string[]>((lines, line) => {
      const trimmedLine = line.trim()

      if (!trimmedLine) {
        return lines
      }

      const match = trimmedLine.match(/^([^:\n]{1,120}:)\s*(.*)$/)

      if (!match) {
        lines.push(trimmedLine)
        return lines
      }

      lines.push(match[1])
      if (match[2]) {
        lines.push(match[2])
      }
      lines.push('')

      return lines
    }, [])
    .join('\n')
    .replace(/\n+$/, '')

interface TranscriptionViewProps {
  uniqueid: string
  linkedid?: string
  transcriptId?: number
  // Switchboard (supervisor) scope: authorize by capability, not participation.
  switchboard?: boolean
}

export const TranscriptionView: FC<TranscriptionViewProps> = ({
  uniqueid,
  linkedid,
  transcriptId,
  switchboard,
}) => {
  const [transcription, setTranscription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [callInfo, setCallInfo] = useState<SummaryCallInfo>({})

  const applyTranscriptionData = useCallback((data: any) => {
    const transcriptionText = data?.transcription || data?.Transcription || ''

    setCallInfo({
      src: data?.src,
      dst: data?.dst,
      cnam: data?.cnam,
      dst_cnam: data?.dst_cnam,
      call_timestamp: data?.call_timestamp,
    })

    if (!transcriptionText) {
      setTranscription('')
      setError(t('Summary.Transcription unavailable') || '')
      return false
    }

    setTranscription(formatTranscriptText(transcriptionText))
    return true
  }, [])

  const loadTranscription = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await getTranscription(uniqueid, linkedid, transcriptId, switchboard)
      if (response && response.data) {
        const data = response.data?.data || response.data
        if (!applyTranscriptionData(data)) {
          return
        }
      } else {
        setTranscription('')
        setError(t('Summary.Transcription unavailable') || '')
      }
    } catch (err: any) {
      setTranscription('')
      setError(t('Summary.Transcription load failed') || '')
    } finally {
      setIsLoading(false)
    }
  }, [applyTranscriptionData, linkedid, uniqueid, transcriptId, switchboard])

  useEffect(() => {
    if (uniqueid) {
      loadTranscription()
    }
  }, [uniqueid, linkedid, loadTranscription])

  return (
    <>
      <Divider />
      <div className='mb-6 flex flex-col'>
        <CallInformationSection callInfo={callInfo} isLoading={isLoading} />

        {/* Transcription Disclaimer */}
        <InlineNotification
          className='mt-6'
          type='info'
          title={t('Summary.Transcription disclaimer title')}
        >
          <p className=''>{t('Summary.Transcription disclaimer')}</p>
        </InlineNotification>

        {/* Transcription */}
        <Label className='mt-8'>
          {t('Summary.Call transcription')}
        </Label>
        {isLoading ? (
          <Skeleton height='400px' />
        ) : error ? (
          <TextArea
            placeholder={t('Summary.Transcription unavailable') || ''}
            value=''
            onChange={() => undefined}
            rows={8}
            readOnly
          />
        ) : (
          <FormattedConversationTextArea content={transcription} rows={8} />
        )}
      </div>
      <Divider paddingY='pb-10 pt-6' />
      <div className='flex justify-end'>
        <Button variant='primary' onClick={closeSideDrawer}>
          {t('Common.Close')}
        </Button>
      </div>
    </>
  )
}
