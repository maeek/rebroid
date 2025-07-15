'use client'
const supportedLanguages = ['en', 'pl']

export const selectLanguage = (language: string) => {
  if (supportedLanguages.includes(language)) {
    return language
  }
  const foundLanguage = supportedLanguages.find(lang => lang.startsWith(language))
  if (foundLanguage) {
    return foundLanguage
  }

  return 'en'
}
