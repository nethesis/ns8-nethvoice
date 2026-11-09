import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import {
  getAnsweredIconColorClass,
  isCallAnswered,
  isAnsweredElsewhereDisposition,
  getNormalizedDisposition,
} from '../../../lib/history'
import { RootState } from '../../../store'
import { CustomThemedTooltip } from '../../common/CustomThemedTooltip'

interface CallStatusProps {
  call: any
  callType: string
}

// The outcome column shows ONE word — answered or missed — with an icon that also
// carries the direction: pointing DOWN for an incoming (or internal) call, UP for an
// outgoing one, green when answered and red when missed. The full wording this
// column used to spell out ("Incoming answered", "Internal missed", …) moves into
// the icon's tooltip, so no information is lost.
export const CallStatus: FC<CallStatusProps> = ({ call, callType }) => {
  const { operators } = useSelector((state: RootState) => state.operators)
  const { profile } = useSelector((state: RootState) => state.user)
  const isAnswered = isCallAnswered(call)
  // A call answered by someone else is still an answered call: it keeps the single
  // word and the direction arrow, and says who took it in the tooltip (and through
  // the icon colour), instead of spelling a second outcome into the column.
  const isAnsweredElsewhere = isAnsweredElsewhereDisposition(getNormalizedDisposition(call))

  const getAnsweredByLabel = () => {
    const answeredByNum = call?.answered_by_num

    if (!answeredByNum) {
      return ''
    }

    const operator = Object.values(operators || {}).find((candidate: any) =>
      candidate?.endpoints?.extension?.some((extension: any) => extension?.id === answeredByNum),
    ) as any

    return operator?.name ? `${operator.name} (${answeredByNum})` : answeredByNum
  }

  // Naming who answered is the switchboard's detail, so it follows the same
  // permissions the rest of that view does.
  const canShowAnsweredBy =
    callType === 'switchboard'
      ? !!profile?.macro_permissions?.cdr?.permissions?.ad_cdr?.value
      : callType === 'group' || callType === 'groups'
      ? !!profile?.macro_permissions?.cdr?.permissions?.group_cdr?.value
      : !!profile?.macro_permissions?.cdr?.value

  const answeredByLabel = getAnsweredByLabel()

  // Direction as the backend reports it: the switchboard view classifies a call by
  // trunk presence ("in" | "out" | "internal"), the personal view by the user's own
  // extension ("in" | "out").
  const isInternal = callType !== 'user' && call?.type === 'internal'
  const isOutgoing = !isInternal && (callType === 'user' ? call?.direction : call?.type) === 'out'
  // The column shows one word; the tooltip keeps the full wording it replaced.
  const directionKey = isInternal ? 'Internal' : isOutgoing ? 'Outgoing' : 'Incoming'
  const directionLabel = t(`History.${directionKey} ${isAnswered ? 'answered' : 'missed'}`)
  const tooltipLabel = !isAnsweredElsewhere
    ? directionLabel
    : canShowAnsweredBy && answeredByLabel
    ? `${directionLabel} — ${t('History.Answered by')} ${answeredByLabel}`
    : `${directionLabel} — ${t('History.Answered by another operator')}`

  // Missed incoming keeps the dedicated "missed call" icon, which already points
  // down-left; missed outgoing has no such icon, so it reuses the arrow in red.
  const icon: IconDefinition = isAnswered || isOutgoing ? faArrowLeft : (faMissed as IconDefinition)
  const rotation = isOutgoing ? 'rotate-[135deg]' : isAnswered ? '-rotate-45' : ''
  const colorClass = isAnswered
    ? getAnsweredIconColorClass(call.disposition)
    : 'text-textStatusBusy dark:text-textStatusBusyDark'

  const tooltipId = `tooltip-outcome-${call?.uniqueid}${
    call?.isInteractionRow ? `-int-${call?._interactionIndex}` : ''
  }`

  return (
    <div className='mt-1 text-sm'>
      <div className='flex flex-nowrap items-center'>
        <FontAwesomeIcon
          icon={icon}
          className={`mr-2 h-4 w-4 flex-shrink-0 ${rotation} ${colorClass}`}
          data-tooltip-id={tooltipId}
          data-tooltip-content={tooltipLabel}
          role='img'
          aria-label={tooltipLabel}
        />
        <span
          className={
            'text-secondaryNeutral dark:text-secondaryNeutralDark' +
            (isAnsweredElsewhere ? ' cursor-help underline underline-offset-2' : '')
          }
          data-tooltip-id={isAnsweredElsewhere ? tooltipId : undefined}
          data-tooltip-content={isAnsweredElsewhere ? tooltipLabel : undefined}
        >
          {isAnswered ? t('History.Outcome answered') : t('History.Outcome missed')}
        </span>
        <CustomThemedTooltip id={tooltipId} place='top' />
      </div>
    </div>
  )
}
