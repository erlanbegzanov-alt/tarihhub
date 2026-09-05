import { describe, expect, it } from 'vitest'
import { safePhotoURL } from './safeUrl'

describe('safePhotoURL', () => {
  it('passes an https Google account photo through unchanged', () => {
    const url = 'https://lh3.googleusercontent.com/a/ACg8ocJ-abc123=s96-c'
    expect(safePhotoURL(url)).toBe(url)
  })

  it('passes an https Cloudinary URL through unchanged', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/q.jpg'
    expect(safePhotoURL(url)).toBe(url)
  })

  it('drops a URL on any other host', () => {
    expect(safePhotoURL('https://evil.example/track.gif?uid=1')).toBe('')
    expect(safePhotoURL('https://lh3.googleusercontent.com.evil.example/x')).toBe('')
  })

  it('drops non-https schemes', () => {
    expect(safePhotoURL('http://lh3.googleusercontent.com/a/x')).toBe('')
    expect(safePhotoURL('javascript:alert(1)')).toBe('')
    expect(safePhotoURL('data:image/png;base64,AAAA')).toBe('')
  })

  it('drops anything that is not a parseable URL string', () => {
    expect(safePhotoURL('')).toBe('')
    expect(safePhotoURL('not a url')).toBe('')
    expect(safePhotoURL(null)).toBe('')
    expect(safePhotoURL(undefined)).toBe('')
    expect(safePhotoURL(42)).toBe('')
    expect(safePhotoURL({})).toBe('')
  })

  it('drops an over-long URL even on an allowed host', () => {
    const long = `https://lh3.googleusercontent.com/${'a'.repeat(300)}`
    expect(safePhotoURL(long)).toBe('')
  })
})
