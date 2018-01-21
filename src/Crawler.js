import EventEmitter from 'events'
import StackTraceParser from 'stacktrace-parser'
import request from 'request'
import cheerio from 'cheerio'
import isArray from 'lodash/isArray'

import checkContentType from './utils/checkContentType'
import SimpleURLQueue from './SimpleURLQueue'
import Reporter from './Reporter'

const callAppPreRequestsInSeries = (series, [params, appInterface]) => Promise.all([series.reduce(
  (memo, app) => memo.then(() => app.preRequest(params, appInterface)),
  Promise.resolve([])
)])

export default class Crawler extends EventEmitter {
  constructor ({
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
    reporter = new Reporter(),
    /**
     * More config that can be passed through to app
     */
    ...config
  } = {}) {
    super()
    this.config = config
    this.requestOptions = requestOptions
    this.userAgent = userAgent
    this.reporter = reporter
    this.logger = logger

    this.apps = []
    this.queue = queue
  }

  /**
   * Add an app to the crawler.
   * It can be either an plain object, having app specific method,
   * a instance of a class having the same methods, or
   * a factory method, that gets the config of the crawler to init your app
   */
  addApp (app) {
    if (typeof app === 'function') {
      this.apps.push(app(this.config))
    } else {
      this.apps.push(app)
    }
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
    this.runPrequests(this.createRequestOptions(url))
      // if prerequests errors out, note that down and go on
      .catch(err => {
        // If error has no name it probably is totally uninteresting to log
        if (err && err.name) {
          this.reporter.report(url, 'error', {
            type: 'AppError',
            message: `preRequest method failed because of ${err.toString()}`,
            stackTrace: StackTraceParser.parse(err.stack).slice(0, 1).map(line => (
              `at ${line.file}:${line.lineNumber}:${line.column}`
            )).join('/n')
          })
        }
        this.tick()
      })
      // Do the real request
      .then(requestOptions => {
        this.createRequest(requestOptions)
        // run all the process methods of registered apps
        .then(response => this.runApps(response))
        // make sure URL is noted in report
        .then(() => this.reporter.report(requestOptions.uri))
        // if fail or success, we process the next URL
        .then(() => this.tick())
        .catch(() => this.tick())
      })
  }

  // @private
  createRequestOptions (uri) {
    return {
      uri,
      ...this.requestOptions,
      headers: {
        'User-Agent': this.showUserAgent(),
        ...(this.requestOptions.headers || {})
      }
    }
  }

  // @private
  runPrequests (requestOptions) {
    const preRequests = this.apps
      .filter(app => app.preRequest)
    const appInterface = {
      report: (type, data) => this.reporter.report(requestOptions.uri, type, data)
    }
    return callAppPreRequestsInSeries(preRequests, [requestOptions, appInterface])
      // resolve with the final request options
      .then(() => requestOptions)
  }

  // @private
  runApps (response) {
    let $
    const params = {
      report: (type, data) => this.reporter.report(response.request.href, type, data),
      url: response.request.href,
      body: response.body,
      headers: response.headers,
      statusCode: response.statusCode,
      contentType: (response.headers || {})['content-type'],
      queueUrls: (urls) => this.queue.queue(urls),
      response
    }
    return Promise.all(this.apps.filter(app => app.process).map(app => {
      if (!checkContentType(app.contentType, params.contentType)) {
        return Promise.resolve()
      }
      if (!app.noCheerio && !$) {
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
        if (app.processCatch) {
          app.processCatch(err)
        } else {
          this.reporter.report(response.request.href, 'error', {
            type: 'AppError',
            message: `process method failed because of ${err.toString()}`,
            stackTrace: StackTraceParser.parse(err.stack).slice(0, 1).map(line => (
              `at ${line.file}:${line.lineNumber}:${line.column}`
            )).join('/n')
          })
        }
      }
      return Promise.resolve()
    }))
  }

  // @private
  createRequest (requestOptions, cb) {
    return new Promise((resolve, reject) => {
      request(requestOptions, (err, response) => {
        if (err) {
          this.logError(err)
          reject(err)
        } else {
          resolve(response)
        }
      })
    })
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
