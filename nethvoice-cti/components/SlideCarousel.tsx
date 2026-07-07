import React, { useState, useEffect } from 'react'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import { Button } from './common'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons'

interface SliderCarouselProps {
  cards: any
  numberOfParkingNotEmpty: number
}

const SliderCarousel: React.FC<SliderCarouselProps> = ({ cards, numberOfParkingNotEmpty }) => {
  const spacedCards = cards.map((card: any, index: any) => (
    <div key={index} className=''>
      {card}
    </div>
  ))

  const ArrowButtonPrevious = ({ onClick, currentSlide }: any) => {
    return (
      <Button
        variant='primary'
        onClick={onClick}
        className={`${
          currentSlide === 0 ? 'hidden' : 'absolute top-1/2 left-0 transform -translate-y-1/2 z-10'
        }`}
      >
        <FontAwesomeIcon className='' icon={faChevronLeft} />
      </Button>
    )
  }

  const ArrowButtonNext = ({ onClick, currentSlide, slideCount }: any) => {
    const isLastSlide = currentSlide === numberOfParkingNotEmpty - 1

    return (
      <Button
        variant='primary'
        onClick={onClick}
        disabled={isLastSlide}
        className={`absolute top-1/2 right-0 transform -translate-y-1/2 ${
          isLastSlide ? 'invisible' : ''
        }`}
      >
        <FontAwesomeIcon className='' icon={faAngleRight} />
      </Button>
    )
  }

  const [numToShow, setNumToShow]: any = useState(
    window.innerWidth > 1024 ? 2 : window.innerWidth > 780 ? 2 : 1,
  )

  const settings = {
    className: 'w-[27.5rem] sm:w-[37rem] md:w-[40rem] lg:w-[38rem] xl:w-[50rem] 2xl:w-[86rem]',
    centerMode: false,
    centerPadding: '10px',
    slidesToShow: numToShow,
    speed: 500,
    slidesToScroll: 1,
    arrows: numToShow < numberOfParkingNotEmpty ? true : false,
    dots: false,
    infinite: false,
    initialSlide: 0,
    swipeToSlide: numToShow < numberOfParkingNotEmpty ? true : false,
    draggable: numToShow < numberOfParkingNotEmpty ? true : false,
    touchMove: numToShow < numberOfParkingNotEmpty ? true : false,
    swipe: numToShow < numberOfParkingNotEmpty ? true : false,
    prevArrow: <ArrowButtonPrevious />,
    nextArrow: <ArrowButtonNext />,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          arrows: numToShow < numberOfParkingNotEmpty && numberOfParkingNotEmpty > 2 ? true : false,
          slidesToShow: numToShow,
          swipeToSlide: numToShow < numberOfParkingNotEmpty ? true : false,
          infinite: false,
        },
      },
      {
        breakpoint: 900,
        settings: {
          arrows: numToShow < numberOfParkingNotEmpty && numberOfParkingNotEmpty > 2 ? true : false,
          slidesToShow: numToShow,
          swipeToSlide: numToShow < numberOfParkingNotEmpty ? true : false,
          infinite: false,
        },
      },
      {
        breakpoint: 780,
        settings: {
          arrows: numToShow < numberOfParkingNotEmpty && numberOfParkingNotEmpty > 2 ? true : false,
          slidesToShow: numToShow,
          swipeToSlide: numToShow < numberOfParkingNotEmpty ? true : false,
          infinite: false,
        },
      },
      {
        breakpoint: 600,
        settings: {
          arrows: numToShow < numberOfParkingNotEmpty && numberOfParkingNotEmpty > 1 ? true : false,
          slidesToShow: numToShow,
          swipeToSlide: numToShow < numberOfParkingNotEmpty ? true : false,
          infinite: false,
        },
      },
      {
        breakpoint: 320,
        settings: {
          arrows: numToShow < numberOfParkingNotEmpty && numberOfParkingNotEmpty > 1 ? true : false,
          slidesToShow: numToShow,
          swipeToSlide: numToShow < numberOfParkingNotEmpty ? true : false,
          infinite: false,
        },
      },
    ],
  }

  useEffect(() => {
    window.addEventListener('resize', () => {
      setNumToShow(window.innerWidth > 1024 ? 2 : window.innerWidth > 900 ? 2 : 1)
    })
  }, [])

  return (
    <Slider {...settings} variableWidth={true}>
      {spacedCards}
    </Slider>
  )
}

export default SliderCarousel
