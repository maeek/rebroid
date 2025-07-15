'use client'

import dayjs from 'dayjs'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import backend from './backend'
import { selectLanguage } from './locales'

const i18nInstance = createInstance()

// eslint-disable-next-line @typescript-eslint/no-floating-promises
i18nInstance
  .use(backend)
  .use(initReactI18next)
  .init({
    lng: typeof window !== 'undefined' ? selectLanguage(navigator.language) : 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    load: 'currentOnly',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  })

dayjs.locale(i18nInstance.language)

export default i18nInstance
