/* eslint-env jest */
import URL from '../src/URL'

describe('URL', () => {
  const VALID_URL = 'http://www.some.where'
  const INVALID_URL = 'http://www some.where'

  it('can be created from a string', () => {
    expect(new URL(VALID_URL).href).toEqual(VALID_URL)
  })

  it('can be created from an object containing an href', () => {
    const obj = {
      href: VALID_URL
    }
    expect(new URL(obj).href).toEqual(VALID_URL)
  })

  it('can be created from an object containing an href', () => {
    const urlObject = new URL(VALID_URL)
    expect(new URL(urlObject).href).toEqual(VALID_URL)
  })

  it('can have additional data attached', () => {
    const obj = {
      href: VALID_URL,
      depth: 10
    }
    expect(new URL(obj).depth).toEqual(10)
  })

  it('contains a normalized version of the URL', () => {
    expect(new URL(VALID_URL + '/').normalizedHref).toEqual('http://some.where')
  })

  it('returns the normalized href as string', () => {
    const url = new URL(VALID_URL + '/')

    expect(url.toString()).toEqual(url.normalizedHref)
    expect(url.valueOf()).toEqual(url.normalizedHref)
    expect(`${url}`).toEqual(url.normalizedHref)
  })

  it('an invalid URL is not isValid', () => {
    expect(new URL(INVALID_URL).isValid).toEqual(false)
  })

  it('can be changed afterwards', () => {
    const url = new URL(VALID_URL)

    url.update('http://new.url.com')

    expect(url.href).toEqual('http://new.url.com')
    expect(url.normalizedHref).toEqual('http://new.url.com')
  })
})
