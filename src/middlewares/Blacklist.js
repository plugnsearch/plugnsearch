class UninterrstingError {}

/**
 * This middleware allows to define a blacklist for domains and urls.
 * It prohibits crawling of any URL that matches its items.
 */
module.exports = class Blacklist {
  constructor (options) {
    this.name = 'DomainBlacklist'

    this.blacklist = (options.blacklist || [])
      .map(item => typeof item === 'string' ? new RegExp(item.replace('.', '\\.')) : item)
  }

  preRequest (url) {
    if (this.blacklist.find(regex => regex.test(url.href))) {
      return Promise.reject(new UninterrstingError())
    } else {
      return Promise.resolve()
    }
  }
}

module.exports.UninterrstingError = UninterrstingError
