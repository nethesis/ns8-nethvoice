// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { useTranslation } from 'react-i18next'
import { setTheme } from '../../lib/darkTheme'

export const Theme = () => {
  const { t } = useTranslation()
  const { theme } = useSelector((state: RootState) => state.darkTheme)
  const authStore = useSelector((state: RootState) => state.authentication)

  const themeOptions = [
    {
      id: 'system',
      title: t('Settings.System'),
      description: t('Settings.Use light or dark theme according to system preferences'),
    },
    {
      id: 'light',
      title: t('Settings.Light'),
      description: '',
    },
    {
      id: 'dark',
      title: t('Settings.Dark'),
      description: '',
    },
  ]

  const onChangeTheme = (event: any) => {
    const newTheme = event?.target?.id
    setTheme(newTheme, authStore?.username)
  }

  return (
    <>
      <div className='py-6 px-4 sm:p-6 lg:pb-8'>
        <div>
          <h2 className='text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-6'>
            {t('Settings.Theme')}
          </h2>
        </div>

        <fieldset>
          <legend className='sr-only'>{t('Settings.Theme')}</legend>
          <div className='space-y-5'>
            {themeOptions.map((themeOption) => (
              <div key={themeOption?.id} className='relative flex items-start'>
                <div className='flex h-6 items-center'>
                  <input
                    id={themeOption?.id}
                    aria-describedby={`${themeOption?.id}-description`}
                    name='themeOption'
                    type='radio'
                    defaultChecked={themeOption?.id === theme}
                    onChange={onChangeTheme}
                    className='h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:text-primaryDark dark:focus:ring-primaryDark'
                  />
                </div>
                <div className='ml-3 text-sm leading-6'>
                  <label
                    htmlFor={themeOption?.id}
                    className='font-medium text-gray-900 dark:text-gray-100'
                  >
                    {themeOption?.title}
                  </label>
                  <p
                    id={`${themeOption?.id}-description`}
                    className='text-gray-500 dark:text-gray-400'
                  >
                    {themeOption?.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    </>
  )
}
