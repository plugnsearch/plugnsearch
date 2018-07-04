const URL = require('url').URL

module.exports = function linkListToDomains (urls) {
  return urls.reduce((result, url) => {
    const host = (new URL(url)).host
    if (!result[host]) result[host] = []
    result[host].push(url)
    return result
  }, {})
}
