// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from 'react'

export const useIsTruncated = <T extends HTMLElement>(text?: string) => {
  const ref = useRef<T>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  const checkTruncation = useCallback(() => {
    const element = ref.current
    if (!element) {
      return
    }
    setIsTruncated(element.scrollWidth > element.clientWidth)
  }, [])

  useEffect(() => {
    checkTruncation()

    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(checkTruncation)
    observer.observe(element)
    return () => observer.disconnect()
  }, [checkTruncation, text])

  return { ref, isTruncated }
}
