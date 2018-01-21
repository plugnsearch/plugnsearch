class UninterrstingError {}

/**
 * This app is designed to reduce the amount of requests send out. It throttles
 * the send out requests to a maximum of one request per given time.
 * is defined through the Crawler `throttle` option
 */
export default class DomainBlacklist {
  name = 'DomainBlacklist'
  noCheerio = true

  constructor (options) {
    // this.blacklist = options
    this.blacklist = (options.blacklistedDomains || '')
      .split(' ')
      .map(text => new RegExp(text.replace('.', '\\.')))
  }

  preRequest ({ uri }) {
    if (this.blacklist.find(regex => regex.test(uri))) {
      return Promise.reject(new UninterrstingError())
    } else {
      return Promise.resolve()
    }
  }
}
