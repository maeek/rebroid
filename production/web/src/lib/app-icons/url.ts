export const resolveAppIconUrl = (icon: string) => {
  if (icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon
  }

  return icon.startsWith('/') ? icon : `/${icon}`
}
