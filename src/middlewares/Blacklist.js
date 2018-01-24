class UninterrstingError {}

/**
 * This middleware allows to define a blacklist for domains and urls.
 * It prohibits crawling of any URL that matches its items.
 */
export default class Blacklist {
  name = 'DomainBlacklist'
  noCheerio = true

  constructor (options) {
    // this.blacklist = options
    this.blacklist = (options.blacklist || [])
      .map(item => typeof item === 'string' ? new RegExp(item.replace('.', '\\.')) : item)
  }

  preRequest ({ uri }) {
    if (this.blacklist.find(regex => regex.test(uri))) {
      return Promise.reject(new UninterrstingError())
    } else {
      return Promise.resolve()
    }
  }
}
