// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { Avatar, Button, Dropdown } from '../../common'

const RANK_ROWS = 5

interface DashboardRankCardProps {
  title: string
  sortItems: ReactNode
  isLoading: boolean
  withDivider?: boolean
  children: ReactNode
}

export const DashboardRankCard: FC<DashboardRankCardProps> = ({
  title,
  sortItems,
  isLoading,
  withDivider = false,
  children,
}) => {
  const { t } = useTranslation()

  return (
    <div>
      <div className='col-span-1 rounded-md divide-y shadow divide-gray-200 bg-cardBackgroud dark:bg-cardBackgroudDark dark:divide-gray-700'>
        <div className='flex flex-col pt-3 pb-5 px-5'>
          <div className='flex w-full items-center justify-between space-x-6'>
            <div className='flex-1 truncate'>
              <div className='flex items-center space-x-2 py-1 text-gray-700 dark:text-gray-200'>
                <h3 className='truncate text-lg leading-6 font-medium'>{title}</h3>
              </div>
            </div>
            <Dropdown items={sortItems} position='left'>
              <Button variant='white'>
                <span>{t('QueueManager.Order')}</span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className='h-3.5 w-3.5 ml-2'
                  aria-hidden='true'
                />
              </Button>
            </Dropdown>
          </div>
        </div>
        {withDivider && (
          <div className='flex-grow border-b border-gray-200 dark:border-gray-700'></div>
        )}
        <div className='flow-root'>
          <div className='-mx-4 -my-2 overflow-x-auto sm:-mx-6 pl-2 pr-2'>
            <div className='inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8'>
              <table className='min-w-full divide-y divide-gray-300'>
                <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                  {isLoading &&
                    Array.from(Array(RANK_ROWS)).map((e, i) => (
                      <tr key={i}>
                        {Array.from(Array(3)).map((e, j) => (
                          <td key={j}>
                            <div className='px-4 py-6'>
                              <div className='animate-pulse h-5 rounded bg-gray-300 dark:bg-gray-600'></div>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!isLoading && children}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RankIndexCellProps {
  index: number
  isTall?: boolean
}

export const RankIndexCell: FC<RankIndexCellProps> = ({ index, isTall = false }) => (
  <td className={`whitespace-nowrap ${isTall ? 'py-3' : 'py-2'} pl-4 pr-3 text-sm sm:pl-0`}>
    <div className={`flex items-center justify-center h-full${isTall ? ' py-3' : ''}`}>
      {index + 1}.
    </div>
  </td>
)

export const RankValueCell: FC<{ children: ReactNode }> = ({ children }) => (
  <td className='relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-0'>
    {children}
  </td>
)

interface OperatorRankRowsProps {
  rows: Record<string, any>
  operators: any
  onNameClick: (agent: any) => void
  onAvatarClick: (agent: any) => void
  formatValue?: (value: any) => ReactNode
  emptyValue?: string
  isTallIndex?: boolean
}

export const OperatorRankRows: FC<OperatorRankRowsProps> = ({
  rows,
  operators,
  onNameClick,
  onAvatarClick,
  formatValue = (value) => value,
  emptyValue = '-',
  isTallIndex = false,
}) => (
  <>
    {Array.from({ length: RANK_ROWS }).map((_, index) => {
      const agent = Object.values(rows)[index]
      const isRowEmpty = !agent

      return (
        <tr key={index}>
          <RankIndexCell index={index} isTall={isTallIndex} />
          <td className='whitespace-nowrap py-3 pl-4 pr-3 text-sm sm:pl-0'>
            <div className='flex items-center'>
              <div className='h-9 w-9 flex-shrink-0 mr-2'>
                {isRowEmpty ? (
                  <Avatar
                    placeholderType='operator'
                    size='small'
                    bordered
                    className='cursor-pointer'
                  />
                ) : (
                  <Avatar
                    rounded='full'
                    src={operators[agent?.shortname]?.avatarBase64}
                    placeholderType='operator'
                    size='small'
                    status={operators[agent?.shortname]?.mainPresence}
                    star={operators[agent?.shortname]?.favorite}
                    onClick={() => onAvatarClick(agent)}
                    className='cursor-pointer'
                  />
                )}
              </div>
              <div
                className='text-gray-900 dark:text-gray-100 cursor-pointer'
                onClick={() => onNameClick(agent)}
              >
                {isRowEmpty ? '-' : agent?.name}
              </div>
            </div>
          </td>
          <RankValueCell>{isRowEmpty ? emptyValue : formatValue(agent?.values)}</RankValueCell>
        </tr>
      )
    })}
  </>
)

export const QueueRankRows: FC<{ rows: Record<string, any> }> = ({ rows }) => (
  <>
    {Object.values(rows).map((queue: any, index: number) => (
      <tr key={index}>
        <RankIndexCell index={index} />
        <td className='whitespace-nowrap py-3 pl-4 pr-3 text-sm sm:pl-0'>
          <div className='flex items-center py-3'>
            <div className='text-gray-900 dark:text-gray-100'>{queue.name}</div>
          </div>
        </td>
        <RankValueCell>{queue.values}</RankValueCell>
      </tr>
    ))}
  </>
)
