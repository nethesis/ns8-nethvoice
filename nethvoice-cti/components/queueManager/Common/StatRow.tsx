// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode } from 'react'

export const StatRow: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <div className='flex py-2 px-3'>
    <div className='w-1/2 flex justify-start text-gray-500 dark:text-gray-400'>{label}</div>
    <div className='w-1/2 flex justify-end mr-4'>{value || '-'}</div>
  </div>
)
