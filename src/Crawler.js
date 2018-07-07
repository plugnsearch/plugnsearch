const EventEmitter = require('events')
const StackTraceParser = require('stacktrace-parser')
const isArray = require('lodash/isArray')

const checkContentType = require('./utils/checkContentType')
const SimpleURLQueue = require('./queues/SimpleURLQueue')
const JSONReporter = require('./reporters/JSONReporter')
const Requester = require('./requesters/Requester')

const callAppPreRequestsInSeries = (series, preRequestParams, reportTime) => Promise.all([series.reduce(
  (memo, app) => memo.then(() => {
    if (reportTime) reportTime.start()
    return app.preRequest && app.preRequest.apply(app, preRequestParams)
  }).then(result => {
    if (reportTime) {
      app.preRequest ? reportTime.end() : reportTime.skip()
    }
    return result
  }).catch(err => {
    if (reportTime) reportTime.end()
    throw err
  }),
  Promise.resolve([])
)])

module.exports = class Crawler extends EventEmitter {
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
     * The default Requester just takes the request options and returns a promise
     */
    requester = new Requester(),
    /**
     * Use this directory to put in snapshot files for test drive
     */
    snapshotDir = 'snapshots/',
    /**
     * If this is true, the Crawler keeps track of run times of all Apps, and will create a report at the end
     */
    benchmark = false,
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
    this.requester = requester
    this.snapshotDir = snapshotDir
    this.benchmarks = benchmark ? [] : null

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
    const appToAdd = typeof app === 'function'
      ? app(this.config)
      : app
    if (appToAdd.dependencies) {
      appToAdd.dependencies.forEach(depApp => this.addApp(depApp))
    }
    this.apps.push(appToAdd)
    if (this.benchmarks) {
      this.benchmarks.push({
        preRequestTimes: [],
        processTimes: [],
        runs: 0
      })
    }
    return this
  }

  async seed (urls) {
    await this.queue.queue(urls)
    return this
  }

  start () {
    this.tick()
    return new Promise((resolve) => {
      this.startPromiseResolver = resolve
    })
  }

  async tick () {
    const url = await this.queue.getNextUrl()
    if (!url) {
      this.emit('finish', this.reporter)
      if (this.startPromiseResolver) this.startPromiseResolver(this.reporter)
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
        return this.createRequest(requestOptions)
          // run all the process methods of registered apps
          .then(response => this.runApps(url, response))
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
    const appInterface = {
      report: (type, data) => this.reporter.report(url.normalizedHref, type, data)
    }
    return this.doBenchmarking('preRequestTimes', reportTime => callAppPreRequestsInSeries(preRequests, [url, requestOptions, appInterface], reportTime))
      // resolve with the final request options
      // Create the real request Options object now
      .then(() => ({
        ...requestOptions,
        uri: url.normalizedHref
      }))
  }

  // @private
  runApps (url, response) {
    let reportCalled = false
    const queuePromises = []
    let contextAddition = {}
    const context = {
      report: (type, data) => {
        this.reporter.report(url.toString(), type, data)
        reportCalled = true
      },
      url: url,
      body: response.body,
      headers: response.headers,
      statusCode: response.statusCode,
      contentType: (response.headers || {})['content-type'],
      queueUrls: (urls) => {
        queuePromises.push(this.queue.queue(urls))
      },
      response,
      updateContext: (ctx) => {
        contextAddition = { ...contextAddition, ...ctx }
      }
    }
    return Promise.all(this.doBenchmarking('processTimes', reportTime => (
      this.apps.map(app => {
        if (app.process && checkContentType(app.contentType, context.contentType)) {
          reportTime && reportTime.start()
          try {
            const result = app.process({
              ...context,
              ...contextAddition
            })
            if (result && result.constructor === Promise) {
              reportTime && reportTime.end()
              return result
            }
          } catch (err) {
            reportTime && reportTime.end()
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
        } else {
          reportTime && reportTime.skip()
        }
        // Finally wait for all the urls to be queued
        return Promise.all(queuePromises)
      })
    ))).then(() => {
      // make sure URL is noted in report
      if (!reportCalled) this.reporter.report(url.toString())
    })
  }

  // @private
  async createRequest (requestOptions) {
    try {
      return this.requester.request(requestOptions)
    } catch (err) {
      this.logError(err)
      throw err
    }
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

  doBenchmarking (methodType, cb) {
    let reportTime
    if (this.benchmarks) {
      let appIndex = 0
      let start
      let end
      reportTime = {
        start: () => {
          start = Math.round(process.hrtime()[1] / 1000) // make it ms
          end = null
        },
        end: () => {
          if (end) return // ignore duplicate calls
          end = Math.round(process.hrtime()[1] / 1000) // make it ms
          this.benchmarks[appIndex][methodType].push((end - start) / 1000)
          ++appIndex
        },
        skip: () => {
          ++appIndex
        }
      }
    }
    return cb(reportTime)
  }

  benchmarkReport () {
    if (this.benchmarks) {
      return this.benchmarks.map((benchmark, index) => {
        const app = this.apps[index]
        const preLength = benchmark.preRequestTimes.length
        const preSum = benchmark.preRequestTimes.reduce((m, a) => m + a, 0)
        const proLength = benchmark.processTimes.length
        const proSum = benchmark.processTimes.reduce((m, a) => m + a, 0)
        return {
          name: app.name || `App#${index + 1}`,
          preRequest: { runs: preLength || 0, totalTime: preSum || 0, average: preLength ? preSum / preLength : 0, times: benchmark.preRequestTimes },
          process: { runs: proLength || 0, totalTime: proSum || 0, average: proLength ? proSum / proLength : 0, times: benchmark.processTimes },
          totalTime: preSum + proSum
        }
      })
    }
    return null
  }
}
