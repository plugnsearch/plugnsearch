const isArray = require('lodash/isArray')

const URL = require('../URL')

/**
 * This queue is not really a quque, just offers the similar interface, but you cannot queue any more
 * items then originally are in
 */
module.exports = class SimpleURLQueue {
  urlsTodo = []

  constructor ({ seedUrls = [] } = {}) {
    this._initQueue(seedUrls)
  }

  _initQueue (href) {
    if (isArray(href)) {
      return href.forEach(u => this.queue(u))
    }

    this.urlsTodo.push(new URL(href))
  }

  queue () {
  }

  getNextUrl () {
    return Promise.resolve(this.urlsTodo.shift())
  }

  clear () {
    this.urlsTodo = []
  }
}
