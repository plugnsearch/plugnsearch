
/**
 * This middleware simply cycles through a list of provided user agents. The list
 * of agents is defined through the Crawler `userAgents` option
 */
module.exports = class RotateUserAgent {
  constructor (options) {
    this.name = 'RotateUserAgent'
    this.noCheerio = true

    this.appOptions = options
    this.index = 0
  }

  preRequest (url, requestOptions) {
    if (this.appOptions.userAgents && this.appOptions.userAgents.length) {
      requestOptions.headers['User-Agent'] = this.appOptions.userAgents[this.index]
      this.index = (this.index + 1) % this.appOptions.userAgents.length
    }
  }
}
