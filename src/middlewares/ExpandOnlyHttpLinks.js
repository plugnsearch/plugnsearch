import linkExtractor from '../utils/linkExtractor'

export default class ExpandOnlyHttpLinks {
  name = 'ExpandOnlyHttpLinks'
  noCheerio = true

  process ({ body, url, queueUrls }) {
    linkExtractor(body, url)
      .then(links => {
        const urls = links.map(link => link.url)
          .filter(url => url.indexOf('http') === 0)
        queueUrls(urls)
      })
  }
}
