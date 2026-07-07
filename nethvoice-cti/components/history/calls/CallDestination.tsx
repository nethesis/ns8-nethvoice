import { FC } from 'react'
import { t } from 'i18next'
import { getEffectiveCnam } from '../../../lib/history'

interface CallDestinationProps {
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

export const CallDestination: FC<CallDestinationProps> = ({
  call,
  callType,
  operators,
  mainextension,
  name,
  openDrawerHistory,
}) => {
  // User call type
  if (callType === 'user') {
    const effectiveDstCnam = getEffectiveCnam(call.dst_cnam, call.dst)
    // Resolve internal extensions via the operators directory when the CDR row
    // carried no name (e.g. synthetic transfer-consultation rows have none).
    let resolvedDstCnam = effectiveDstCnam
    if (resolvedDstCnam === '' && call.dst !== '' && call.dst !== mainextension) {
      const op: any = Object.values(operators || {}).find((o: any) =>
        o?.endpoints?.extension?.find((d: any) => d.id === call.dst),
      )
      if (op?.name) resolvedDstCnam = op.name
    }

    const primaryLabel =
      resolvedDstCnam !== '' && call.dst !== mainextension && resolvedDstCnam !== name
        ? resolvedDstCnam
        : call.dst_ccompany !== ''
        ? call.dst_ccompany
        : call.dst !== mainextension
        ? t('Common.Unknown')
        : t('History.You')

    return (
      <div
        onClick={() =>
          openDrawerHistory(resolvedDstCnam, call.dst_ccompany, call.dst, callType, operators)
        }
      >
        <div
          className={
            'truncate text-secondaryNeutral dark:text-secondaryNeutralDark text-sm' +
            (call.dst !== '' ? ' hover:underline cursor-pointer' : '')
          }
        >
          {primaryLabel}
        </div>
        {call.dst !== '' && call.dst !== mainextension && (
          <div className='truncate text-sm cursor-pointer hover:underline text-textPlaceholder dark:text-textPlaceholderDark'>
            {call.dst}
          </div>
        )}
      </div>
    )
  } else {
    // Check if a user does not have a name and add the name of the operator
    const effectiveDstCnam = getEffectiveCnam(call.dst_cnam, call.dst)
    if (effectiveDstCnam === '') {
      let foundOperator: any = Object.values(operators || {}).find((operator: any) =>
        operator?.endpoints?.extension?.find((device: any) => device.id === call.dst),
      )

      if (foundOperator) {
        call.dst_cnam = foundOperator.name
      }
    }

    // Switchboard call type. Show the resolved name/company; for an unresolved
    // EXTERNAL number show "Unknown" (with the number underneath), as the personal
    // view does. Internal/service numbers with no name show the number itself
    // instead of "Unknown".
    const dstNumber = call.dst != null ? call.dst : ''
    const isExternalNum = (n: string) => (n || '').replace(/\D/g, '').length > 5
    const switchboardLabel =
      call.dst_cnam !== ''
        ? call.dst_cnam
        : call.dst_ccompany !== ''
        ? call.dst_ccompany
        : dstNumber !== ''
        ? isExternalNum(dstNumber)
          ? t('Common.Unknown')
          : dstNumber
        : '-'

    return (
      <div
        onClick={() =>
          openDrawerHistory(call.dst_cnam, call.dst_ccompany, call.dst, callType, operators)
        }
      >
        <div className='truncate text-sm cursor-pointer hover:underline text-secondaryNeutral dark:text-secondaryNeutralDark'>
          {switchboardLabel}
        </div>
        {dstNumber !== '' && switchboardLabel !== dstNumber && (
          <div className='truncate text-sm cursor-pointer hover:underline text-textPlaceholder dark:text-textPlaceholderDark'>
            {dstNumber}
          </div>
        )}
      </div>
    )
  }
}
