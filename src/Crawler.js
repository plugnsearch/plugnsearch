import path from 'path'
import { spawn } from 'child_process'
import DomainCrawler from 'crawler'

import linkListToDomains from './utils/linkListToDomains'

const after = (result) => {
  if (result && result.constructor === Promise) {
    return result
  } else {
    return new Promise(function (resolve) {
      resolve(result)
    })
  }
}

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

  report () {
    return {
      crawledUrls: this.crawledLinks,
      urlsTodo: this.urlsToCrawl
    }
  }

  queueUrls (urls) {
    urls = this.removeCrawledUrls(urls)
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
              if (err) console.error(err)
              this.crawledLinks[url] = {
                err,
                status: res.statusCode
              }
              this.finishUrl(url)
              return done()
            }

            const params = [res.body, res.$, res.headers, url, res.statusCode]

            // First parsing the document
            after(this.app.parseDocument.apply(null, params))
              .then(result => {
                this.crawledLinks[url] = result
              })
              .then(() => {
                // Then expanding links
                return after(this.app.expandLinks.apply(null, params))
                .then(links => {
                  if (links) {
                    this.queueUrls(links.map(l => l.url))
                  }
                })
              })
              .then(() => {
                // Lastly marking the url as fetched
                this.finishUrl(url)
                done()
              })
              .catch(err => {
                this.logger.error(err)
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
