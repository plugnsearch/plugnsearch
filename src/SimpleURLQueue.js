import { URL } from 'url'
import EventEmitter from 'events'
import normalizeUrl from 'normalize-url'
import isArray from 'lodash/isArray'

export default class SimpleURLQueue extends EventEmitter {
  urlsDone = []
  urlsTodo = []

  constructor ({ skipDuplicates = true } = {}) {
    super()
    this.skipDuplicates = skipDuplicates
  }

  queue (url) {
    if (isArray(url)) {
      return url.forEach(u => this.queue(u))
    }
    try {
      new URL(url) // eslint-disable-line
    } catch (e) {
      throw new Error(`Queued parameter '${url}' is not a valid URL.`)
    }
    const normalizedUrl = this.normalizeUrl(url)
    if (this.skipDuplicates &&
      (this.urlsDone.indexOf(normalizedUrl) !== -1 || this.urlsTodo.indexOf(normalizedUrl) !== -1)) {
      return
    }

    this.urlsTodo.push(normalizedUrl)
  }

  normalizeUrl (url) {
    // if you need this to have different options, just extend this class and override this method
    return normalizeUrl(url)
  }

  getNextUrl () {
    const url = this.urlsTodo.shift()
    if (!url) return null
    this.urlsDone.push(url)

    if (this.urlsTodo.length === 0) {
      this.emit('empty')
    }

    return url
  }
}
