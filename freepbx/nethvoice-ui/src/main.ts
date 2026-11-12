//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { config as fontawesomeConfig } from '@fortawesome/fontawesome-svg-core'

import App from './App.vue'
import router from './router'
import i18n from './i18n'

fontawesomeConfig.autoAddCss = false

const app = createApp(App)

app.use(createPinia())
app.use(PiniaColada, {})
app.use(i18n)
app.use(router)

app.mount('#app')
