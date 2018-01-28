import EventEmitter from 'events'
import fs from 'fs'
import path from 'path'
import StackTraceParser from 'stacktrace-parser'
import request from 'request'
import cheerio from 'cheerio'
import isArray from 'lodash/isArray'

import checkContentType from './utils/checkContentType'
import SimpleURLQueue from './SimpleURLQueue'
import JSONReporter from './reporters/JSONReporter'

const callAppPreRequestsInSeries = (series, preRequestParams) => Promise.all([series.reduce(
  (memo, app) => memo.then(() => app.preRequest.apply(app, preRequestParams)),
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
    reporter = new JSONReporter(),
    /**
     * Use this directory to put in snapshot files for test drive
     */
    snapshotDir = 'snapshots/',
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
    this.snapshotDir = snapshotDir

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

  test (testUrl) {
    this.queue.queue(testUrl)
    this.snapshotFile = path.join(this.snapshotDir, testUrl.replace(/[^a-zA-Z0-9_]/g, '-'))
    // Use a clean and simple JSONReporter for testing
    this.reporter = new JSONReporter()
    this.tick(true)
  }

  tick (isTestRun) {
    const url = this.queue.getNextUrl()
    if (!url) {
      this.emit('finish', this.reporter)
      return
    }
    this.runPrequests(url, this.createRequestOptions())
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
        // This means, we just catched an error in preRequest
        if (!requestOptions) return
        return this.createRequest(requestOptions, isTestRun)
        // run all the process methods of registered apps
        .then(response => this.runApps(url, response))
        // make sure URL is noted in report
        .then(() => this.reporter.report(requestOptions.uri))
        // if fail or success, we process the next URL
        .then(() => this.tick())
        .catch(() => this.tick())
      })
  }

  // @private
  createRequestOptions (url) {
    return {
      ...this.requestOptions,
      headers: {
        'User-Agent': this.showUserAgent(),
        ...(this.requestOptions.headers || {})
      }
    }
  }

  // @private
  runPrequests (url, requestOptions) {
    const preRequests = this.apps
      .filter(app => app.preRequest)
    const appInterface = {
      report: (type, data) => this.reporter.report(url.normalizedHref, type, data)
    }
    return callAppPreRequestsInSeries(preRequests, [url, requestOptions, appInterface])
      // resolve with the final request options
      // Create the real request Options object now
      .then(() => ({
        ...requestOptions,
        uri: url.normalizedHref
      }))
  }

  // @private
  runApps (url, response) {
    let $
    const params = {
      report: (type, data) => this.reporter.report(url.toString(), type, data),
      url: url,
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
          this.reporter.report(url.toString(), 'error', {
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
  createRequest (requestOptions, isTestRun) {
    return new Promise((resolve, reject) => {
      // This part really feels, that it should not belong in the real Crawler implementation,
      // but I don't know where it should go else. For now it works and helps. So lets see…
      if (isTestRun) {
        fs.readFile(this.snapshotFile, (err, snapResponse) => {
          if (err) {
            request(requestOptions, (err, response) => {
              if (err) {
                this.logError(err)
                reject(err)
              } else {
                fs.writeFile(this.snapshotFile, JSON.stringify({
                  body: response.body,
                  headers: response.headers,
                  statusCode: response.statusCode,
                  contentType: (response.headers || {})['content-type']
                }), (err) => {
                  if (err) {
                    this.logError(err)
                  }
                  resolve(response)
                })
              }
            })
          } else {
            const response = JSON.parse(snapResponse)
            resolve({
              body: response.body,
              headers: response.headers,
              statusCode: response.statusCode,
              contentType: response.contentType
            })
          }
        })
      } else {
        request(requestOptions, (err, response) => {
          if (err) {
            this.logError(err)
            reject(err)
          } else {
            resolve(response)
          }
        })
      }
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
