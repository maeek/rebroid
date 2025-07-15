export const sanitizePathForPathTraversal = (path?: string | null) => {
  return path === '/' ? path : path?.replace(/(\.\.)+\/?/gim, '') || ''
}
