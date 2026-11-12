import 'server-only'

export const describeAccountSessionDevice = (header: unknown) => {
  const agent = typeof header === 'string' ? header.slice(0, 1024) : ''
  let browser = 'Unknown browser'
  if (/Edg(?:e|A|iOS)?\//i.test(agent)) browser = 'Edge'
  else if (/OPR\/|Opera\//i.test(agent)) browser = 'Opera'
  else if (/SamsungBrowser\//i.test(agent)) browser = 'Samsung Internet'
  else if (/Firefox\/|FxiOS\//i.test(agent)) browser = 'Firefox'
  else if (/Chrome\/|CriOS\//i.test(agent)) browser = 'Chrome'
  else if (/Safari\//i.test(agent)) browser = 'Safari'

  let operatingSystem = 'Unknown operating system'
  if (/Android/i.test(agent)) operatingSystem = 'Android'
  else if (/iPad|iPhone|iPod/i.test(agent)) operatingSystem = 'iOS'
  else if (/Windows/i.test(agent)) operatingSystem = 'Windows'
  else if (/CrOS/i.test(agent)) operatingSystem = 'ChromeOS'
  else if (/Macintosh|Mac OS X/i.test(agent)) operatingSystem = 'macOS'
  else if (/Linux/i.test(agent)) operatingSystem = 'Linux'

  return { browser, operatingSystem }
}
