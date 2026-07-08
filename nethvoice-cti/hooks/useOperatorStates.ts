import { useMemo, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { isEmpty } from 'lodash'
import { callOperator, openShowOperatorDrawer, pickup, hangupMainExt } from '../lib/operators'
import { transferCall } from '../lib/utils'

export const useOperatorStates = (operator: any, authUsername: string) => {
  const profile = useSelector((state: RootState) => state.user)

  const pickupPermission = useSelector(
    (state: RootState) =>
      state.user?.profile?.macro_permissions?.settings?.permissions?.pickup?.value,
  )
  const hangupPermission = useSelector(
    (state: RootState) =>
      state.user?.profile?.macro_permissions?.presence_panel?.permissions?.hangup?.value,
  )

  const permissions = useMemo(
    () => ({
      pickup: pickupPermission,
      hangup: hangupPermission,
      hasAny: pickupPermission || hangupPermission,
    }),
    [pickupPermission, hangupPermission],
  )

  const operatorStates = useMemo(() => {
    const hasValidConversation =
      operator?.conversations?.length > 0 &&
      operator?.conversations?.[0]?.startTime &&
      operator?.conversations?.[0]?.id

    const isInConversation =
      hasValidConversation &&
      (operator?.conversations?.[0]?.connected ||
        operator?.conversations?.[0]?.inConference ||
        operator?.conversations?.[0]?.chDest?.inConference === true)

    const isRinging = operator?.mainPresence === 'ringing'
    const isBusy = operator?.mainPresence === 'busy'
    const isOfflineOrDnd = operator?.mainPresence === 'offline' || operator?.mainPresence === 'dnd'
    const isOnline = operator?.mainPresence === 'online'

    const hasAnyPermission = permissions?.pickup || permissions?.hangup

    const allUserExtensions = [
      profile?.mainextension,
      profile?.username,
      authUsername,
      ...(profile?.endpoints?.extension?.map((ext: any) => ext?.id) || []),
      ...(profile?.endpoints?.mainextension?.map((ext: any) => ext?.id) || []),
    ].filter(Boolean)

    const isCalledByCurrentUser =
      isRinging &&
      operator?.conversations?.length > 0 &&
      (allUserExtensions.includes(operator?.conversations?.[0]?.counterpartNum) ||
        allUserExtensions.includes(operator?.conversations?.[0]?.caller) ||
        allUserExtensions.includes(operator?.conversations?.[0]?.bridgedNum) ||
        allUserExtensions.includes(operator?.conversations?.[0]?.chSource?.callerNum) ||
        allUserExtensions.includes(operator?.conversations?.[0]?.chSource?.bridgedNum) ||
        (operator?.conversations?.[0]?.direction === 'out' &&
          operator?.conversations?.[0]?.counterpartName?.includes(profile?.name)))

    return {
      isInConversation,
      isRinging,
      isBusy,
      isOfflineOrDnd,
      isOnline,
      hasValidConversation,
      hasAnyPermission,
      isCalledByCurrentUser,
    }
  }, [operator, authUsername, profile, permissions])

  const handleOpenDrawer = useCallback(() => {
    openShowOperatorDrawer(operator)
  }, [operator])

  const handleTransferCall = useCallback(() => {
    transferCall(operator)
  }, [operator])

  const handleCallOperator = useCallback(() => {
    callOperator(operator)
  }, [operator])

  const handlePickupCall = useCallback(async () => {
    if (
      operator?.conversations?.[0]?.id &&
      profile?.default_device?.id &&
      operator?.endpoints?.mainextension?.[0]?.id
    ) {
      const conversationId = operator?.conversations?.[0]?.id
      const endpoint = operator?.endpoints?.mainextension?.[0]?.id
      const destination = profile?.default_device?.id

      const pickupInformations = {
        convid: conversationId,
        endpointId: endpoint,
        destId: destination,
      }

      if (!isEmpty(pickupInformations)) {
        try {
          await pickup(pickupInformations)
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [operator, profile])

  const handleRejectCall = useCallback(
    async (userMainExtension: any) => {
      if (operator?.conversations?.[0]?.id && operator?.conversations?.[0]?.owner) {
        if (userMainExtension) {
          const hangupInformations = {
            exten: userMainExtension?.toString(),
          }

          if (!isEmpty(hangupInformations)) {
            try {
              await hangupMainExt(hangupInformations)
            } catch (e) {
              console.error(e)
            }
          }
        }
      }
    },
    [operator],
  )

  return {
    permissions,
    operatorStates,
    handlers: {
      handleOpenDrawer,
      handleTransferCall,
      handleCallOperator,
      handlePickupCall,
      handleRejectCall,
    },
    profile,
  }
}
