// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import classNames from 'classnames'
import { closeSideDrawer } from '../../lib/utils'
import { t } from 'i18next'
import { DrawerHeader } from '../common/DrawerHeader'
import { SummaryView } from './SummaryView'
import { TranscriptionView } from './TranscriptionView'

export interface CallSummaryDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const CallSummaryDrawerContent = forwardRef<
  HTMLButtonElement,
  CallSummaryDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const isSummary = config?.isSummary || false
  const uniqueid: string | undefined = config?.uniqueid
  const linkedid: string | undefined = config?.linkedid
  // Optional transcript row id: disambiguates conversations sharing a uniqueid
  // (consultation vs post-transfer legs of an attended transfer).
  const transcriptId: number | undefined = config?.id
  // Switchboard (supervisor) scope: the viewer may not be a call participant,
  // so the API must be told to authorize by capability instead of membership.
  const switchboard: boolean = config?.switchboard || false

  const drawerTitle = isSummary
    ? t('Summary.Call summary') || 'Call summary'
    : t('Summary.Call transcription') || 'Call transcription'

  return (
    <>
      <DrawerHeader title={drawerTitle} onClose={closeSideDrawer} />
      <div className={classNames(className, 'px-5')} {...props}>
        {isSummary && uniqueid ? (
          <SummaryView
            uniqueid={uniqueid}
            linkedid={linkedid}
            transcriptId={transcriptId}
            switchboard={switchboard}
          />
        ) : uniqueid ? (
          <TranscriptionView
            uniqueid={uniqueid}
            linkedid={linkedid}
            transcriptId={transcriptId}
            switchboard={switchboard}
          />
        ) : null}
      </div>
    </>
  )
})

CallSummaryDrawerContent.displayName = 'CallSummaryDrawerContent'
