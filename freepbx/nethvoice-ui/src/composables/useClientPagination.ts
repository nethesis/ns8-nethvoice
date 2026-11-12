//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { computed, ref, watch, type Ref } from 'vue'
import { DEFAULT_PAGE_SIZE, paginate } from '@/lib/common'

export function useClientPagination<T>(items: Readonly<Ref<T[]>>) {
  const pageNum = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)

  const page = computed(() => paginate(items.value, pageNum.value, pageSize.value))

  watch(pageSize, () => {
    pageNum.value = 1
  })

  watch(
    () => items.value.length,
    (total) => {
      if ((pageNum.value - 1) * pageSize.value >= total) {
        pageNum.value = Math.max(1, Math.ceil(total / pageSize.value))
      }
    },
  )

  return { pageNum, pageSize, page }
}
