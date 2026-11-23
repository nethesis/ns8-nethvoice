// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef } from 'react'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

// Event listener hook
export const useEventListener = (
  eventName: string,
  handler: (data: any) => void,
  element = window,
) => {
  // Create a ref that stores handler
  const savedHandler = useRef<typeof handler>()
  // Update ref.current value if handler changes.
  // This allows our effect below to always get latest handler ...
  // ... without us needing to pass it in effect deps array ...
  // ... and potentially cause effect to re-run every render.
  useIsomorphicLayoutEffect(() => {
    savedHandler.current = handler
  }, [handler])
  useEffect(
    () => {
      // Make sure element supports addEventListener
      // On
      const isSupported = element && element.addEventListener
      if (!isSupported) return
      // Create event listener that calls handler function stored in ref
      // @ts-ignore
      const eventListener = (event) => savedHandler.current(event.detail)
      // Add event listener
      element.addEventListener(eventName, eventListener)
      // Remove event listener on cleanup
      return () => {
        element.removeEventListener(eventName, eventListener)
      }
    },
    [eventName, element], // Re-run if eventName or element changes
  )
}
