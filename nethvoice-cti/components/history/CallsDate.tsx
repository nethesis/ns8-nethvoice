import { FC, useEffect, useState } from 'react'
import { formatDistance, getUnixTime, parse, toDate } from 'date-fns'
import { format } from 'date-fns-tz'
import { utcToZonedTime } from 'date-fns-tz'
import { enGB, it } from 'date-fns/locale'
import {
  formatDateLocIsAnnouncement,
  getCallTimeToDisplayIsAnnouncement,
  getTimeDifference,
} from '../../lib/dateTime'
import i18next from 'i18next'
import { UTCDate } from '@date-fns/utc'

interface CallsDateProps {
  call: any
  spaced?: boolean
  isInQueue?: boolean
  isInAnnouncement?: boolean
}

export const CallsDate: FC<CallsDateProps> = ({ call, spaced, isInQueue, isInAnnouncement }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('')

  // trasform the diff value to the format +hhmm or -hhmm
  const diffValueConversation = (diffValueOriginal: any) => {
    // determine the sign
    const sign = diffValueOriginal >= 0 ? '+' : '-'

    // convert hours to string and pad with leading zeros if necessary
    const hours = Math.abs(diffValueOriginal).toString().padStart(2, '0')

    // minutes are always '00'
    const minutes = '00'
    return `${sign}${hours}${minutes}`
  }

  // get the local timezone offset in the format +hhmm or -hhmm
  const getLocalTimezoneOffset = () => {
    let localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const now = new Date()
    const offset = format(now, 'xx', { timeZone: localTimezone })
    return offset
  }

  // get the difference between the local timezone and the timezone of the server
  const getDifferenceBetweenTimezone = (isInQueue: boolean) => {
    let differenceValueBetweenTimezone: any
    if (isInQueue) {
      differenceValueBetweenTimezone = getTimeDifference(true)
    } else {
      differenceValueBetweenTimezone = getTimeDifference(false)
    }

    let diffValueEditedFormat = diffValueConversation(differenceValueBetweenTimezone)
    return diffValueEditedFormat
  }

  const getHeader = (call: any, isInAnnouncement: boolean) => {
    let localTimeZone = getLocalTimezoneOffset()
    let differenceBetweenTimezone = ''
    if (isInQueue) {
      differenceBetweenTimezone = getDifferenceBetweenTimezone(true)
    } else {
      differenceBetweenTimezone = getDifferenceBetweenTimezone(false)
    }
    if (isInAnnouncement) {
      const dateParts = call?.date_creation.split('/')
      const timeParts = call?.time_creation.split(':')

      if (dateParts.length !== 3 || timeParts.length !== 3) {
        return 'Invalid date or time format'
      }

      const day = parseInt(dateParts[0], 10)
      const month = parseInt(dateParts[1], 10) - 1
      const year = parseInt(dateParts[2], 10)
      const hour = parseInt(timeParts[0], 10)
      const minute = parseInt(timeParts[1], 10)
      const second = parseInt(timeParts[2], 10)

      const utcDate = new UTCDate(year, month, day, hour, minute, second)

      return (
        <div className='font-poppins text-sm leading-4 font-normal text-gray-600 dark:text-gray-300 truncate'>
          {formatDistance(
            utcToZonedTime(utcDate, differenceBetweenTimezone),
            utcToZonedTime(new Date(), localTimeZone),
            {
              addSuffix: true,
              includeSeconds: true,
              locale: selectedLanguage === 'it' ? it : enGB,
            },
          )}
        </div>
      )
    } else {
      return (
        <div className='font-poppins text-sm leading-4 font-normal text-gray-600 dark:text-gray-300 truncate'>
          {formatDistance(
            utcToZonedTime(call?.time * 1000, differenceBetweenTimezone),
            utcToZonedTime(new Date(), localTimeZone),
            {
              addSuffix: true,
              includeSeconds: true,
              locale: selectedLanguage === 'it' ? it : enGB,
            },
          )}
        </div>
      )
    }
  }

  const getBody = (call: any, isInAnnouncement: boolean) => {
    let differenceBetweenTimezone = ''
    if (isInQueue) {
      differenceBetweenTimezone = getDifferenceBetweenTimezone(true)
    } else {
      differenceBetweenTimezone = getDifferenceBetweenTimezone(false)
    }

    if (isInAnnouncement) {
      return (
        <div className='font-poppins text-sm leading-4 font-normal text-gray-600 dark:text-gray-300 truncate'>
          ({formatDateLocIsAnnouncement(call)}{' '}
          {getCallTimeToDisplayIsAnnouncement(call, differenceBetweenTimezone)})
        </div>
      )
    } else {
      return (
        <div className='font-poppins text-sm leading-4 font-normal text-gray-600 dark:text-gray-300 truncate'>
          (
          {format(utcToZonedTime(call?.time * 1000, differenceBetweenTimezone), 'd MMM yyyy HH:mm')}
          )
        </div>
      )
    }
  }

  // check browser language and set the selected language
  useEffect(() => {
    if (i18next?.languages[0] !== '') {
      setSelectedLanguage(i18next?.languages[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18next?.languages[0]])

  return (
    <>
      <div className={`flex flex-col justify-center flex-shrink-0 ${spaced ? 'gap-1.5' : ''}`}>
        {getHeader(call, isInAnnouncement ? true : false)}
        {getBody(call, isInAnnouncement ? true : false)}
      </div>
    </>
  )
}
