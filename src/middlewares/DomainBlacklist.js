class UninterrstingError {}

/**
 * This middleware allows to define a domain blacklist, and prohibits crawling of
 * page of those domains.
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
