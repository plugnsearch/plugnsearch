const cheerio = require('cheerio')

module.exports = function dataExtractor (html, basePath = null) {
  const $ = cheerio.load(html)
  return Promise.resolve({
    title: $('title').text(),
    description: $('meta[name=description]').attr('content'),
    robots: $('meta[name=robots]').attr('content'),
    canonical: $('link[rel=canonical]').attr('href'),
    jsonLd: $('script[type="application/ld+json"]')
      .map((i, el) => (
        JSON.parse($(el).html())
      ))
      .toArray()
  })
}
