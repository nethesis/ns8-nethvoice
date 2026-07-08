import React, { useMemo } from 'react'
import { Avatar } from '../common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faStar,
  faPhone,
  faRightLeft,
  IconDefinition,
  faRecordVinyl,
  faHandPointUp,
  faEarListen,
} from '@fortawesome/free-solid-svg-icons'
import { CallDuration } from './CallDuration'
import { Button } from '../common'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { faPhoneArrowDownLeft } from '@nethesis/nethesis-solid-svg-icons'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { useOperatorStates } from '../../hooks/useOperatorStates'
import TextScroll from '../common/TextScroll'

interface OperatorCardProps {
  operator: any
  authUsername: string
  mainUserIsBusy: boolean
  actionInformation?: any
  index: number | string
}

const OperatorCard = ({
  operator,
  authUsername,
  mainUserIsBusy,
  actionInformation,
  index,
}: OperatorCardProps) => {
  const liveOperatorData = useSelector(
    (state: RootState) => state.operators.operators[operator?.username] || operator,
  )

  const {
    permissions,
    operatorStates,
    handlers: {
      handleOpenDrawer,
      handleTransferCall,
      handleCallOperator,
      handlePickupCall,
      handleRejectCall,
    },
  } = useOperatorStates(liveOperatorData, authUsername)

  const {
    isInConversation,
    isRinging,
    isBusy,
    isOfflineOrDnd,
    hasAnyPermission,
    isCalledByCurrentUser,
  } = operatorStates

  const mainExtension = useMemo(() => operator?.endpoints?.mainextension?.[0]?.id || '', [operator])
  const operatorsStore = useSelector((state: RootState) => state.operators)
  let currentUserIsInConversation =
    operatorsStore?.operators[authUsername]?.mainPresence != 'online'

  return (
    <div className='space-y-2 w-[200px]'>
      {/* Operator avatar */}
      <Avatar
        src={liveOperatorData?.avatarBase64}
        placeholderType='operator'
        size='extra_large'
        bordered
        onClick={handleOpenDrawer}
        className='mx-auto cursor-pointer'
        status={liveOperatorData?.mainPresence}
        star={liveOperatorData?.favorite}
        isRinging={isRinging}
      />

      <div className='space-y-1'>
        <div className='text-xs font-medium lg:text-sm'>
          <h3
            className='cursor-pointer hover:underline text-center text-sm not-italic font-medium leading-5 text-gray-900 dark:text-gray-100 truncate mx-[6px]'
            onClick={handleOpenDrawer}
            title={liveOperatorData?.name}
          >
            {liveOperatorData?.name}
          </h3>
        </div>

        {/* Main extension or Ringing (if user has at least one permission) */}
        <div className='text-center text-secondaryNeutral dark:text-secondaryNeutralDark text-sm font-normal leading-5'>
          {mainExtension}
        </div>
      </div>

      <div className='min-h-9'>
        <span className='block mt-1 text-sm font-medium text-gray-500 dark:text-gray-500'>
          {/* Operator is in conversation */}
          {isInConversation && (
            <div
              className={`tooltip-operator-information-${index} py-2 px-2 flex justify-center`}
              data-tooltip-id={`tooltip-operator-information-${index}`}
              data-tooltip-content={operator?.conversations?.[0]?.counterpartName || '-'}
            >
              <div className='flex items-center text-red-600 dark:text-red-500 overflow-hidden'>
                {operator?.conversations?.[0]?.startTime && (
                  <>
                    <CallDuration
                      startTime={operator?.conversations?.[0]?.startTime}
                      className='text-sm font-medium leading-5 whitespace-nowrap'
                    />
                  </>
                )}
              </div>
              <CustomThemedTooltip id={`tooltip-textscroll-${index}`} />
            </div>
          )}

          {/* Operator is ringing - show buttons based on permissions */}
          {isRinging && (
            <>
              {hasAnyPermission && !isCalledByCurrentUser && !currentUserIsInConversation ? (
                <div className='flex justify-center space-x-2'>
                  {permissions.pickup && (
                    <Button
                      variant='white'
                      size='small'
                      onClick={handlePickupCall}
                      data-tooltip-id={`tooltip-pickup-operator-${
                        liveOperatorData?.username || 'op'
                      }`}
                      data-tooltip-content={t('OperatorDrawer.Pickup')}
                    >
                      <FontAwesomeIcon
                        icon={faPhoneArrowDownLeft as IconDefinition}
                        className='inline-block text-center h-4 w-4 lg:h-3 lg:w-3'
                      />
                    </Button>
                  )}
                  {permissions?.hangup && (
                    <Button
                      variant='whiteDanger'
                      size='small'
                      onClick={() => handleRejectCall(mainExtension)}
                      data-tooltip-id={`tooltip-reject-operator-${
                        liveOperatorData?.username || 'op'
                      }`}
                      data-tooltip-content={t('Common.Reject')}
                    >
                      <FontAwesomeIcon
                        style={{ transform: 'rotate(135deg)' }}
                        className='inline-block text-center h-4 w-4 lg:h-3 lg:w-3'
                        icon={faPhone as IconDefinition}
                      />
                    </Button>
                  )}
                  {/* Show tooltips only on small screens when text is hidden */}
                  <div className='md:hidden'>
                    <CustomThemedTooltip
                      id={`tooltip-pickup-operator-${liveOperatorData?.username || 'op'}`}
                    />
                    <CustomThemedTooltip
                      id={`tooltip-reject-operator-${liveOperatorData?.username || 'op'}`}
                    />
                  </div>
                </div>
              ) : (
                <div className='py-2 px-2 flex justify-center'>
                  <div className='flex items-center text-cardTextBusy dark:text-cardTextBusyDark overflow-hidden'>
                    {liveOperatorData?.conversations?.[0]?.counterpartName && (
                      <>
                        <div
                          data-tooltip-id={`tooltip-ringing-name-${
                            liveOperatorData?.username || 'op'
                          }`}
                          data-tooltip-content={
                            liveOperatorData?.conversations?.[0]?.counterpartName || ''
                          }
                          className='min-w-0 flex-1'
                        >
                          <TextScroll text={liveOperatorData?.conversations?.[0]?.counterpartName || ''} />
                        </div>
                      </>
                    )}
                  </div>
                  <CustomThemedTooltip
                    id={`tooltip-ringing-name-${liveOperatorData?.username || 'op'}`}
                  />
                </div>
              )}
            </>
          )}

          {/* Main user is busy and operator is online - show transfer button */}
          {mainUserIsBusy &&
            liveOperatorData?.mainPresence === 'online' &&
            !isRinging &&
            !isInConversation && (
              <Button
                variant='dashboard'
                onClick={handleTransferCall}
                className='text-primary dark:text-primaryDark dark:disabled:text-gray-700 dark:disabled:hover:text-gray-700 disabled:text-gray-400'
              >
                <FontAwesomeIcon
                  icon={faRightLeft}
                  className='inline-block text-center h-3.5 w-3.5 mr-1.5 rotate-90'
                />
                <span className='text-sm not-italic font-medium leading-5'>
                  {t('Operators.Transfer')}
                </span>
              </Button>
            )}

          {/* Operator is busy but not in conversation */}
          {isBusy && !isInConversation && (
            <div className='py-2 px-3 flex justify-center'>
              <span className='text-sm not-italic font-medium leading-5 text-cardTextBusy dark:text-cardTextBusyDark'>
                {t('Operators.Busy')}
              </span>
            </div>
          )}

          {/* Operator is not busy, not ringing, not in conversation - show call button */}
          {!isInConversation &&
            !isRinging &&
            !isBusy &&
            (!mainUserIsBusy || liveOperatorData?.mainPresence !== 'online') && (
              <Button
                variant='dashboard'
                className={
                  mainUserIsBusy
                    ? 'text-primary dark:text-primaryDark dark:disabled:text-gray-600 dark:disabled:hover:text-gray-600 disabled:text-gray-400'
                    : isOfflineOrDnd
                      ? 'text-primaryActive dark:text-primaryActiveDark dark:disabled:text-gray-600 dark:disabled:hover:text-gray-600 disabled:text-gray-400'
                      : 'text-primaryActive dark:text-primaryActiveDark'
                }
                disabled={
                  mainUserIsBusy || isOfflineOrDnd || liveOperatorData?.username === authUsername
                }
                onClick={handleCallOperator}
              >
                <FontAwesomeIcon icon={faPhone} className='inline-block text-center h-4 w-4 mr-2' />
                <span className='text-sm not-italic font-medium leading-5'>
                  {t('Operators.Call')}
                </span>
              </Button>
            )}
        </span>
      </div>

      <div
        className={`tooltip-operator-information-${index} flex justify-center min-h-[24px]`}
        data-tooltip-id={`tooltip-operator-information-${index}`}
        data-tooltip-content={
          isInConversation
            ? operator?.conversations?.[0]?.counterpartName || '-'
            : isRinging && hasAnyPermission && !isCalledByCurrentUser && !currentUserIsInConversation
              ? liveOperatorData?.conversations?.[0]?.counterpartName || ''
              : ''
        }
      >
        {isInConversation ? (
          <div className='flex items-center text-cardTextBusy dark:text-cardTextBusyDark overflow-hidden'>
            <div className='min-w-0 flex-1'>
              <div
                data-tooltip-id={`tooltip-textscroll-${index}`}
                data-tooltip-content={operator?.conversations?.[0]?.counterpartName || ''}
              >
                <TextScroll text={operator?.conversations?.[0]?.counterpartName || ''} />
              </div>
            </div>

            {/* Recording indicator */}
            {operator?.conversations?.[0]?.recording === 'true' && (
              <FontAwesomeIcon icon={faRecordVinyl} className='ml-1.5 h-4 w-4' />
            )}

            {/* Listening indicator */}
            {operator?.conversations?.[0]?.id === actionInformation?.listeningInfo?.listening_id && (
              <FontAwesomeIcon icon={faEarListen} className='ml-1.5 h-4 w-4' />
            )}

            {/* Intrude indicator */}
            {operator?.conversations?.[0]?.id === actionInformation?.intrudeInfo?.intrude_id && (
              <FontAwesomeIcon icon={faHandPointUp} className='ml-1.5 h-4 w-4' />
            )}
          </div>
        ) : (
          isRinging &&
          hasAnyPermission &&
          !isCalledByCurrentUser &&
          !currentUserIsInConversation && (
            <div className='flex items-center text-red-600 dark:text-red-500 overflow-hidden'>
              {liveOperatorData?.conversations?.[0]?.counterpartName && (
                <div className='min-w-0 flex-1'>
                  <div
                    data-tooltip-id={`tooltip-textscroll-${index}`}
                    data-tooltip-content={liveOperatorData?.conversations?.[0]?.counterpartName || ''}
                  >
                    <TextScroll text={liveOperatorData?.conversations?.[0]?.counterpartName || ''} />
                  </div>
                </div>
              )}
            </div>
          )
        )}
        <CustomThemedTooltip id={`tooltip-textscroll-${index}`} />
      </div>
    </div>
  )
}

export default React.memo(OperatorCard)

OperatorCard.displayName = 'OperatorCard'
