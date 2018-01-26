import EventEmitter from 'events'
import normalizeUrl from 'normalize-url'
import isArray from 'lodash/isArray'

import URL from './URL'

export default class SimpleURLQueue extends EventEmitter {
  urlsDone = []
  urlsTodo = []

  constructor ({ skipDuplicates = true } = {}) {
    super()
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
    if (!url) return null
    this.urlsDone.push(url.normalizedHref)

    if (this.urlsTodo.length === 0) {
      this.emit('empty')
    }

    return url
  }
}
