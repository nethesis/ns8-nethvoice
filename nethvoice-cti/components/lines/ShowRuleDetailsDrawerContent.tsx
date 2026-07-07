// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useEffect, useState, useRef } from 'react'
import classNames from 'classnames'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { DrawerFooter } from '../common/DrawerFooter'
import { useTranslation } from 'react-i18next'
import {
  faFloppyDisk,
  faCircleXmark,
  faBullhorn,
  faVoicemail,
  faTurnDown,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { customScrollbarClass } from '../../lib/utils'
import { TextInput, Button, IconSwitch } from '../common'
import { parse, subDays, startOfDay } from 'date-fns'
import { formatDateLoc } from '../../lib/dateTime'

export interface ShowRuleDetailsContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const ShowRuleDetailsContent = forwardRef<HTMLButtonElement, ShowRuleDetailsContentProps>(
  ({ config, className, ...props }, ref) => {
    const { t } = useTranslation()
    const [textFilter, setTextFilter] = useState('')
    const textFilterRef = useRef() as React.MutableRefObject<HTMLInputElement>
    const [selectedFile, setSelectedFile] = useState<any>(null)

    const [isManageRuleActive, setManageRuleActive] = useState(true)
    const [isManageAnnouncementActive, setManageAnnouncementActive] = useState(true)

    const [announcementSelected, setAnnouncementSelected] = useState('')

    const [dateBeginValue, setDateBeginValue] = useState('')

    const [dateEndValue, setDateEndValue] = useState('')

    const [isAnnouncementVoicemailActive, setAnnouncementVoicemailActive] = useState(false)

    const [isForwardActive, setForwardActive] = useState(false)

    const [selectedLines, setSelectedLines] = useState(new Set())

    const [selectedType, setSelectedType] = useState('specifyDay')

    const [dateBeginShowed, setDateBeginShowed] = useState('')

    //Get value from date input
    const dateBeginRef = useRef() as React.MutableRefObject<HTMLInputElement>
    const dateEndRef = useRef() as React.MutableRefObject<HTMLInputElement>

    const announcementLists = [
      { id: 'firstAnnouncement', value: 'firstAnnouncement' },
      { id: 'secondAnnouncement', value: 'secondAnnouncement' },
      { id: 'thirdAnnouncement', value: 'thirdAnnouncement' },
    ]

    const linesList = [
      { id: 'firstLines', value: 'Assistenza clienti' },
      { id: 'secondLines', value: 'Assistenza rivenditori' },
      { id: 'thirdLines', value: 'Commerciali Italia' },
    ]

    const dateSelectionInputs = [
      { id: 'specifyDay', value: t('Lines.Specify start date and end date') },
      { id: 'onlyOneDay', value: t('Lines.Only active for one day') },
      { id: 'everyDay', value: t('Lines.Active every day') },
    ]

    const clearTextFilter = () => {
      setTextFilter('')
      textFilterRef.current.focus()
    }

    const toggleManageRule = () => {
      setManageRuleActive(!isManageRuleActive)
    }

    const toggleManageAnnouncement = () => {
      setManageAnnouncementActive(!isManageAnnouncementActive)
    }

    const toggleAnnouncementVoicemail = () => {
      setAnnouncementVoicemailActive(!isAnnouncementVoicemailActive)
    }

    const toggleForward = () => {
      setForwardActive(!isForwardActive)
    }

    const changeDateBegin = () => {
      //Get the date from the input
      const dateBegin = dateBeginRef.current.value
      //Convert the date to the format for the visualizations
      let convertDateBegin = parse(dateBegin, "yyyy-MM-dd'T'HH:mm", new Date())
      //Convert from object to string and format the date
      let dateBeginWithHour: any = formatDateLoc(convertDateBegin, 'PPp')
      setDateBeginValue(dateBegin)
      // update the begin date that will be showed in the filter
      setDateBeginShowed(dateBeginWithHour)
    }

    const changeDateEnd = () => {
      //Get the date from the input
      const dateEnd = dateEndRef.current.value
      setDateEndValue(dateEnd)
    }

    function saveEditPhoneLines() {
      // TO DO POST API
    }

    function changeTextFilter(event: any) {
      const newTextFilter = event.target.value
      setTextFilter(newTextFilter)
    }

    function changeAnnouncementSelect(event: any) {
      const listAnnouncementValue = event.target.id
      setAnnouncementSelected(listAnnouncementValue)
    }

    function changeTypeSelected(event: any) {
      const radioButtonTypeSelected = event.target.id
      setSelectedType(radioButtonTypeSelected)
    }

    function toggleSelectAll() {
      if (selectedLines.size === linesList.length) {
        setSelectedLines(new Set())
      } else {
        setSelectedLines(new Set(linesList.map((line) => line.id)))
      }
    }

    function toggleLine(id: string) {
      const newSelected = new Set(selectedLines)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
      setSelectedLines(newSelected)
    }

    return (
      <>
        <DrawerHeader title={t('Lines.Rule details')} />
        <div className={classNames(className, 'px-5')} {...props}>
          <Divider />
          {/* announcement name */}
          <div className='flex flex-col'>
            <h4 className='text-base font-medium text-gray-700 dark:text-gray-200 mb-3'>
              {t('Lines.Rule name')}
            </h4>
            <TextInput
              placeholder={t('Lines.Filter announcement') || ''}
              className='max-w-sm'
              value={config.name}
              onChange={changeTextFilter}
              ref={textFilterRef}
              icon={textFilter.length ? faCircleXmark : undefined}
              onIconClick={() => clearTextFilter()}
              trailingIcon={true}
            />
          </div>

          {/* Activate Rule switch  */}
          <div className='flex items-center justify-between mt-6'>
            <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Lines.Activate rule')}
            </h4>
            {/* <IconSwitch
              on={isManageRuleActive}
              size='extra_large'
              onIcon={<FontAwesomeIcon icon={faToggleLargeOn} />}
              offIcon={<FontAwesomeIcon icon={faToggleLargeOff} />}
              changed={() => toggleManageRule()}
            ></IconSwitch>{' '} */}
          </div>

          {/* Divider */}
          <div className='mt-1 mb-5 border-t border-gray-200 dark:border-gray-700'></div>

          {/* Activate Announcement switch  */}
          <div className='flex items-center justify-between mt-6'>
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faBullhorn}
                className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                aria-hidden='true'
              />
              <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                {t('Lines.Activate announcement')}
              </h4>
            </div>
            {/* <IconSwitch
              on={isManageAnnouncementActive}
              size='extra_large'
              onIcon={<FontAwesomeIcon icon={faToggleLargeOn} />}
              offIcon={<FontAwesomeIcon icon={faToggleLargeOff} />}
              changed={() => toggleManageAnnouncement()}
            ></IconSwitch>{' '} */}
          </div>

          {/* Divider */}
          <div className='mt-1 mb-5 border-t border-gray-200 dark:border-gray-700'></div>

          {/* Show input if activate announcement is active  */}
          {isManageAnnouncementActive && (
            <>
              <div className='mb-4'>
                <label htmlFor='types' className='sr-only'>
                  {t('Lines.Select a type')}
                </label>
                <select
                  id='types'
                  name='types'
                  className='block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primary dark:focus:ring-primary dark:bg-gray-900'
                  defaultValue={announcementSelected}
                  onChange={changeAnnouncementSelect}
                >
                  {announcementLists.map((announcementList) => (
                    <option key={announcementList.id}>{announcementList.value}</option>
                  ))}
                </select>
              </div>
              <span className='font-medium'>{t('Lines.Select period')}</span>
              {/* Date input  */}
              {/* TO DO MANAGE IN CASE OF MOBILE DEVICE */}
              {/* TO DO CHECK RADIO BUTTON VALUE TO SET DATE  */}
              <div className='mt-4'>
                {/* Date input select */}
                <fieldset>
                  <legend className='sr-only'>Date range select</legend>
                  <div className='space-y-4'>
                    {dateSelectionInputs.map((dateSelectionInput) => (
                      <div key={dateSelectionInput.id} className='flex items-center'>
                        <input
                          id={dateSelectionInput.id}
                          name='date-select'
                          type='radio'
                          defaultChecked={dateSelectionInput.id === 'specifyDay'}
                          className='h-4 w-4 border-gray-300 text-primary dark:text-primaryDark dark:border-gray-600 focus:ring-primaryLight dark:focus:ring-primaryDark'
                          onChange={changeTypeSelected}
                        />
                        <label
                          htmlFor={dateSelectionInput.id}
                          className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
                        >
                          {dateSelectionInput.value}
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>
                <div className='flex mt-3 items-center justify-between'>
                  <span>{t('Lines.Begin')}</span>
                  <span className='ml-auto mr-auto'>{t('Lines.End')}</span>
                </div>
                {/*  */}
                <div className='flex mt-3 items-center justify-between'>
                  <TextInput
                    type='datetime-local'
                    placeholder={t('Lines.Select date start') || ''}
                    className='max-w-sm mr-4'
                    id='meeting-time'
                    name='meeting-time'
                    ref={dateBeginRef}
                    onChange={changeDateBegin}
                    defaultValue={dateBeginValue}
                    disabled={selectedType != 'specifyDay'}
                  />
                  <TextInput
                    type='datetime-local'
                    placeholder={t('Lines.Select date end') || ''}
                    className='max-w-sm'
                    id='meeting-time'
                    name='meeting-time'
                    ref={dateEndRef}
                    onChange={changeDateEnd}
                    defaultValue={dateEndValue}
                    disabled={selectedType != 'specifyDay'}
                  />
                </div>
              </div>
            </>
          )}

          {/* Announcement and voicemail switch */}
          <div className='flex items-center justify-between mt-6'>
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faVoicemail}
                className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                aria-hidden='true'
              />
              <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                {t('Lines.Activate announcement + voicemail')}
              </h4>
            </div>
            {/* <IconSwitch
              on={isAnnouncementVoicemailActive}
              size='extra_large'
              onIcon={<FontAwesomeIcon icon={faToggleLargeOn} />}
              offIcon={<FontAwesomeIcon icon={faToggleLargeOff} />}
              changed={() => toggleAnnouncementVoicemail()}
            ></IconSwitch> */}
          </div>

          {/* Divider */}
          <div className='mt-1 border-t border-gray-200 dark:border-gray-700'></div>

          {/* Activate forward */}
          <div className='flex items-center justify-between mt-6'>
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faTurnDown}
                className='mr-4 h-4 w-4 rotate-[270deg] flex-shrink-0 text-gray-400 dark:text-gray-500'
                aria-hidden='true'
              />
              <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                {t('Lines.Activate forward')}
              </h4>
            </div>
            {/* <IconSwitch
              on={isForwardActive}
              size='extra_large'
              onIcon={<FontAwesomeIcon icon={faToggleLargeOn} />}
              offIcon={<FontAwesomeIcon icon={faToggleLargeOff} />}
              changed={() => toggleForward()}
            ></IconSwitch> */}
          </div>

          {/* Divider */}
          <div className='mt-1 border-t border-gray-200 dark:border-gray-700'></div>

          {isForwardActive && (
            <TextInput placeholder={t('Lines.Insert number') || ''} className='mt-4'></TextInput>
          )}

          {/* Lines select checkbox  */}
          <div className='flex items-center justify-between mt-6'>
            <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Lines.Lines select')}
            </h4>
            <div className='flex items-center'>
              <label className='mr-2'>
                <input
                  type='checkbox'
                  onChange={toggleSelectAll}
                  checked={selectedLines.size === linesList.length}
                  className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                />
                <span className='ml-2'>{t('Lines.Select all')}</span>
              </label>
            </div>
          </div>

          {/* Divider */}
          <div className='mt-3 mb- border-t border-gray-200 dark:border-gray-700'></div>

          {/* Date input select  */}
          <fieldset className={`max-h-56 ${customScrollbarClass}`}>
            <legend className='sr-only'>Date range select</legend>
            <div className='space-y-4 mt-3 ml-1'>
              {linesList.map((listSelectionInput) => (
                <div key={listSelectionInput.id} className='flex items-center'>
                  <input
                    id={listSelectionInput.id}
                    name='date-select'
                    type='checkbox'
                    value={listSelectionInput.value}
                    onChange={() => toggleLine(listSelectionInput.id)}
                    checked={selectedLines.has(listSelectionInput.id)}
                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                  />
                  <label
                    htmlFor={listSelectionInput.id}
                    className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
                  >
                    {listSelectionInput.value}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          {/* Divider */}
          <Divider paddingY='pb-10 pt-6' />

          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Common.Save')}
            confirmIcon={<FontAwesomeIcon icon={faFloppyDisk} className='mr-2 h-4 w-4' />}
            onConfirm={saveEditPhoneLines}
            confirmDisabled={!selectedFile}
          />
        </div>
      </>
    )
  },
)

ShowRuleDetailsContent.displayName = 'ShowRuleDetailsContent'
