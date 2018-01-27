import linkExtractor from '../utils/linkExtractor'

/**
 * Retrieves all http & https links from a website and adds them to the queue.
 * It won't find links outside an <a>-element and omits all non-http-links, like
 * mailto- or tel-links.
 */
export default class HTTPLinkExpander {
  name = 'HTTPLinkExpander'
  noCheerio = true

  process ({ body, url, queueUrls }) {
    return linkExtractor(body, url)
      .then(links => {
        const urls = links.map(link => link.url)
          .filter(url => url.indexOf('http') === 0)
        queueUrls(urls)
      })
  }
}
