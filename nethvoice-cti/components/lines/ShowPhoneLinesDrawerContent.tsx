// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useEffect, useState, useRef } from 'react'
import classNames from 'classnames'
import { Switch, InlineNotification } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { DrawerFooter } from '../common/DrawerFooter'

import { useTranslation } from 'react-i18next'
import {
  faPhone,
  faBullhorn,
  faVoicemail,
  faTurnDown,
  faFloppyDisk,
  faChevronDown,
  faChevronUp,
  faCalendar,
  faPlay,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  callPhoneNumber,
  closeSideDrawer,
  getTimezone,
  playFileAudio,
  transferCallToExtension,
} from '../../lib/utils'
import { TextInput, Button } from '../common'
import { formatDateLoc } from '../../lib/dateTime'
import {
  buildForwardingDateTime,
  convertForwardingDateRangeToIso,
  convertForwardingFullDayToIso,
  normalizeForwardingPickerDate,
} from '../../lib/lineForwardingDates'
import { setOffHour, getAnnouncements, reloadPhoneLines } from '../../lib/lines'
import { format } from 'date-fns'
import Datepicker from 'react-tailwindcss-datepicker'
import { useTheme } from '../../theme/Context'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

export interface ShowPhoneLinesDrawerContentProps extends ComponentPropsWithRef<'div'> {
  config: any
}

export const ShowPhoneLinesDrawerContent = forwardRef<
  HTMLButtonElement,
  ShowPhoneLinesDrawerContentProps
