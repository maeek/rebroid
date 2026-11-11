import { describe, expect, it } from 'vitest'
import { applicationImageAccessHeaders } from './image-access'

describe('application image access', () => {
  it('distinguishes a non-admin with both permissions from an administrator', () => {
    const permissions = {
      'applications:use-redroid-images': true,
      'applications:use-custom-images': true
    }
    expect(applicationImageAccessHeaders({ isPlatformAdmin: false, permissions })).toEqual({
      'x-rebroid-image-access': 'all'
    })
    expect(applicationImageAccessHeaders({ isPlatformAdmin: true, permissions })).toEqual({
      'x-rebroid-image-access': 'admin'
    })
    expect(applicationImageAccessHeaders({ isPlatformAdmin: false, permissions: {} })).toEqual({
      'x-rebroid-image-access': 'none'
    })
  })
})
