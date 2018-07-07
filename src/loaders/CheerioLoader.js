const cheerio = require('cheerio')

/**
 * This adds cheerio to the context for all further apps to be used
 */
module.exports = {
  process ({ body, updateContext }) {
    updateContext({
      $: cheerio.load(body)
    })
  }
}
