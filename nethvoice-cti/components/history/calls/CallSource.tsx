import { FC } from 'react'
import { t } from 'i18next'
import { getEffectiveCnam } from '../../../lib/history'

interface CallSourceProps {
  call: any
  callType: string
  operators: any
  mainextension: string
  name: string
  openDrawerHistory: (
    name: string,
    company: string,
    number: string,
    callType: string,
    operators: any,
  ) => void
}

export const CallSource: FC<CallSourceProps> = ({
  call,
  callType,
  operators,
  mainextension,
  name,
  openDrawerHistory,
}) => {
  const isIncoming = call.direction === 'in'
  // For outgoing calls cnum is the user's own extension ("You").
  // For incoming calls src is the actual calling party; cnum may be the transfer
  // initiator (Asterisk preserves it across attended transfers), not the real caller.
  const sourceNumber = isIncoming ? (call.src || call.cnum || '') : (call.cnum || call.src || '')
  // When incoming with a transfer in play (src ≠ cnum), cnam was set from cnum
  // (the transfer initiator) and would show the wrong person's name.
  const effectiveCnam =
    isIncoming && call.src && call.cnum && call.src !== call.cnum
      ? ''
      : getEffectiveCnam(call.cnam, sourceNumber)

  // User call type
  if (callType === 'user') {
    // Resolve internal extensions via the operators directory when the CDR row
    // carried no name (e.g. synthetic transfer-consultation rows have none).
    let resolvedCnam = effectiveCnam
    if (resolvedCnam === '' && sourceNumber !== '' && sourceNumber !== mainextension) {
      const op: any = Object.values(operators || {}).find((o: any) =>
        o?.endpoints?.extension?.find((d: any) => d.id === sourceNumber),
      )
      if (op?.name) resolvedCnam = op.name
    }

    const primaryLabel =
      resolvedCnam !== '' && sourceNumber !== mainextension && resolvedCnam !== name
        ? resolvedCnam
        : call.ccompany !== ''
        ? call.ccompany
        : sourceNumber !== mainextension
        ? t('Common.Unknown')
        : t('History.You')

    return (
      <div
        onClick={() => {
          openDrawerHistory(resolvedCnam, call.ccompany, sourceNumber, callType, operators)
        }}
      >
        <div
          className={
            'truncate text-sm text-secondaryNeutral dark:text-secondaryNeutralDark' +
            (sourceNumber !== '' ? ' text-sm cursor-pointer hover:underline' : '')
          }
        >
          {primaryLabel}
        </div>
        {sourceNumber !== '' && sourceNumber !== mainextension && (
          <div className='truncate text-sm cursor-pointer hover:underline text-textPlaceholder dark:text-textPlaceholderDark'>
            {sourceNumber}
          </div>
        )}
      </div>
    )
  } else {
    // Check if a user does not have a name and add the name of the operator
    if (effectiveCnam === '') {
      let foundOperator: any = Object.values(operators || {}).find((operator: any) =>
        operator?.endpoints?.extension?.find(
          (device: any) => device.id === call.cnum || device.id === call.src,
        ),
      )

      if (foundOperator) {
        call.cnam = foundOperator.name
      }
    }

    // Switchboard call type. Show the resolved name/company; for an unresolved
    // EXTERNAL number show "Unknown" (with the number underneath), as the personal
    // view does. Internal/service numbers with no name show the number itself
    // instead of "Unknown".
    const isExternalNum = (n: string) => (n || '').replace(/\D/g, '').length > 5
    const switchboardLabel =
      call.cnam !== ''
        ? call.cnam
        : call.ccompany !== ''
        ? call.ccompany
        : sourceNumber !== ''
        ? isExternalNum(sourceNumber)
          ? t('Common.Unknown')
          : sourceNumber
        : '-'

    return (
      <div
        onClick={() => {
          openDrawerHistory(call.cnam, call.ccompany, sourceNumber, callType, operators)
        }}
      >
        <div className='truncate text-sm cursor-pointer hover:underline text-secondaryNeutral dark:text-secondaryNeutralDark'>
          {switchboardLabel}
        </div>
        {sourceNumber !== '' && switchboardLabel !== sourceNumber && (
          <div className='truncate text-sm cursor-pointer hover:underline text-textPlaceholder dark:text-textPlaceholderDark'>
            {sourceNumber}
          </div>
        )}
      </div>
    )
  }
}
