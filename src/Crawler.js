import EventEmitter from 'events'
import StackTraceParser from 'stacktrace-parser'
// import path from 'path'
// import { spawn } from 'child_process'
import request from 'request'
import cheerio from 'cheerio'
import isArray from 'lodash/isArray'

// import linkListToDomains from './utils/linkListToDomains'
import SimpleURLQueue from './SimpleURLQueue'
import Reporter from './Reporter'

const appUsesContentType = (app, contentType) => {
  if (!app.contentType) return true

  if (typeof app.contentType === 'string') return app.contentType === contentType

  if (isArray(app.contentType)) return app.contentType.indexOf(contentType) !== -1

  if (app.contentType.constructor === RegExp) return app.contentType.test(contentType)

  return false
}

export default class Crawler extends EventEmitter {
  constructor ({
    /**
     * Defines how much connections are allowed per domain
     */
    connectionsPerDomain = 1,
    /**
     * Defines how many milliseconds we should wait before hammering the same domain
     */
    throttlePerDomain = 1000,
    /**
     * Could be a list of userAgents, that the agents will be rotated
     */
    userAgent = 'AwesomeSearchBot',
    /**
     * Options for request, use what ever request allows
     */
    requestOptions = {},
    /**
     * This ignore the robots.txt file
     */
    ignoreRobotsTxt = false, // @TODO
    /**
     * Define the logger that we log to
     */
    logger = console,
    /**
     * Instance of somethign that has the interface of SimpleURLQueue and stores
     * the URLs we want to crawl
     */
    queue = new SimpleURLQueue(),
    /**
     * The Reporter should implement a report method, that we use to post useful infos
     * about crawled pages
     */
    reporter = new Reporter()
  } = {}) {
    super()
    this.connectionsPerDomain = connectionsPerDomain
    this.throttlePerDomain = throttlePerDomain
    this.requestOptions = requestOptions
    this.userAgent = userAgent
    this.reporter = reporter
    this.logger = logger

    this.apps = []
    this.queue = queue
  }

  addApp (app) {
    this.apps.push(app)
    return this
  }

  seed (urls) {
    this.queue.queue(urls)
    return this
  }

  start () {
    this.tick()
    return this
  }

  tick () {
    const url = this.queue.getNextUrl()
    if (!url) {
      this.emit('finish', this.reporter)
      return
    }
    this.createRequest(url, (err, response) => {
      if (err) {
        this.logError(err)
        this.tick()
      } else {
        this.runApps(response)
          .then(() => {
            this.reporter.report(url)
            this.tick()
          })
      }
    })
  }

  // @private
  runApps (response) {
    let $
    const params = {
      report: (type, data) => this.reporter.report(response.href, type, data),
      url: response.href,
      body: response.body,
      headers: response.headers,
      statusCode: response.statusCode,
      contentType: (response.headers || {})['Content-Type'],
      queueUrls: (urls) => this.queue.queue(urls),
      response
    }
    return Promise.all(this.apps.map(app => {
      if (!appUsesContentType(app, params.contentType)) {
        return Promise.resolve()
      }
      if (!app.noCheerio) {
        $ = cheerio.load(response.body)
      }
      try {
        const result = app.process(app.noCheerio ? params : {
          ...params,
          $
        })
        if (result && result.constructor === Promise) {
          return result
        }
      } catch (err) {
        this.logError(err)
        app.processCatch(err)
      }
      return Promise.resolve()
    }))
  }

  // @private
  createRequest (uri, cb) {
    const options = {
      uri,
      ...this.requestOptions,
      headers: {
        'User-Agent': this.showUserAgent(),
        ...(this.requestOptions.headers || {})
      }
    }

    request(options, cb)
  }

  // @private
  showUserAgent () {
    if (isArray(this.userAgent)) {
      const nextAgent = this.userAgent.shift()
      this.userAgent.push(nextAgent)
      return nextAgent
    }
    return this.userAgent
  }

  report () {
    return this.reporter.toJson()
  }

  storeResult (url, data) {
    this.crawledLinks[url] = data
  }

  // @private
  logError (err) {
    this.logger.error(err.toString() + '/n' + StackTraceParser.parse(err.stack).map(line => (
      `  at ${line.file}:${line.lineNumber}:${line.column}`
    )).join('/n'))
  }
}
