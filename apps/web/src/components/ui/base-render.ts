import * as React from 'react'

function getBaseRender(asChild: boolean | undefined, children: React.ReactNode) {
  return asChild && React.isValidElement(children) ? children : undefined
}

function getBaseChildren(asChild: boolean | undefined, children: React.ReactNode) {
  return getBaseRender(asChild, children) ? undefined : children
}

export { getBaseChildren, getBaseRender }
