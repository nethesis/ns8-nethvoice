// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The SpeedDial component
 *
 * @return The fixed right bar with speed dials as the default
 */

import { SpeedDialContent } from '../common/UserRightSideMenu/SpeedDialContent'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

export const SpeedDial = () => {
  const rightSideStatus: any = useSelector((state: RootState) => state.rightSideMenu)

  return (
    <>
      <aside
        className={`relative z-20 hidden ${
          rightSideStatus?.isShown ? 'lg:w-72 xl:w-80 2xl:w-96' : ''
        } border-l lg:block h-full border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900`}
      >
        {rightSideStatus?.isShown && <SpeedDialContent />}
      </aside>
    </>
  )
}
