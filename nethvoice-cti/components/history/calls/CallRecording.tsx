import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCirclePlay, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { Button, Dropdown } from '../../common'
import { CustomThemedTooltip } from '../../common/CustomThemedTooltip'

interface CallRecordingProps {
  call: any
  playSelectedAudioFile: (callId: string) => void
  getRecordingActions: (callId: string) => JSX.Element
  getCallActions?: (call: any) => JSX.Element
  summaryStatus?: any
}

export const CallRecording: FC<CallRecordingProps> = ({
  call,
  playSelectedAudioFile,
  getRecordingActions,
  getCallActions,
  summaryStatus,
}) => {
  const hasRecording = call?.recordingfile
  const hasSummaryOrTranscription =
    summaryStatus?.state === 'done' &&
    (summaryStatus?.has_summary || summaryStatus?.has_transcription)
  const showDropdown = hasRecording || hasSummaryOrTranscription
  const playTooltipId = `tooltip-play-recording-${call?.uniqueid}`

  return showDropdown ? (
    <div className='flex justify-end space-x-1 items-center'>
      {hasRecording && (
        <>
          <Button
            variant='ghost'
            iconOnly
            onClick={() => playSelectedAudioFile(call.uniqueid)}
            data-tooltip-id={playTooltipId}
            data-tooltip-content={t('LastCalls.Play recording') || ''}
            aria-label={t('LastCalls.Play recording') || 'Play recording'}
          >
            <FontAwesomeIcon
              icon={faCirclePlay}
              className='h-4 w-4 text-primaryActive dark:text-primaryActiveDark'
              aria-hidden='true'
            />
            <span className='sr-only'>{t('LastCalls.Play recording')}</span>
          </Button>
          <CustomThemedTooltip id={playTooltipId} place='top' />
        </>
      )}
      {getCallActions ? (
        <Dropdown items={getCallActions(call)} position='leftUpTwoItems'>
          <Button variant='ghost' iconOnly>
            <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
            <span className='sr-only'>{t('History.Open recording action modal')}</span>
          </Button>
        </Dropdown>
      ) : (
        <Dropdown items={getRecordingActions(call?.uniqueid)} position='leftUpTwoItems'>
          <Button variant='ghost' iconOnly>
            <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
            <span className='sr-only'>{t('History.Open recording action modal')}</span>
          </Button>
        </Dropdown>
      )}
    </div>
  ) : (
    <div className='flex' />
  )
}
