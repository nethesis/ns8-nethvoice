//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'

test.describe('integrations: external services', () => {
  test('explains where the services are configured without calling the API', async ({
    page,
    signedIn,
    mockApi,
  }) => {
    void signedIn

    await page.goto('./integrations/external-services')

    await expect(page.getByText('Configured in the NethServer administration')).toBeVisible()
    await expect(page.getByText('Voicemail transcription')).toBeVisible()
    expect(mockApi.calls.filter((call) => call.method !== 'GET')).toEqual([])
  })
})
