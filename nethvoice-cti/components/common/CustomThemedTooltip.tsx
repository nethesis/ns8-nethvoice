import React, { CSSProperties, FC } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { PositionStrategy, Tooltip } from 'react-tooltip'

interface CustomThemedTooltipProps {
  id: string
  place?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  float?: boolean
  noArrow?: boolean
  offset?: number
  clickableText?: string
  onClickableClick?: () => void
  positionStrategy?: PositionStrategy
}

export const CustomThemedTooltip: FC<CustomThemedTooltipProps> = ({
  id,
  place = 'bottom',
  className = '',
  float = false,
  noArrow = false,
  offset,
  clickableText,
  onClickableClick,
  positionStrategy,
}) => {
  const { theme } = useSelector((state: RootState) => state.darkTheme)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const tooltipStyle: CSSProperties = isDark
    ? {
        backgroundColor: 'rgb(243, 244, 246)',
        color: 'rgb(17, 24, 39)',
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: '1.25rem',
        padding: '0.375rem 0.625rem',
        maxWidth: '320px',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        borderRadius: '4px',
      }
    : {
        backgroundColor: 'rgb(31, 41, 55)',
        color: 'rgb(249, 250, 251)',
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: '1.25rem',
        padding: '0.375rem 0.625rem',
        maxWidth: '320px',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        borderRadius: '4px',
      }

  const renderText = (content: string) => {
    const lines = content.split('\n')
    if (lines.length === 1) {
      return content
    }
    return (
      <>
        {lines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </>
    )
  }

  const renderContent = (content: string) => {
    if (!clickableText || !onClickableClick) {
      return renderText(content)
    }

    return (
      <div>
        <div>{renderText(content)}</div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClickableClick()
          }}
          className='mt-1 text-textLinkInvert dark:text-textLinkInvertDark hover:text-textLinkInvertHover hover:dark:text-textLinkInvertHoverDark dark:hover:text-emerald-300 font-medium cursor-pointer transition-colors'
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
          }}
        >
          {clickableText}
        </button>
      </div>
    )
  }

  return (
    <Tooltip
      id={id}
      place={place}
      className={`pi-z-1000 [&_.react-tooltip-content-wrapper]:p-0 ${className}`}
      opacity={1}
      style={tooltipStyle}
      float={float}
      noArrow={noArrow}
      offset={offset}
      positionStrategy={positionStrategy}
      clickable
      render={({ content }) => renderContent(content || '')}
    />
  )
}
