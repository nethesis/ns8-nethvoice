// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState, ChangeEvent } from 'react'
import QRCodeStyling, {
  DrawType,
  TypeNumber,
  Mode,
  ErrorCorrectionLevel,
  DotType,
  CornerSquareType,
  CornerDotType,
  Options,
} from 'qr-code-styling'

import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { t } from 'i18next'

import { Button } from '../common'

interface QRCodeTypes {
  data: string
  showDownloadButton?: boolean
  customOptions?: Partial<Options>
}

export default function QRCode({ data, showDownloadButton = true, customOptions }: QRCodeTypes) {
  const defaultOptions: Options = {
    width: 300,
    height: 300,
    type: 'svg' as DrawType,
    data: data,
    image: '/navbar_logo.svg',
    margin: 2,
    qrOptions: {
      typeNumber: 0 as TypeNumber,
      mode: 'Byte' as Mode,
      errorCorrectionLevel: 'Q' as ErrorCorrectionLevel,
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 20,
      crossOrigin: 'anonymous',
    },
    dotsOptions: {
      color: '#222222',
      type: 'rounded' as DotType,
    },
    backgroundOptions: {
      color: 'white',
    },
    cornersSquareOptions: {
      color: '#222222',
      type: 'extra-rounded' as CornerSquareType,
    },
    cornersDotOptions: {
      color: '#222222',
      type: 'dot' as CornerDotType,
    },
  }

  const [options, setOptions] = useState<Options>(() => {
    // Merge default options with custom options, ensuring nested objects are properly merged
    const mergedOptions = { ...defaultOptions }

    if (customOptions) {
      Object.keys(customOptions).forEach((key) => {
        const optionKey = key as keyof Options
        const customValue = customOptions[optionKey]
        const defaultValue = defaultOptions[optionKey]

        if (customValue !== undefined) {
          if (
            typeof customValue === 'object' &&
            customValue !== null &&
            !Array.isArray(customValue) &&
            typeof defaultValue === 'object' &&
            defaultValue !== null &&
            !Array.isArray(defaultValue)
          ) {
            // Deep merge for nested objects
            mergedOptions[optionKey] = {
              ...defaultValue,
              ...customValue,
            } as any
          } else {
            // Direct assignment for primitive values
            mergedOptions[optionKey] = customValue as any
          }
        }
      })
    }

    return mergedOptions
  })
  const [qrCode] = useState<QRCodeStyling>(new QRCodeStyling(options))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      qrCode.append(ref.current)
    }
  }, [qrCode, ref])

  useEffect(() => {
    if (!qrCode) return
    qrCode.update(options)

    const moduleCount = (qrCode as any)?._qr?.getModuleCount?.()
    if (!moduleCount) return

    const quietZone = options.margin || 0
    const requestedSize = Math.min(options.width || 300, options.height || 300) - quietZone * 2
    const dotSize = Math.max(1, Math.ceil(requestedSize / moduleCount))
    const fittedSize = moduleCount * dotSize + quietZone * 2

    if (options.width !== fittedSize || options.height !== fittedSize) {
      setOptions((prevOptions) => ({
        ...prevOptions,
        width: fittedSize,
        height: fittedSize,
      }))
    }
  }, [qrCode, options])

  useEffect(() => {
    setOptions((options) => ({
      ...options,
      data: data,
    }))
  }, [data])

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex'>
        <div ref={ref} className='rounded-md overflow-hidden' />
      </div>
      {showDownloadButton && (
        <div>
          <Button variant='white' onClick={() => qrCode.download()}>
            <span>{t('Common.Download')}</span>
            <FontAwesomeIcon icon={faDownload} className='ml-2 h-4 w-4' />
          </Button>
        </div>
      )}
    </div>
  )
}
