//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import { mockUserPhonesApi, mockUsersApi, REST } from './users-data'

test.describe('server error notifications', () => {
  test('show a fixed text instead of the message of a server error', async ({
    page,
    signedIn,
    mockApi,
  }) => {
    void signedIn
    mockUsersApi(mockApi)
    mockUserPhonesApi(mockApi)
    mockApi.on('GET', `${REST}/csv/csvexport`, {
      status: 500,
      json: { message: "SQLSTATE[HY000] [1045] Access denied for user 'asterisk'@'10.0.0.5'" },
    })

    await page.goto('./users/users')
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Export users to CSV' }).click()

    const toasts = page.getByTestId('toast-notifications')
    await expect(toasts.getByText('Cannot export the users')).toBeVisible()
    await expect(
      toasts.getByText('The server could not complete the request (error 500). Try again later.'),
    ).toBeVisible()
    await expect(toasts).not.toContainText('SQLSTATE')
    await expect(toasts).not.toContainText('Access denied')
  })
})