>(({ config, className, ...props }, ref) => {
  const { t } = useTranslation()
  const [isConfigurationActive, setConfigurationActive] = useState(false)
  const [announcementSelected, setAnnouncementSelected] = useState<any>(null)

  const [selectedType, setSelectedType] = useState('')
  const [selectedConfigurationTypology, setSelectedConfigurationTypology] = useState('')
  const [selectedAnnouncementInfo, setSelectedAnnouncementInfo] = useState<any>(null)
  const [firstRender, setFirstRender]: any = useState(true)
  const { timePicker: timePickerTheme, datePicker: datePickerTheme } = useTheme().theme

  const authStore = useSelector((state: RootState) => state.authentication)
  const operatorsStore = useSelector((state: RootState) => state.operators)

  function changeAnnouncementSelect(event: any) {
    const listAnnouncementValue = event.target.value

    const selectedAnnouncement = announcement.find(
      (announcementItem: any) => announcementItem.id === parseInt(listAnnouncementValue),
    )
    if (selectedAnnouncement) {
      setSelectedAnnouncementInfo(selectedAnnouncement)
      setAnnouncementSelected(listAnnouncementValue)
    }
  }

  //date function section

  const [dateBeginToShow, setDateBeginToShow] = useState('')
  const [dateBeginToShowNoHour, setDateBeginToShowNoHour] = useState('')
  const [dateEndToShow, setDateEndToShow] = useState('')
  //Get value from date input
  const startTimeRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const endTimeRef = useRef() as React.MutableRefObject<HTMLInputElement>

  const [dateBeginValue, setDateBeginValue]: any = useState({
    startDate: null,
    endDate: null,
  })

  const [dateBeginNoHourValue, setdateBeginNoHourValue]: any = useState({
    startDate: null,
    endDate: null,
  })

  const [dateEndValue, setdateEndValue]: any = useState({
    startDate: null,
    endDate: null,
  })

  const [startTimeValue, setStartTimeValue]: any = useState('')
  const [endTimeValue, setEndTimeValue]: any = useState('')

  //set actual date without hours
  const actualDateToShow: any = formatDateLoc(new Date(), 'yyyy-MM-dd')
  //set actual date with hours
  const actualDateToShowWithHour: any = formatDateLoc(new Date(), "yyyy-MM-dd'T'HH:mm")
  const formattedActualDateEndToShowWithHour = format(
    new Date().setHours(23, 59),
    "yyyy-MM-dd'T'HH:mm",
  )

  useEffect(() => {
    //check if the configuration is active
    setConfigurationActive(config.enabled)
    setChangeTypeDate(config.periodTypology)
    //set the dateType. It can be 'always' or 'specifyDay'
    setSelectedType(config.dateType)
    //set the configuration typology. It could be 'audiomsg', 'audiomsg_voicemail' or 'redirect'
    setSelectedConfigurationTypology(config.action)
    setAnnouncementSelected(config.announcement_id)

    //If datebegin exists convert the dateType to yyyy-MM-dd'T'HH:mm in case of "specify a day"
    //'yyyy-MM-dd' in case of 'only one day'
    if (config.datebegin) {
      const dateBeginObj = new Date(config.datebegin)
      const formattedBeginDate = format(dateBeginObj, "yyyy-MM-dd'T'HH:mm")
      const formattedBeginDateNoHour = format(dateBeginObj, 'yyyy-MM-dd')
      const startTime = format(dateBeginObj, 'HH:mm')
      setStartTimeValue(startTime)

      setDateBeginToShow(formattedBeginDate)
      setDateBeginValue((prevState: any) => {
        return {
          ...prevState,
          startDate: formattedBeginDate,
          endDate: formattedBeginDate,
        }
      })
      setDateBeginToShowNoHour(formattedBeginDateNoHour)
      setdateBeginNoHourValue((prevState: any) => {
        return {
          ...prevState,
          startDate: formattedBeginDateNoHour,
          endDate: formattedBeginDateNoHour,
        }
      })
    } else {
      //if datebegin doesn't exist set both dates to the current date
      setDateBeginToShow(actualDateToShowWithHour)
      setDateBeginValue((prevState: any) => {
        return {
          ...prevState,
          startDate: actualDateToShow,
          endDate: actualDateToShow,
        }
      })
      setDateBeginToShowNoHour(actualDateToShow)
      setdateBeginNoHourValue((prevState: any) => {
        return {
          ...prevState,
          startDate: actualDateToShow,
          endDate: actualDateToShow,
        }
      })
    }
    if (config.dateend) {
      const dateEndObj = new Date(config.dateend)
      const formattedEndDate = format(dateEndObj, "yyyy-MM-dd'T'HH:mm")
      const endDate = format(dateEndObj, 'HH:mm')
      setEndTimeValue(endDate)
      setDateEndToShow(formattedEndDate)
      setdateEndValue((prevState: any) => {
        return {
          ...prevState,
          startDate: formattedEndDate,
          endDate: formattedEndDate,
        }
      })
    } else {
      setDateEndToShow(formattedActualDateEndToShowWithHour)
      setdateEndValue((prevState: any) => {
        return {
          ...prevState,
          startDate: formattedActualDateEndToShowWithHour,
          endDate: formattedActualDateEndToShowWithHour,
        }
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [changeTypeDate, setChangeTypeDate] = useState('')

  //get server timezone to correctly format the date
  let timezone = getTimezone()

  function convertDateSpecifyFormat() {
    return convertForwardingDateRangeToIso(dateBeginToShow, dateEndToShow, timezone)
  }

  function convertDateOnlyDayFormat() {
    return convertForwardingFullDayToIso(dateBeginToShowNoHour, timezone)
  }
  const changeStartTimeNoHours = (startTimeNoHoursObject: any) => {
    if (startTimeNoHoursObject) {
      const formattedBeginDateNoHour = normalizeForwardingPickerDate(
        startTimeNoHoursObject.startDate,
      )

      if (!formattedBeginDateNoHour) {
        return
      }

      setDateBeginToShowNoHour(formattedBeginDateNoHour)
      //update date picker form
      setdateBeginNoHourValue({
        ...startTimeNoHoursObject,
        startDate: formattedBeginDateNoHour,
        endDate: formattedBeginDateNoHour,
      })
    }
  }

  function changeStartTime() {
    //Get the date from the input
    const startTime = startTimeRef.current.value
    setStartTimeValue(startTime)
  }

  function changeEndTime() {
    //Get the date from the input
    const endDate = endTimeRef.current.value
    setEndTimeValue(endDate)
  }

  const changeDateBegin = (dateStartObject: any) => {
    // Check if dateStartObject is not null and has valid startDate properties
    if (dateStartObject?.startDate !== null) {
      const normalizedStartDate = normalizeForwardingPickerDate(dateStartObject.startDate)

      if (!normalizedStartDate) {
        return
      }

      const startDateWithHour = buildForwardingDateTime(
        normalizedStartDate,
        startTimeValue,
        '08:00',
      )

      if (!startDateWithHour) {
        return
      }

      // Update the state with the startDate including the hour
      setDateBeginToShow(startDateWithHour)
      setDateBeginValue({
        ...dateStartObject,
        startDate: normalizedStartDate,
        endDate: normalizeForwardingPickerDate(dateStartObject.endDate) || normalizedStartDate,
      })
    }
  }

  const changeDateEnd = (dateEndObject: any) => {
    // Check if dateEndObject is not null and has valid endDate properties
    if (dateEndObject?.endDate !== null) {
      const normalizedEndDate = normalizeForwardingPickerDate(dateEndObject.endDate)

      if (!normalizedEndDate) {
        return
      }

      const endDateWithHour = buildForwardingDateTime(normalizedEndDate, endTimeValue, '21:00')

      if (!endDateWithHour) {
        return
      }

      // Update the state with the endDate including the hour
      setDateEndToShow(endDateWithHour)
      setdateEndValue({
        ...dateEndObject,
        startDate: normalizeForwardingPickerDate(dateEndObject.startDate) || normalizedEndDate,
        endDate: normalizedEndDate,
      })
    }
  }

  useEffect(() => {
    // Check if dateBeginValue is not null
    if (dateBeginValue !== null) {
      // Check if the startDate property includes 'T', indicating it has an hour
      if (dateBeginValue?.startDate?.includes('T')) {
        // If it has an hour, create an updatedObject with startDate and endDate without the hour
        const updatedObjectDateBegin = {
          startDate: dateBeginValue.startDate.substring(0, 10),
          endDate: dateBeginValue.endDate.substring(0, 10),
        }
        // Call changeDateBegin with the updatedObject
        changeDateBegin(updatedObjectDateBegin)
      } else {
        // If it doesn't have an hour, call changeDateBegin with dateBeginValue as is
        changeDateBegin(dateBeginValue)
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTimeValue])

  useEffect(() => {
    // Check if dateEndValue is not null
    if (dateEndValue !== null) {
      // Check if the endDate property includes 'T', indicating it has an hour
      if (dateEndValue?.endDate?.includes('T')) {
        // If it has an hour, create an updatedObject with startDate and endDate without the hour
        const updatedObjectDateEnd = {
          startDate: dateEndValue.startDate.substring(0, 10),
          endDate: dateEndValue.endDate.substring(0, 10),
        }
        // Call changeDateEnd with the updatedObject
        changeDateEnd(updatedObjectDateEnd)
      } else {
        // If it doesn't have an hour, call changeDateEnd with dateEndValue as is
        changeDateEnd(dateEndValue)
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTimeValue])

  function dateInputFunction() {
    return (
      <>
        <div className='mt-5 items-center justify-between'>
          <div>
            {selectedType === 'specifyDay' ? (
              <>
                <div className='flex pb-4'>
                  <div className='relative flex-1'>
                    <label htmlFor='fromTime' className='text-gray-700 dark:text-gray-300 mt-2'>
                      {t('Lines.Start time')}:
                    </label>
                    <input
                      id='fromTime'
                      type='time'
                      ref={startTimeRef}
                      onChange={changeStartTime}
                      defaultValue={startTimeValue}
                      className={classNames(timePickerTheme.base)}
                    />
                  </div>
                  <div className='mx-4'></div>
                  <div className='flex flex-col'>
                    <label htmlFor='toTime' className='text-gray-700 dark:text-gray-300 mb-1'>
                      {t('Lines.Start date')}:
                    </label>
                    <div className='relative'>
                      <Datepicker
                        value={dateBeginValue}
                        onChange={changeDateBegin}
                        primaryColor={'emerald'}
                        showShortcuts={false}
                        placeholder={t('Common.DD/MM/YYYY') || ''}
                        displayFormat={'DD/MM/YYYY'}
                        useRange={false}
                        asSingle={true}
                        inputClassName={classNames(datePickerTheme.base)}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className='flex pb-4 flex-col'>
                  <label htmlFor='toTime' className='text-gray-700 dark:text-gray-300 mb-1'>
                    {t('Lines.Start date')}:
                  </label>
                  <div className='relative flex-grow'>
                    <Datepicker
                      value={dateBeginNoHourValue}
                      onChange={changeStartTimeNoHours}
                      primaryColor={'emerald'}
                      showShortcuts={false}
                      placeholder={t('Common.DD/MM/YYYY') || ''}
                      displayFormat={'DD/MM/YYYY'}
                      useRange={false}
                      asSingle={true}
                      inputClassName={classNames(datePickerTheme.base)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div>
            {selectedType === 'specifyDay' && (
              <div className='flex pb-4'>
                <div className='relative flex-1'>
                  <label htmlFor='fromTime' className='text-gray-700 dark:text-gray-300 mt-2'>
                    {t('Lines.End time')}:
                  </label>
                  <input
                    id='fromTime'
                    type='time'
                    ref={endTimeRef}
                    onChange={changeEndTime}
                    defaultValue={endTimeValue}
                    className={classNames(timePickerTheme.base)}
                  />
                </div>
                <div className='mx-4'></div>
                <div className='flex flex-col'>
                  <label htmlFor='toTime' className='text-gray-700 dark:text-gray-300 mb-1'>
                    {t('Lines.End date')}:
                  </label>
                  <div className='relative'>
                    <Datepicker
                      value={dateEndValue}
                      onChange={changeDateEnd}
                      primaryColor={'emerald'}
                      showShortcuts={false}
                      placeholder={t('Common.DD/MM/YYYY') || ''}
                      displayFormat={'DD/MM/YYYY'}
                      useRange={false}
                      asSingle={true}
                      inputClassName={classNames(datePickerTheme.base)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }
  //end of all the date function operations

  // RULE SECTION HIDDEN AT THE MOMENT
  // const [changeConfigurationRadio, setChangeConfigurationRadio] = useState('customize')
  // const [selectedRulesInfo, setSelectedRulesInfo] = useState('')
  // const [openPanel, setOpenPanel] = useState('')
  // const togglePanel = (id: string) => {
  //   setOpenPanel(openPanel === id ? '' : id)
  // }
  // const dateRuleInformations = [
  //   { id: 'febbraio', value: 'Febbraio 2024' },
  //   { id: 'ferie', value: 'Ferie' },
  //   { id: 'natale', value: 'Natale' },
  // ]

  // function changeDateSelected(event: any) {
  //   const radioButtonDateSelected = event.target.id
  //   setSelectedRulesInfo(radioButtonDateSelected)
  // }

  // function changeConfiguration(event: any) {
  //   const radioButtonConfigurationValue = event.target.id
  //   setChangeConfigurationRadio(radioButtonConfigurationValue)
  // }

  // function ruleTypeSelected() {
  //   return (
  //     <>
  //       {/* Activate Announcement switch  */}
  //       <div className='px-5'>
  //         {/* Title */}
  //         <div className='flex items-center justify-between mt-8'>
  //           <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
  //             {t('Lines.Select rule')}
  //           </h4>
  //         </div>
  //         {/* Divider */}
  //         <div className='mt-3 mb-5 border-t border-gray-200 dark:border-gray-700'></div>
  //       </div>

  //       <fieldset className='mt-4'>
  //         <legend className='sr-only'>Rule information</legend>
  //         <div className='space-y-4'>
  //           {dateRuleInformations.map((dateRuleInformation) => (
  //             <div key={dateRuleInformation.id}>
  //               <div
  //                 className={`flex items-center justify-between mt-1 ${
  //                   openPanel === dateRuleInformation.id ? 'bg-gray-100' : ''
  //                 } `}
  //               >
  //                 <div className='flex items-center px-5 pt-3'>
  //                   <input
  //                     id={dateRuleInformation.id}
  //                     name='date-select'
  //                     type='radio'
  //                     defaultChecked={dateRuleInformation.id === 'ferie'}
  //                     className='h-4 w-4 border-gray-300 text-primary dark:border-gray-600 focus:ring-primaryLight dark:focus:ring-primaryDark dark:text-primaryDark'
  //                     onChange={changeDateSelected}
  //                   />
  //                   <label
  //                     htmlFor={dateRuleInformation.id}
  //                     className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
  //                   >
  //                     {dateRuleInformation.value}
  //                   </label>
  //                 </div>
  //                 <button
  //                   className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
  //                   aria-hidden='true'
  //                   onClick={() => togglePanel(dateRuleInformation.id)}
  //                 >
  //                   <FontAwesomeIcon
  //                     icon={openPanel === dateRuleInformation.id ? faChevronUp : faChevronDown}
  //                   />
  //                 </button>
  //               </div>
  //               {openPanel === dateRuleInformation.id && (
  //                 <div className='bg-gray-100 px-5 py-3'>
  //                   <div className='flex flex-col'>
  //                     <h1 className='flex text-base font-medium text-gray-700 dark:text-gray-200'>
  //                       {t('Lines.Rule details')}
  //                     </h1>
  //                     {/* TO DO GET DATA FROM API */}
  //                     <div className='flex items-center mt-2'>
  //                       <FontAwesomeIcon
  //                         icon={faVoicemail}
  //                         className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
  //                         aria-hidden='true'
  //                       />
  //                       <h4 className='text-base text-gray-700 dark:text-gray-200'>
  //                         {t('Lines.Activate announcement and voicemail')}
  //                       </h4>
  //                     </div>
  //                     <div className='flex items-center mt-1'>
  //                       <FontAwesomeIcon
  //                         icon={faCalendar}
  //                         className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
  //                         aria-hidden='true'
  //                       />
  //                       <h4 className='text-base text-gray-700 dark:text-gray-200'>
  //                         {t('Lines.Begin')}
  //                       </h4>
  //                     </div>
  //                     <div className='flex items-center mt-1'>
  //                       <FontAwesomeIcon
  //                         icon={faCalendar}
  //                         className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
  //                         aria-hidden='true'
  //                       />
  //                       <h4 className='text-base text-gray-700 dark:text-gray-200'>
  //                         {t('Lines.End')}
  //                       </h4>
  //                     </div>
  //                   </div>
  //                 </div>
  //               )}
  //             </div>
  //           ))}
  //         </div>
  //       </fieldset>
  //     </>
  //   )
  // }

  const configurationType = [
    { id: 'customize', value: t('Lines.Customize') },
    // { id: 'rule', value: t('Lines.Choose rule') },
  ]

  const contactTypeFilter = {
    id: 'contactTypeFilter',
    name: 'Contact type',
    options: [
      { value: 'always', label: t('Lines.Active every day') },
      { value: 'specifyDay', label: t('Lines.Specify start date and end date') },
      { value: 'onlyOneDay', label: t('Lines.Only active for one day') },
    ],
  }

  const announcementTypologyConfiguration = {
    id: 'msgType',
    name: 'announcementType',
    options: [
      { value: 'audiomsg', label: t('Lines.Announcement') },
      { value: 'audiomsg_voicemail', label: t('Lines.Announcement and voicemail') },
      { value: 'redirect', label: t('Lines.Forward') },
    ],
  }

  const [textFilterVoiceMail, setTextFilterVoiceMail] = useState(
    config.voicemail_id ? config.voicemail_id : '',
  )
  const [textFilterRedirect, setTextFilterRedirect] = useState(
    config.redirect_to ? config.redirect_to : '',
  )

  const textFilterVoiceMailRef = useRef() as React.MutableRefObject<HTMLInputElement>
  const textFilterRedirectRef = useRef() as React.MutableRefObject<HTMLInputElement>

  const toggleConfigurationActive = () => {
    setConfigurationActive(!isConfigurationActive)
  }

  function changeTypeSelected(event: any) {
    const radioButtonTypeSelected = event.target.id
    setSelectedType(radioButtonTypeSelected)
    if (radioButtonTypeSelected === 'always') {
      setChangeTypeDate('always')
    } else {
      setChangeTypeDate('period')
    }
  }

  function changeAnnouncementTypologySelected(event: any) {
    const radioButtonTypeSelected = event.target.id
    setSelectedConfigurationTypology(radioButtonTypeSelected)
  }

  const [uploadOffHourError, setuploadOffHourError] = useState('')

  async function setOffHourObject(obj: any) {
    try {
      await setOffHour(obj)
      return true
    } catch (error) {
      setuploadOffHourError('Cannot upload announcement')
      return false
    }
  }

  const [missingAudiomessageAnnouncement, setMissingAudiomessageAnnouncement] = useState(false)
  async function saveEditPhoneLines() {
    let saveSucceeded = false

    if (isConfigurationActive) {
      let objectToSendApi = {
        action: selectedConfigurationTypology,
        announcement_id: selectedConfigurationTypology !== 'redirect' ? '' : null,
        calledIdNum: config.number.toString(),
        callerIdNum: config.callerNumber.toString(),
        enabled: '',
        end_date: changeTypeDate === 'period' ? '' : null,
        start_date: changeTypeDate === 'period' ? '' : null,
        voicemail_id: selectedConfigurationTypology === 'audiomsg_voicemail' ? '' : null,
        redirect_to: selectedConfigurationTypology === 'redirect' ? '' : null,
      }
      switch (selectedConfigurationTypology) {
        case 'audiomsg':
          if (announcementSelected) {
            objectToSendApi.announcement_id = announcementSelected.toString()
            setMissingAudiomessageAnnouncement(false)
          } else {
            setMissingAudiomessageAnnouncement(true)
            return
          }

          if (changeTypeDate === 'period') {
            objectToSendApi.enabled = 'period'
            if (selectedType === 'onlyOneDay') {
              const { dateBegin, dateEnd } = convertDateOnlyDayFormat()
              objectToSendApi.end_date = dateEnd
              objectToSendApi.start_date = dateBegin
            } else {
              const { dateBeginToSendApi, dateEndToSendApi } = convertDateSpecifyFormat()
              objectToSendApi.end_date = dateEndToSendApi
              objectToSendApi.start_date = dateBeginToSendApi
            }
          } else {
            objectToSendApi.enabled = 'always'
          }
          if (announcementSelected) {
            saveSucceeded = await setOffHourObject(objectToSendApi)
          }
          break

        case 'audiomsg_voicemail':
          if (textFilterVoiceMail) {
            objectToSendApi.voicemail_id = textFilterVoiceMail
            setMissingAudiomessageAnnouncement(false)
          } else {
            setMissingAudiomessageAnnouncement(true)
            return
          }
          if (announcementSelected) {
            objectToSendApi.announcement_id = announcementSelected.toString()
            setMissingAudiomessageAnnouncement(false)
          } else {
            setMissingAudiomessageAnnouncement(true)
            return
          }
          if (changeTypeDate === 'period') {
            objectToSendApi.enabled = 'period'
            if (selectedType === 'onlyOneDay') {
              const { dateBegin, dateEnd } = convertDateOnlyDayFormat()
              objectToSendApi.end_date = dateEnd
              objectToSendApi.start_date = dateBegin
            } else {
              const { dateBeginToSendApi, dateEndToSendApi } = convertDateSpecifyFormat()
              objectToSendApi.end_date = dateEndToSendApi
              objectToSendApi.start_date = dateBeginToSendApi
            }
          } else {
            objectToSendApi.enabled = 'always'
          }
          if (objectToSendApi && objectToSendApi.voicemail_id && announcementSelected !== null) {
            saveSucceeded = await setOffHourObject(objectToSendApi)
          }

          break

        case 'redirect':
          if (textFilterRedirect) {
            objectToSendApi.redirect_to = textFilterRedirect
            setMissingAudiomessageAnnouncement(false)
          } else {
            setMissingAudiomessageAnnouncement(true)
            return
          }
          if (changeTypeDate === 'period') {
            objectToSendApi.enabled = 'period'
            if (selectedType === 'onlyOneDay') {
              const { dateBegin, dateEnd } = convertDateOnlyDayFormat()
              objectToSendApi.end_date = dateEnd
              objectToSendApi.start_date = dateBegin
            } else {
              const { dateBeginToSendApi, dateEndToSendApi } = convertDateSpecifyFormat()
              objectToSendApi.end_date = dateEndToSendApi
              objectToSendApi.start_date = dateBeginToSendApi
            }
          } else {
            objectToSendApi.enabled = 'always'
          }
          if (objectToSendApi && objectToSendApi.redirect_to) {
            saveSucceeded = await setOffHourObject(objectToSendApi)
          }

          break

        default:
          break
      }
    } else {
      let turnOffPhoneLinesObj = {
        calledIdNum: config.number.toString(),
        callerIdNum: config.callerNumber.toString(),
        enabled: 'never',
      }
      if (turnOffPhoneLinesObj) {
        saveSucceeded = await setOffHourObject(turnOffPhoneLinesObj)
      }
    }

    if (!saveSucceeded) {
      return
    }

    reloadPhoneLines()
    closeSideDrawer()
  }

  const [isAnnouncementLoaded, setAnnouncementLoaded]: any = useState(false)
  const [announcement, setAnnouncement]: any = useState({})
  const [announcementListError, setAnnouncementList] = useState('')

  //Get announcement information
  useEffect(() => {
    async function fetchLines() {
      if (firstRender) {
        setFirstRender(false)
        return
      }
      if (!isAnnouncementLoaded) {
        try {
          setAnnouncementList('')
          const res = await getAnnouncements()
          setAnnouncement(res)
        } catch (e) {
          console.error(e)
          setAnnouncementList(t('Lines.Cannot retrieve announcement') || '')
        }
        setAnnouncementLoaded(true)
      }
    }
    fetchLines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnnouncementLoaded, firstRender])

  function changeTextFilterVoiceMail(event: any) {
    const newTextFilter = event.target.value
    setTextFilterVoiceMail(newTextFilter)
  }

  function changeTextFilterRedirect(event: any) {
    const newTextFilter = event.target.value
    setTextFilterRedirect(newTextFilter)
  }

  const clearTextFilterVoiceMail = () => {
    setTextFilterVoiceMail('')
    textFilterVoiceMailRef.current.focus()
  }

  const clearTextFilterRedirect = () => {
    setTextFilterRedirect('')
    textFilterRedirectRef.current.focus()
  }

  async function playSelectedAnnouncement(announcementId: any) {
    if (announcementId) {
      playFileAudio(announcementId, 'announcement')
    }
  }

  function periodSelect() {
    return (
      <>
        <div className='px-5 pt-8 pb-2'>
          <div className='flex items-center justify-between mt-1'>
            <h4 className=' text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Lines.Select period')}
            </h4>
          </div>
          {/* Divider */}
          <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>
        </div>
        {/* Date input  */}
        <div className='mt-4 px-5'>
          {/* Date input select */}
          <fieldset>
            <legend className='sr-only'>Date range select</legend>
            <div className='space-y-4'>
              {contactTypeFilter.options.map((dateSelectionInput) => (
                <div key={dateSelectionInput.value} className='flex items-center'>
                  <input
                    id={dateSelectionInput.value}
                    name={`filter-${contactTypeFilter.id}`}
                    type='radio'
                    checked={dateSelectionInput.value === selectedType}
                    className={`h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight ${
                      selectedType === dateSelectionInput.value
                        ? 'dark:text-primaryDark dark:bg-primaryLight'
                        : 'dark:text-primaryDark dark:bg-gray-700'
                    } dark:border-gray-600 dark:focus:ring-primaryDark`}
                    onChange={changeTypeSelected}
                  />
                  <label
                    htmlFor={dateSelectionInput.value}
                    className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
                  >
                    {dateSelectionInput.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          {selectedType && selectedType !== 'always' && <>{dateInputFunction()}</>}
        </div>
      </>
    )
  }

  function announcementSelect() {
    return (
      <>
        {/* Select announcement */}
        <div className='px-5 pt-9'>
          <div className='flex items-center'>
            <FontAwesomeIcon
              icon={faBullhorn}
              className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
              aria-hidden='true'
            />
            <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Lines.Announcement')}
            </h4>
          </div>
          {/* Divider */}
          <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>
        </div>
        <div className='pt-4 px-5'>
          <div className='flex'>
            <select
              id='types'
              name='types'
              className='block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primary dark:focus:ring-primary dark:bg-gray-900'
              value={announcementSelected || ''}
              onChange={changeAnnouncementSelect}
            >
              {!announcementSelected && <option value=''>{t('Lines.Announcement select')}</option>}
              {Object.keys(announcement).map((key) => (
                <option key={key} value={announcement[key].id}>
                  {announcement[key].description}
                </option>
              ))}
            </select>
            <div className='ml-4 flex-shrink-0'>
              <Button
                variant='white'
                onClick={() => playSelectedAnnouncement(selectedAnnouncementInfo?.id)}
                disabled={!announcementSelected}
              >
                <FontAwesomeIcon
                  icon={faPlay}
                  className='h-4 w-4 mr-2 text-gray-500 dark:text-gray-500'
                  aria-hidden='true'
                />{' '}
                {t('Lines.Play')}
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  }

  function selectAnnouncementVoicemail() {
    return (
      <>
        {/* Announcement and voicemail switch */}
        <div className='px-5 pt-3'>
          <div className='flex items-center justify-between mt-6'>
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faVoicemail}
                className='mr-4 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                aria-hidden='true'
              />
              <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                {t('Lines.Announcement and voicemail')}
              </h4>
            </div>
          </div>

          {/* Divider */}
          <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>

          <div className='pt-4 pb-2'>
            <div className='flex'>
              <select
                id='types'
                name='types'
                className='block w-full rounded-md py-2 pl-3 pr-10 text-base focus:outline-none sm:text-sm border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600 dark:focus:border-primary dark:focus:ring-primary dark:bg-gray-900'
                value={announcementSelected || ''}
                onChange={changeAnnouncementSelect}
              >
                {!announcementSelected && (
                  <option value=''>{t('Lines.Announcement select')}</option>
                )}
                {Object.keys(announcement).map((key) => (
                  <option key={key} value={announcement[key].id}>
                    {announcement[key].description}
                  </option>
                ))}
              </select>
              <div className='ml-4 flex-shrink-0'>
                <Button
                  variant='white'
                  onClick={() =>
                    selectedAnnouncementInfo?.id
                      ? playSelectedAnnouncement(selectedAnnouncementInfo.id)
                      : playSelectedAnnouncement(announcementSelected)
                  }
                  disabled={!announcementSelected}
                >
                  <FontAwesomeIcon
                    icon={faPlay}
                    className='h-4 w-4 mr-2 text-gray-500 dark:text-gray-500'
                    aria-hidden='true'
                  />{' '}
                  {t('Lines.Play')}
                </Button>
              </div>
            </div>
          </div>
          <TextInput
            placeholder={t('Lines.Insert voicemail phone number') || ''}
            className='mt-4'
            value={textFilterVoiceMail}
            onChange={changeTextFilterVoiceMail}
            ref={textFilterVoiceMailRef}
            icon={textFilterVoiceMail.length ? faCircleXmark : undefined}
            onIconClick={() => clearTextFilterVoiceMail()}
            trailingIcon={true}
          />
        </div>
      </>
    )
  }

  function selectForward() {
    return (
      <>
        {/* Activate forward */}
        <div className='px-5 pt-3'>
          <div className='flex items-center justify-between mt-6'>
            <div className='flex items-center'>
              <FontAwesomeIcon
                icon={faTurnDown}
                className='mr-4 h-4 w-4 rotate-[270deg] flex-shrink-0 text-gray-400 dark:text-gray-500'
                aria-hidden='true'
              />
              <h4 className='text-base font-medium text-gray-700 dark:text-gray-200'>
                {t('Lines.Forward')}
              </h4>
            </div>
          </div>

          {/* Divider */}
          <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>

          <TextInput
            placeholder={t('Lines.Insert forward phone number') || ''}
            className='mt-4'
            value={textFilterRedirect}
            onChange={changeTextFilterRedirect}
            ref={textFilterRedirectRef}
            icon={textFilterRedirect.length ? faCircleXmark : undefined}
            onIconClick={() => clearTextFilterRedirect()}
            trailingIcon={true}
          />
        </div>
      </>
    )
  }

  //select typology configuration
  //it can be: audiomsg, audiomsg-voicemail, forward
  function typologyConfiguration() {
    return (
      <>
        {/* Typology title */}
        <div className='px-5 pt-8 pb-2'>
          <div className='flex items-center justify-between mt-1'>
            <h4 className=' text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Lines.Typology configuration')}
            </h4>
          </div>
          {/* Divider */}
          <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>
        </div>
        <div className='mt-4 px-5'>
          {/* Typology input select */}
          <fieldset>
            <legend className='sr-only'>Typology Configuration </legend>
            <div className='space-y-4'>
              {announcementTypologyConfiguration.options.map((typology) => (
                <div key={typology.value} className='flex items-center'>
                  <input
                    id={typology.value}
                    name={`filter-${announcementTypologyConfiguration.id}`}
                    type='radio'
                    checked={typology.value === selectedConfigurationTypology}
                    className={`h-4 w-4 border-gray-300 text-primary focus:ring-primaryLight ${
                      selectedConfigurationTypology === typology.value
                        ? 'dark:text-primaryDark dark:bg-primaryLight'
                        : 'dark:text-primaryDark dark:bg-gray-700'
                    } dark:border-gray-600 dark:focus:ring-primaryDark`}
                    onChange={changeAnnouncementTypologySelected}
                  />
                  <label
                    htmlFor={typology.value}
                    className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
                  >
                    {typology.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </>
    )
  }

  return (
    <>
      <DrawerHeader title={t('Lines.Line details')} />
      <div className={classNames(className)} {...props}>
        {/* Contact details */}
        <dl className='px-5'>
          <Divider />
          {/* Description */}
          {config.name && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                {t('Lines.Description')}
              </dt>
              <dd className='mt-1 text-sm sm:col-span-2 sm:mt-0 text-gray-900 dark:text-gray-100'>
                <div className='flex items-center text-sm'>
                  <span>{config.name}</span>
                </div>
              </dd>
            </div>
          )}

          {/* Line number */}
          {config.number && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                {t('Lines.Line number')}
              </dt>
              <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                <div className='flex items-center text-sm text-primary dark:text-primaryDark'>
                  <FontAwesomeIcon
                    icon={faPhone}
                    className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                    aria-hidden='true'
                  />
                  <span
                    className='truncate cursor-pointer hover:underline'
                    onClick={() =>
                      operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
                        ? transferCallToExtension(config?.number)
                        : callPhoneNumber(config?.number)
                    }
                  >
                    {config.number}
                  </span>
                </div>
              </dd>
            </div>
          )}

          {/* Caller number */}
          {config.callerNumber && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5'>
              <dt className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                {t('Lines.Caller number')}
              </dt>
              <dd className='mt-1 text-sm text-gray-900 dark:text-gray-100 sm:col-span-2 sm:mt-0'>
                <div className='flex items-center text-sm text-primary dark:text-primaryDark'>
                  <FontAwesomeIcon
                    icon={faPhone}
                    className='mr-2 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                    aria-hidden='true'
                  />
                  <span
                    className='truncate cursor-pointer hover:underline'
                    onClick={() => callPhoneNumber(config.callerNumber)}
                  >
                    {config.callerNumber}
                  </span>
                </div>
              </dd>
            </div>
          )}
        </dl>

        {/* Activate configuration */}
        <div className='px-5 pt-8'>
          <div className='flex items-center justify-between mt-1'>
            <h4 className=' text-base font-medium text-gray-700 dark:text-gray-200'>
              {t('Lines.Activate configuration')}
            </h4>
            <Switch on={isConfigurationActive} changed={() => toggleConfigurationActive()}></Switch>
          </div>

          {/* Divider */}
          <div className='mt-2 border-t border-gray-200 dark:border-gray-700'></div>
        </div>

        {/* configuration type select */}
        {isConfigurationActive && (
          <>
            {/* RULE SELECTION HIDDEN AT THE MOMENT */}
            {/* <fieldset className='mt-4 px-5'>
              <legend className='sr-only'>Configuration type</legend>
              <div className='space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10'>
                {configurationType.map((configuration) => (
                  <div key={configuration.id} className='flex items-center'>
                    <input
                      id={configuration.id}
                      name='configuration-type'
                      type='radio'
                      defaultChecked={configuration.id === 'customize'}
                      className='h-4 w-4 border-gray-300 text-primary dark:border-gray-600 focus:ring-primaryLight dark:focus:ring-primaryDark dark:text-primaryDark'
                      onChange={changeConfiguration}
                    />
                    <label
                      htmlFor={configuration.id}
                      className='ml-3 block text-sm font-medium leading-6 text-gray-700 dark:text-gray-200'
                    >
                      {configuration.value}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset> */}

            {/* Period select */}
            {periodSelect()}

            {/* Activate announcement field */}
            {typologyConfiguration()}
            {/* {changeConfigurationRadio === 'customize' ? customTypeSelected() : ruleTypeSelected()} */}

            {/* Choose which type of field you want to activate: */}
            {selectedConfigurationTypology === 'audiomsg' && <>{announcementSelect()}</>}

            {selectedConfigurationTypology === 'audiomsg_voicemail' && (
              <>{selectAnnouncementVoicemail()}</>
            )}

            {selectedConfigurationTypology === 'redirect' && <>{selectForward()}</>}

            {/* Upload error */}
            {missingAudiomessageAnnouncement && (
              <div className='px-5 pt-3'>
                <InlineNotification
                  title={t('Lines.Fill in all the fields to be able to continue')}
                  type='error'
                  className='mt-2'
                ></InlineNotification>
              </div>
            )}
          </>
        )}
        {/* Bottom button to Save or Cancel*/}
        <div className='px-5 pt-2'>
          <DrawerFooter
            cancelLabel={t('Common.Cancel') || ''}
            confirmLabel={t('Common.Save')}
            onConfirm={saveEditPhoneLines}
          />
        </div>
      </div>
    </>
  )
})

ShowPhoneLinesDrawerContent.displayName = 'ShowPhoneLinesDrawerContent'
