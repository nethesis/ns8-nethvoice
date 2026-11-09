// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { MonitorQueueCard } from './MonitorQueueCard'

export interface MonitorCard {
  id: number
  queue: any
}

export interface MonitorTablesProps {
  isFullscreen: boolean
  selectedRow: number
  cards: MonitorCard[]
  onQueueChange: (cardId: number, queue: any) => void
  onAdd: () => void
  onRemove: (cardId: number) => void
}

export const MonitorTables: FC<MonitorTablesProps> = ({
  isFullscreen,
  selectedRow,
  cards,
  onQueueChange,
  onAdd,
  onRemove,
}): JSX.Element => {
  const isSingleCard = cards.length === 1

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'>
      {cards.map((card, index) => (
        <div
          key={card.id}
          className={`flex flex-col ${!isFullscreen ? 'pt-8' : 'pt-1'} ${isSingleCard ? 'col-span-2' : 'col-span-1'}`}
        >
          <MonitorQueueCard
            queue={card.queue}
            rowCount={selectedRow}
            isFullscreen={isFullscreen}
            onQueueChange={(queue) => onQueueChange(card.id, queue)}
            onAdd={index === cards.length - 1 ? onAdd : undefined}
            onRemove={index === 0 ? undefined : () => onRemove(card.id)}
          />
        </div>
      ))}
    </div>
  )
}

MonitorTables.displayName = 'MonitorTables'
