// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later
import { FC, ComponentProps, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faParking, faPhone } from '@fortawesome/free-solid-svg-icons'
import { motion } from 'framer-motion'
import SlideCarousel from '../SlideCarousel'
import { Button } from '../common'
import { getParking } from '../../lib/park'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../store'
import { isEmpty } from 'lodash'
import { CountdownTimer } from '../Countdown'
import classNames from 'classnames'

export interface ParkCardsProps extends ComponentProps<'div'> {}
export const ParkCards: FC<ParkCardsProps> = ({ className }): JSX.Element => {
  const { t } = useTranslation()
  const currentUser = useSelector((state: RootState) => state.user)
  const parkingInfo = useSelector((state: RootState) => state.park)

  async function pickParking(parkingInfoDetails: any) {
    let parkingObjectInformations: any = {}
    if (!isEmpty(parkingInfoDetails) && !isEmpty(currentUser?.default_device)) {
      parkingObjectInformations = {
        parking: parkingInfoDetails?.parking,
        destId: currentUser?.default_device?.id,
      }
    }
    if (!isEmpty(parkingObjectInformations)) {
      try {
        await getParking(parkingObjectInformations)
        store.dispatch.park.setParkingCallTaken(true)
        // retrieveParksList()
      } catch (error) {
        console.error(error)
      }
    }
  }

  const [cardPressStates, setCardPressStates]: any = useState({})

  const animationControls: any = useRef(null)

  const nameText = useRef<null | HTMLDivElement>(null)

  const parkCardsData: any[] = Object.keys(parkingInfo.parks).map(
    (parkingKey: any, index: number) => {
      const parkingDetails: any = parkingInfo.parks[parkingKey]
      const handleButtonDown = () => {
        if (!cardPressStates[index]) {
          setCardPressStates((prevState: any) => ({
            ...prevState,
            [index]: true,
          }))
          animationControls.current = setTimeout(() => {
            longPressHandler(parkingDetails)
          }, 2000)
        }
      }

      const handleButtonUp = () => {
        setCardPressStates((prevState: any) => ({
          ...prevState,
          [index]: false,
        }))
        if (animationControls.current) {
          clearTimeout(animationControls.current)
        }
        resetAnimation()
      }

      const longPressHandler = (parkingDetails: any) => {
        pickParking(parkingDetails)
        resetAnimation()
      }

      const resetAnimation = () => {
        animationControls.current = null
      }

      if (!isEmpty(parkingDetails?.parkedCaller?.name)) {
        return {
          key: parkingKey,
          content: (
            <div
              key={parkingKey}
              className='border-b rounded-lg shadow-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-1 mt-2 relative flex items-center'
            >
              <div className='flex flex-col flex-grow '>
                <div className='flex items-center text-left truncate w-full'>
                  <FontAwesomeIcon
                    icon={faParking}
                    className='h-4 w-4 text-amber-600 dark:text-amber-600'
                    aria-hidden='true'
                  />
                  <span className='text-sm font-semibold text-gray-700 dark:text-gray-100 ml-2'>
                    {t('Parks.Parking')} {parkingDetails?.name}
                  </span>
                </div>
                <div className='flex'>
                  <span className='text-sm text-left text-gray-900 dark:text-gray-100 w-44 truncate tooltip-parked-user'>
                    <div className='scrolling-text-container' ref={nameText}>
                      {nameText?.current?.clientWidth && nameText?.current?.clientWidth > 180 ? (
                        <>
                          <div className='scrolling-text'>{parkingDetails?.parkedCaller?.name}</div>
                          <div className='scrolling-text'>{parkingDetails?.parkedCaller?.name}</div>
                        </>
                      ) : (
                        <>
                          <div>{parkingDetails?.parkedCaller?.name}</div>
                        </>
                      )}
                    </div>
                  </span>
                </div>
              </div>
              <div className='flex'>
                <CountdownTimer seconds={parkingDetails?.parkedCaller?.timeout} />
              </div>
              <div className='flex-grow' />
              <div
                className='relative w-20'
                onMouseDown={handleButtonDown}
                onMouseUp={handleButtonUp}
                onMouseLeave={handleButtonUp}
              >
                <Button
                  variant='white'
                  className='tooltip-parking-button w-full relative overflow-hidden'
                >
                  {/* Content stays static; the green progress runs underneath */}
                  <div className='relative z-10 flex items-center justify-center w-full'>
                    <FontAwesomeIcon
                      icon={faPhone}
                      className='h-4 w-4 mr-2 text-gray-500 dark:text-gray-200'
                    />
                    <span className={classNames('w-14', cardPressStates[index] ? 'text-gray-500 dark:text-gray-200' : '')}>
                      {t('Parks.Pick up')}
                    </span>
                  </div>

                  {/* Background animation (behind the content) */}
                  <motion.div
                    className='absolute top-0 left-0 h-full bg-emerald-500 z-0 rounded-md'
                    initial={{ width: 0 }}
                    animate={{
                      width: cardPressStates[index] ? '100%' : '0%',
                    }}
                    transition={{
                      duration: cardPressStates[index] ? 2 : 0.3,
                      ease: cardPressStates[index] ? 'linear' : 'easeOut',
                    }}
                  />
                </Button>
              </div>
            </div>
          ),
        }
      }
    },
  )

  return (
    <>
      {/* Divider */}
      <div className='relative pt-0.5'>
        <div className='absolute inset-0 flex items-center' aria-hidden='true'>
          <div className='w-full border-t border-layoutDivider dark:border-layoutDividerDark' />
        </div>
      </div>
      <div className='relative container z-0 w-[200rem] pl-2 flex h-16 border-b shadow-sm border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800'>
        <SlideCarousel
          cards={parkCardsData.map((card: any) => card?.content)}
          numberOfParkingNotEmpty={parkingInfo.notEmptyParking}
        />
      </div>
    </>
  )
}
ParkCards.displayName = 'ParkCards'
