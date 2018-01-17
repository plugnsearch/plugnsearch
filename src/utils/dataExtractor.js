import cheerio from 'cheerio'

export default (html, basePath = null) => {
  return new Promise(function (resolve) {
    const $ = cheerio.load(html)
    resolve({
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
  })
}