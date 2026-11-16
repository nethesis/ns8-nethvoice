// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ComponentProps, useState, useEffect, useRef, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ConfirmationModal } from '../../common'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import {
  faChevronDown,
  faExpand,
  faMinus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

import { DEFAULT_REALTIME_QUEUE_SELECTED, getMonitorValue } from '../../../lib/queueManager'

import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOptions,
  Transition,
} from '@headlessui/react'

import { savePreference } from '../../../lib/storage'

import { MonitorCard, MonitorTables } from './Tables'
import { MonitorDropdownOption, monitorDropdownPanelClasses } from './MonitorDropdown'

export interface MonitorProps extends ComponentProps<'div'> {}

const numbers = Array.from({ length: 20 }, (_, index) => index + 1)

export const Monitor: FC<MonitorProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number>(0)

  const authStore = useSelector((state: RootState) => state.authentication)

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Activate or deactivate fullscreen mode
  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen)
  }

  // on change of selected row numbers
  const handleSelectedRowNumbers = (newRowNumbers: any) => {
    setSelected(newRowNumbers)
    let currentSelectedRowNumbers = newRowNumbers
    savePreference('monitorRowNumbers', currentSelectedRowNumbers, authStore.username)
  }

  const [cards, setCards] = useState<MonitorCard[]>([])
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false)
  const cancelRemoveAllRef = useRef<HTMLButtonElement>(null)
  const nextCardId = useRef(0)

  const createCard = (queue: any): MonitorCard => ({ id: nextCardId.current++, queue })

  const updateCards = (newCards: MonitorCard[]) => {
    setCards(newCards)
    savePreference(
      'monitorSelectedQueues',
      newCards.map((card) => card.queue),
      authStore.username,
    )
  }

  const addCard = () => {
    updateCards([...cards, createCard(DEFAULT_REALTIME_QUEUE_SELECTED)])
  }

  const removeAllCards = () => {
    updateCards(cards.slice(0, 1))
    setShowRemoveAllModal(false)
  }

  const removeCard = (cardId: number) => {
    updateCards(cards.filter((card) => card.id !== cardId))
  }

  const changeCardQueue = (cardId: number, newQueue: any) => {
    updateCards(
      cards.map((card) => {
        if (card.id !== cardId) {
          return card
        }
        const isSameQueue = !!newQueue?.queue && newQueue.queue === card.queue?.queue
        return { ...card, queue: isSameQueue ? DEFAULT_REALTIME_QUEUE_SELECTED : newQueue }
      }),
    )
  }

  //Load selected row numbers and queues from local storage
  useEffect(() => {
    const monitorLocalStorageValue = getMonitorValue(authStore.username)
    setSelected(monitorLocalStorageValue.rowNumbers)
    setCards(monitorLocalStorageValue.selectedQueues.map((queue: any) => createCard(queue)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  //Use escape button to close fullscreen
  useEffect(() => {
    const handleEscKey = (event: any) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleEscKey)

    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className='flex space-x-8'>
        <Listbox value={selected} onChange={handleSelectedRowNumbers}>
          {({ open }) => (
            <>
              <div className='flex items-center'>
                <Label className='block text-sm font-medium leading-6 dark:text-gray-200 text-gray-700 mr-8'>
                  {t('QueueManager.Calls to show')}
                </Label>
                <div className='relative'>
                  <ListboxButton className='relative w-full cursor-default rounded-md bg-white dark:bg-gray-950 py-1.5 pl-3 pr-10 text-left text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6'>
                    <span className='block truncate mr-1'>{selected}</span>
                    <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
                        aria-hidden='true'
                      />
                    </span>
                  </ListboxButton>

                  <Transition
                    show={open}
                    as={Fragment}
                    leave='transition ease-in duration-100'
                    leaveFrom='opacity-100'
                    leaveTo='opacity-0'
                  >
                    <ListboxOptions className={`${monitorDropdownPanelClasses} max-h-60 min-w-full`}>
                      {numbers.map((number: any) => (
                        <MonitorDropdownOption
                          key={number}
                          value={number}
                          isSelected={number === selected}
                        >
                          {number}
                        </MonitorDropdownOption>
                      ))}
                    </ListboxOptions>
                  </Transition>
                </div>
              </div>
            </>
          )}
        </Listbox>
        {cards.length >= 2 && (
          <Button variant='white' onClick={() => setShowRemoveAllModal(true)}>
            <FontAwesomeIcon icon={faMinus} />
            <span className='ml-2'>{t('QueueManager.Remove all tables')}</span>
          </Button>
        )}
        <Button variant='primary' onClick={toggleFullscreen}>
          <FontAwesomeIcon
            icon={faExpand}
            className='h-5 w-5 mr-2 cursor-pointer flex items-center'
            aria-hidden='true'
          />
          <span>{t('QueueManager.Fullscreen')}</span>
        </Button>
      </div>

      {/* Queue Dashboard*/}
      <div
        className={`transition-all duration-300 ${
          isFullscreen
            ? 'fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-50 bg-white dark:bg-gray-800 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'
            : ''
        }`}
      >
        <div>
          {/* Card section */}
          <div className='flex flex-col'>
            {isFullscreen && (
              <div className='flex justify-end'>
                <Button variant='ghost' className='w-8 h-8' onClick={() => setIsFullscreen(false)}>
                  <FontAwesomeIcon
                    className='h-5 w-5 cursor-pointer dark:text-gray-200 text-gray-700'
                    icon={faXmark}
                  />
                </Button>
              </div>
            )}
            <MonitorTables
              isFullscreen={isFullscreen}
              selectedRow={selected}
              cards={cards}
              onQueueChange={changeCardQueue}
              onAdd={addCard}
              onRemove={removeCard}
            />
          </div>
        </div>
      </div>

      <ConfirmationModal
        show={showRemoveAllModal}
        focus={cancelRemoveAllRef}
        onClose={() => setShowRemoveAllModal(false)}
        title={t('QueueManager.Remove all tables')}
        description={t('QueueManager.Remove all tables message')}
        confirmLabel={t('QueueManager.Remove')}
        onConfirm={removeAllCards}
      />
    </>
  )
}

Monitor.displayName = 'Monitor'
