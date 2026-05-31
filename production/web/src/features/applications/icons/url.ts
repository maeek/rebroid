export const resolveAppIconUrl = (icon: string) => {
  if (icon.startsWith('data:')) {
    return icon
  }

  return icon.startsWith('/') ? icon : `/${icon}`
}
