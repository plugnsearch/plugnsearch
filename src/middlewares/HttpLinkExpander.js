import URL from '../URL'
import linkExtractor from '../utils/linkExtractor'

/**
 * Retrieves all http & https links from a website and adds them to the queue.
 * It won't find links outside an <a>-element and omits all non-http-links, like
 * mailto- or tel-links.
 */
export default class HTTPLinkExpander {
  name = 'HTTPLinkExpander'
  noCheerio = true

  constructor ({
    maxDepth = 0,
    maxDepthLogging = false,
    urlFilter = null
  } = {}) {
    this.maxDepth = maxDepth
    this.maxDepthLogging = maxDepthLogging
    this.urlFilter = urlFilter
  }

  process ({ body, url, queueUrls, report }) {
    return linkExtractor(body, url.href)
      .then(links => {
        const urls = links.map(link => link.url)
          .filter(url => url.indexOf('http') === 0)
          .filter(url => this.urlFilter ? this.urlFilter(url) : true)
        if (this.maxDepth) {
          if (this.maxDepth <= (url.depth || 0)) {
            if (this.maxDepthLogging) {
              report('skippedLinks', urls)
            }
            return
          }
          return queueUrls(urls.map(href => new URL({
            href,
            depth: (url.depth || 0) + 1
          })))
        } else {
          return queueUrls(urls)
        }
      })
  }
}
