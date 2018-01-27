import { URL } from 'url'
import dataExtractor from '../utils/dataExtractor'
import linkExtractor from '../utils/linkExtractor'

export default class SitemapGenerator {
  name = 'SitemapGenerator'
  noCheerio = true

  process ({ body, url, queueUrls, report }) {
    return dataExtractor(body)
      .then(meta => {
        report('meta', meta)
      })
      .then(() => linkExtractor(body, url.href))
      .then(links => {
        links.map(link => link.url)
          .forEach(newUrl => {
            const thisHost = (new URL(url)).host
            try {
              if ((new URL(newUrl)).host === thisHost) {
                queueUrls(newUrl)
              } else {
                report('skippedLinks', { [newUrl]: 'different domain' })
              }
            } catch (e) {
              // log broken URL
              report('skippedLinks', { [newUrl]: 'looks broken' })
            }
          })
      })
  }
}
