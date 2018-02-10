import normalizeUrl from 'normalize-url'
import isArray from 'lodash/isArray'

import URL from '../URL'

export default class SimpleURLQueue {
  urlsDone = []
  urlsTodo = []

  constructor ({ skipDuplicates = true } = {}) {
    this.skipDuplicates = skipDuplicates
  }

  queue (href) {
    if (isArray(href)) {
      return href.forEach(u => this.queue(u))
    }
    const url = new URL(href)
    if (!url.isValid) {
      throw new Error(`Queued parameter '${url.href}' is not a valid URL.`)
    }
    if (this.skipDuplicates &&
      (this.urlsDone.indexOf(url.normalizedHref) !== -1 || this.urlsTodo.findIndex(u => u.normalizedHref === url.normalizedHref) !== -1)) {
      return
    }

    this.urlsTodo.push(url)
  }

  normalizeUrl (url) {
    // if you need this to have different options, just extend this class and override this method
    return normalizeUrl(url)
  }

  getNextUrl () {
    const url = this.urlsTodo.shift()
    if (!url) return Promise.resolve(null) // eslint-disable-line prefer-promise-reject-errors
    this.urlsDone.push(url.normalizedHref)

    return Promise.resolve(url)
  }
}
