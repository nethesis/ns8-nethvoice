import { FC } from 'react'

interface CallDurationProps {
  duration: number
  monoTimer?: boolean
}

export const CallDuration: FC<CallDurationProps> = ({ duration, monoTimer = false }) => {
  // Get the duration of the call in Human time
  function toDaysMinutesSeconds(totalSeconds: number) {
    const seconds = Math.floor(totalSeconds % 60)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600)
    const days = Math.floor(totalSeconds / (3600 * 24))

    const secondsStr = makeHumanReadable(seconds, 'second')
    const minutesStr = makeHumanReadable(minutes, 'minute')
    const hoursStr = makeHumanReadable(hours, 'hour')
    const daysStr = makeHumanReadable(days, 'day')

    return `${daysStr}${hoursStr}${minutesStr}${secondsStr}`.replace(/,\s*$/, '')
  }

  // Make the duration of the call in Human time
  function makeHumanReadable(num: number, singular: string) {
    return num > 0 ? num + (num === 1 ? ` ${singular}, ` : ` ${singular}s, `) : ''
  }

  // Format duration as HH:MM:SS
  function toTimerFormat(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)

    const pad = (num: number) => String(num).padStart(2, '0')
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  return (
    <div
      className={`text-sm text-secondaryNeutral dark:text-secondaryNeutralDark ${
        monoTimer ? 'font-mono' : ''
      }`}
    >
      {monoTimer
        ? !duration
          ? '00:00:00'
          : toTimerFormat(duration)
        : !duration
        ? '0 second'
        : toDaysMinutesSeconds(duration)}
    </div>
  )
}
