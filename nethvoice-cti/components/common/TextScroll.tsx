// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState, useEffect } from 'react'

interface TextScrollProps {
  text: string
}

const TextScroll: React.FC<TextScrollProps> = ({ text }) => {
  const [scrollText, setScrollText] = useState(false)

  useEffect(() => {
    if (text.length > 25) {
      setScrollText(true)
    } else {
      setScrollText(false)
    }
  }, [text])

  return (
    <>
      {scrollText ? (
        <div className='text-container overflow-hidden relative max-w-full'>
          <div className='text-wrapper text-sm font-medium leading-5 animate-scroll'>
            <span className='whitespace-nowrap'>{text}</span>
            <span className='ml-8 whitespace-nowrap'>{text}</span>
          </div>
          <style jsx>{`
            @keyframes scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
            .animate-scroll {
              animation: scroll 8s linear infinite;
              display: inline-block;
            }
            .text-container:hover .animate-scroll {
              animation-play-state: paused;
            }
          `}</style>
        </div>
      ) : (
        <div className='text-sm font-medium leading-5 truncate'>
          <span className='whitespace-nowrap'>{text}</span>
        </div>
      )}
    </>
  )
}

export default TextScroll
