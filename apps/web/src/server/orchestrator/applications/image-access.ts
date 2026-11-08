import 'server-only'

// Runtime detection accepts third-party Redroid derivatives; authorization must use publisher identity.
export const isTrustedRedroidImage = (image: string) =>
  /^((docker\.io|index\.docker\.io)\/)?redroid\/redroid(?=[:@]|$)/i.test(image.trim())
