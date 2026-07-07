import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faXmark, faBuilding } from '@fortawesome/free-solid-svg-icons'
import { faMissed } from '@nethesis/nethesis-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { t } from 'i18next'
import { isCallAnswered } from '../../../lib/history'

interface CallStatusProps {
  call: any
  callType: string
}

export const CallStatus: FC<CallStatusProps> = ({ call, callType }) => {
  const isAnswered = isCallAnswered(call)

  if (callType === 'user') {
    return (
      <div className='mt-1 text-sm'>
        <div>
          {call.direction === 'in' ? (
            <div>
              {isAnswered ? (
                <div className='flex flex-nowrap items-center'>
                  <FontAwesomeIcon
                    icon={faArrowLeft}
                    className='mr-2 h-4 w-4 -rotate-45 text-textStatusOnline dark:text-textStatusOnlineDark z-0'
                    aria-hidden='true'
                  />
                  <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('History.Incoming answered')}
                  </span>
                </div>
              ) : (
                <div className='flex flex-nowrap items-center'>
                  <FontAwesomeIcon
                    icon={faMissed as IconDefinition}
                    className='mr-2 h-4 w-4 text-textStatusBusy dark:text-textStatusBusyDark'
                    aria-hidden='true'
                  />
                  <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('History.Incoming missed')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              {isAnswered ? (
                <div className='flex flex-nowrap items-center'>
                  <FontAwesomeIcon
                    icon={faArrowLeft}
                    className='mr-2 h-4 w-4 rotate-[135deg] text-textStatusOnline dark:text-textStatusOnlineDark z-0'
                    aria-hidden='true'
                  />
                  <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('History.Outgoing answered')}
                  </span>
                </div>
              ) : (
                <div className='flex flex-nowrap items-center'>
                  <FontAwesomeIcon
                    icon={faXmark}
                    className='mr-2 h-4 w-4 text-textStatusBusy dark:text-textStatusBusyDark'
                    aria-hidden='true'
                  />
                  <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('History.Outgoing missed')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  } else {
    // Switchboard call type
    return (
      <div className='mt-1 text-sm'>
        <div>
          {call.type === 'internal' ? (
            <div>
              {isAnswered ? (
                <div className='flex flex-nowrap items-center'>
                  <FontAwesomeIcon
                    icon={faBuilding}
                    className='mr-2 h-4 w-4 flex-shrink-0 text-textStatusOnline dark:text-textStatusOnlineDark'
                    aria-hidden='true'
                  />
                  <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('History.Internal answered')}
                  </span>
                </div>
              ) : (
                <div className='flex flex-nowrap items-center'>
                  <FontAwesomeIcon
                    icon={faBuilding}
                    className='mr-2 h-4 w-4 flex-shrink-0 text-textStatusBusy dark:text-textStatusBusyDark'
                    aria-hidden='true'
                  />
                  <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                    {t('History.Internal missed')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              {call.type === 'in' ? (
                <div>
                  {isAnswered ? (
                    <div className='flex flex-nowrap items-center'>
                      <FontAwesomeIcon
                        icon={faArrowLeft}
                        className='mr-2 h-4 w-4 -rotate-45 text-textStatusOnline dark:text-textStatusOnlineDark z-0'
                        aria-hidden='true'
                      />
                      <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                        {t('History.Incoming answered')}
                      </span>
                    </div>
                  ) : (
                    <div className='flex flex-nowrap items-center'>
                      <FontAwesomeIcon
                        icon={faMissed as IconDefinition}
                        className='mr-2 h-4 w-4 text-textStatusBusy dark:text-textStatusBusyDark'
                        aria-hidden='true'
                      />
                      <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                        {t('History.Incoming missed')}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {isAnswered ? (
                    <div className='flex flex-nowrap items-center'>
                      <FontAwesomeIcon
                        icon={faArrowLeft}
                        className='mr-2 h-4 w-4 rotate-[135deg] text-textStatusOnline dark:text-textStatusOnlineDark z-0'
                        aria-hidden='true'
                      />
                      <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                        {t('History.Outgoing answered')}
                      </span>
                    </div>
                  ) : (
                    <div className='flex flex-nowrap items-center'>
                      <FontAwesomeIcon
                        icon={faXmark}
                        className='mr-2 h-4 w-4 text-textStatusBusy dark:text-textStatusBusyDark'
                        aria-hidden='true'
                      />
                      <span className='text-secondaryNeutral dark:text-secondaryNeutralDark'>
                        {t('History.Outgoing missed')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
