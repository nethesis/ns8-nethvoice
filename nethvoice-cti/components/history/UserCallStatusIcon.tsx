import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import { faArrowLeft, IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import {
  CallTypes,
  getAnsweredIconColorClass,
  getAnsweredTranslationKey,
  isCallAnswered,
} from '../../lib/history'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

interface UserCallStatusIconProps {
  call: CallTypes
  tooltipPlace?: 'top' | 'right' | 'bottom' | 'left'
}

// Same outcome language as the call history (see calls/CallStatus): the icon points
// DOWN for an incoming call and UP for an outgoing one, green when answered and red
// when missed, with the full wording in its tooltip. Here only the icon is shown,
// since the last-calls list has no room for a label.
export const UserCallStatusIcon: FC<UserCallStatusIconProps> = ({ call, tooltipPlace = 'left' }) => {
  const { t } = useTranslation()
  const isAnswered = isCallAnswered(call)
  const isOutgoing = call?.direction === 'out'

  // Missed incoming keeps the dedicated "missed call" icon, which already points
  // down-left; missed outgoing has no such icon, so it reuses the arrow in red.
  const icon: IconDefinition = isAnswered || isOutgoing ? faArrowLeft : (faMissed as IconDefinition)
  const rotation = isOutgoing ? 'rotate-[135deg]' : isAnswered ? '-rotate-45' : ''
  // A call answered elsewhere keeps its own wording and colour, so the icon alone
  // still says the call was taken — just not by this user.
  const label = t(getAnsweredTranslationKey(isOutgoing ? 'Outgoing' : 'Incoming', call.disposition)) || ''
  // Unique per call: a static id would be shared by every row of the list.
  const tooltipId = `tooltip-user-call-status-${call?.uniqueid ?? call?.linkedid}`

  return (
    <div className='mt-1 text-sm md:mt-0 flex'>
      <FontAwesomeIcon
        icon={icon}
        className={
          `mr-2 h-5 w-3.5 flex-shrink-0 ${rotation} ` +
          (isAnswered
            ? getAnsweredIconColorClass(call.disposition)
            : 'text-iconStatusBusy dark:text-iconStatusBusyDark')
        }
        data-tooltip-id={tooltipId}
        data-tooltip-content={label}
        role='img'
        aria-label={label}
      />
      <CustomThemedTooltip id={tooltipId} place={tooltipPlace} />
    </div>
  )
}
