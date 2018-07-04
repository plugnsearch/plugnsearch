const normalizeUrl = require('normalize-url')
const isArray = require('lodash/isArray')

const URL = require('../URL')

module.exports = class SimpleURLQueue {
  constructor ({ skipDuplicates = true } = {}) {
    this.urlsDone = []
    this.urlsTodo = []

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

  clear () {
    this.urlsDone = []
    this.urlsTodo = []
  }
}
