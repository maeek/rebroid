export const requiredPasswordChangePath = '/account/required-password-change'

export const passwordChangeRedirectPath = ({
  passwordChangeRequired,
  pathname
}: {
  passwordChangeRequired: boolean
  pathname: string
}) => {
  if (passwordChangeRequired && pathname !== requiredPasswordChangePath) {
    return requiredPasswordChangePath
  }

  if (!passwordChangeRequired && pathname === requiredPasswordChangePath) {
    return '/apps'
  }

  return null
}
