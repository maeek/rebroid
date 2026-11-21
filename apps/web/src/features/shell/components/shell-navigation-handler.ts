export type ShellNavigationHandler = (href: string, label: string) => void

export const handleShellLink =
  (navigate: ShellNavigationHandler | undefined, href: string, label: string) =>
  (event: { preventDefault: () => void }) => {
    if (!navigate) return
    event.preventDefault()
    navigate(href, label)
  }
