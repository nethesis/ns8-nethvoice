import React from 'react'
import ReactSlider, { ReactSliderProps } from 'react-slider'
import cn from 'classnames'

export const RangeSlider = <T extends number | readonly number[]>(_props: ReactSliderProps<T>) => {
  const isVertical = _props.orientation === 'vertical'
  const isDisabled = Boolean(_props.disabled)

  return (
    <ReactSlider
      {..._props}
      renderThumb={(props, state) => (
        <div
          {...props}
          className={cn({
            'h-full': !isVertical,
            'w-full': isVertical,
            'aspect-square rounded-full text-xs flex items-center justify-center border': true,
            'cursor-grab bg-white border-gray-400 dark:bg-gray-600 dark:border-gray-300':
              !isDisabled,
            'cursor-not-allowed bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-500':
              isDisabled,
          })}
        ></div>
      )}
      renderTrack={(props, state) => {
        //check if there are multiple values
        const points = Array.isArray(state.value) ? state.value.length : null
        const isMulti = points && points > 0
        const isLast = isMulti ? state.index === points : state.index === 1
        const isFirst = state.index === 0
        return (
          <div
            {...props}
            className={cn({
              //use 1/4 height or width depending on the orientation and make sure to center it.
              'h-1/4 top-1/2 -translate-y-1/2': !isVertical,
              'w-1/4 left-1/2 -translate-x-1/2': isVertical,
              'rounded-full': true,
              'bg-gray-200 dark:bg-gray-700': isDisabled,
              'bg-gray-300 dark:bg-gray-100':
                !isDisabled && (isMulti ? isFirst || isLast : isLast),
              'bg-primaryLight dark:bg-primaryDark':
                !isDisabled && (isMulti ? !isFirst || !isLast : isFirst),
            })}
          ></div>
        )
      }}
    />
  )
}
