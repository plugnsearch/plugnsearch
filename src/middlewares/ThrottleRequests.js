const util = require('util')

const sleep = util.promisify(setTimeout)

/**
 * This middleware reduces the amount of requests send out. It throttles
 * the send out requests to a maximum of one request per given time.
 * is defined through the Crawler `throttle` option
 */
module.exports = class ThrottleRequests {
  name = 'ThrottleRequests'
  noCheerio = true

  constructor (options) {
    this.appOptions = options
    this.nextRequest = 0
  }

  preRequest () {
    if (!this.appOptions.throttle) return Promise.resolve()

    if (this.nextRequest <= Date.now()) {
      this.nextRequest = Date.now() + this.appOptions.throttle
      return Promise.resolve()
    }

    const timeDifference = this.nextRequest - Date.now()
    return sleep(timeDifference)
      .then(() => {
        this.nextRequest = Date.now() + this.appOptions.throttle
      })
  }
}
