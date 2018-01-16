import path from 'path'
import { spawn } from 'child_process'
import DomainCrawler from 'crawler'

import linkListToDomains from './utils/linkListToDomains'

const supportedProtocolRegex = /^https?:\/\//

export default class Crawler {
  constructor ({ name, connectionsPerDomain = 10, throttlePerDomain = 10, logger = console }) {
    this.name = name
    this.connectionsPerDomain = connectionsPerDomain
    this.throttlePerDomain = throttlePerDomain
    this.logger = logger

    // this.processes = {}
    this.domainCrawlers = {}
    this.urlsToCrawl = []
    this.crawledLinks = {}

    this.interface = {
      queueLinks: this.queueUrls.bind(this),
      postResults: this.storeResult.bind(this)
    }
  }

  crawl (urls, app) {
    this.app = app
    this.queueUrls(urls)
    return new Promise(resolve => {
      this.resolve = () => resolve(this.crawledLinks)
    })
  }

  removeCrawledUrls (urls) {
    return urls.filter(url => {
      if (this.crawledLinks[url]) return false
      return true
    })
  }

  removeUnsupportedUrls (urls) {
    return urls.filter(url => {
      const isSupported = supportedProtocolRegex.test(url)
      if (!isSupported) {
        this.crawledLinks[url] = {
          rejected: 'protocol not supported',
          protocol: url.split('/')[0]
        }
      }
      return isSupported
    })
  }

  report () {
    return {
      crawledUrls: this.crawledLinks,
      urlsTodo: this.urlsToCrawl
    }
  }

  storeResult (url, data) {
    this.crawledLinks[url] = data
  }

  queueUrls (urls) {
    urls = this.removeCrawledUrls(urls)
    urls = this.removeUnsupportedUrls(urls)
    this.urlsToCrawl = [...this.urlsToCrawl, ...urls]
    const domains = linkListToDomains(urls)
    Object.keys(domains).forEach(host => {
      if (!this.domainCrawlers[host]) {
        const dc = new DomainCrawler({
          maxConnection: this.connectionsPerDomain,
          rateLimit: this.throttlePerDomain,
          preRequest: (options, done) => {
            this.logger.info(`Fetching url ${options.uri}`)
            done()
          },
          callback: (err, res, done) => {
            const url = res.request.uri.href
            if (err || res.statusCode !== 200) {
              if (err) this.logger.error(`Error fetching URL "${url}"`, err)
              this.crawledLinks[url] = err ? {
                error: err
              } : {
                status: res.statusCode
              }
              this.finishUrl(url)
              return done()
            }

            const params = {
              url,
              body: res.body,
              $: res.$,
              headers: res.headers,
              statusCode: res.statusCode
            }
            // First parsing the document
            this.app.process(params, this.interface)
              .then(() => {
                this.finishUrl(url)
                done()
              })
              .catch(err => {
                this.logger.error(err.toString(), { stack: err.stack })
              })
          }
        })

        this.domainCrawlers[host] = dc
      }
      this.domainCrawlers[host].queue(domains[host])
    })
  }

  finishUrl (url) {
    this.urlsToCrawl.splice(this.urlsToCrawl.indexOf(url), 1)
    if (this.urlsToCrawl.length === 0) {
      this.resolve(this.report())
    }
  }
}
