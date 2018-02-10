/* eslint-env jest */
import fs from 'fs'
import path from 'path'
import sinon from 'sinon'
import Crawler from '../src/Crawler'
import Reporter from '../src/reporters/JSONReporter'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('Crawler', () => {
  let crawler
  let requestError
  let getMockResponse
  let calledOptions

  beforeEach(() => {
    getMockResponse = ({ uri }) => ({
      request: {
        href: uri
      }
    })
    calledOptions = []
    mockRequest.mockImplementation((options, cb) => {
      calledOptions.push(options)
      cb(requestError, getMockResponse(options))
    })
  })

  afterEach(() => {
    mockRequest.mockClear()
  })

  describe('with default params', () => {
    beforeEach(() => {
      crawler = new Crawler()
    })

    it('emits finish directly if called with empty seed', done => {
      crawler.seed([])
        .on('finish', reporter => {
          expect(reporter).toEqual(expect.any(Reporter))
          done()
        })
        .start()
    })

    it('puts in the right default userAgent', done => {
      crawler.seed('http://localhost/item1')
        .on('finish', () => {
          expect(calledOptions[0]).toEqual(expect.objectContaining({
            headers: {
              'User-Agent': 'AwesomeSearchBot'
            }
          }))
          done()
        })
        .start()
    })
  })

  it('we can set a userAgent', done => {
    crawler = new Crawler({ userAgent: 'Botty' })
    crawler.seed('http://localhost/item1')
      .on('finish', () => {
        expect(calledOptions[0]).toEqual(expect.objectContaining({
          headers: {
            'User-Agent': 'Botty'
          }
        }))
        done()
      })
      .start()
  })

  describe('app processing', () => {
    const TEST_URL = 'http://somewhere.com'
    let exampleHTML
    let headers

    beforeEach(() => {
      exampleHTML = '<html></html>'
      headers = { 'content-type': 'text/html' }
      getMockResponse = (options) => ({
        request: {
          href: options.uri
        },
        body: exampleHTML,
        headers: headers,
        statusCode: 202
      })
      crawler = new Crawler()
    })

    it('sends page body, response headers and url to process method of given app', done => {
      crawler.addApp({
        process: ({ url, body, headers }) => {
          expect(url.href).toEqual(TEST_URL)
          expect(body).toEqual(exampleHTML)
          expect(headers).toEqual(headers)
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => done())
        .start()
    })

    it('app without process method does not hurt', done => {
      crawler.addApp({
      })
      crawler.seed(TEST_URL)
        .on('finish', reporter => {
          expect(reporter.toJson()[TEST_URL]).toEqual({})
          done()
        })
        .start()
    })

    it('passes contentType and statusCode to apps process as well', done => {
      crawler.addApp({
        process: ({ contentType, statusCode }) => {
          expect(contentType).toEqual('text/html')
          expect(statusCode).toEqual(202)
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => done())
        .start()
    })

    it('passes the reporter to the process method', done => {
      crawler.addApp({
        process: ({ report }) => {
          expect(typeof report).toEqual('function')
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => done())
        .start()
    })

    it('passes a queueUrls method that can be used to path further links', done => {
      let callCount = 0
      crawler.addApp({
        process: ({ url, queueUrls }) => {
          if (callCount === 0) {
            expect(url.toString()).toEqual(TEST_URL)
          } else {
            expect(url.toString()).toEqual('http://moretotest.com')
          }
          queueUrls('http://moretotest.com')
          ++callCount
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => {
          expect(callCount).toEqual(2)
          done()
        })
        .start()
    })

    it('also passes jQuery like interface (using cheerio) to process method', done => {
      exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
      crawler.addApp({
        process: ({ $ }) => {
          expect($('h1').html()).toEqual('Hello World!')
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => done())
        .start()
    })

    it('does not provide jQuery interface when no app is asking for it', done => {
      exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
      crawler.addApp({
        contentType: 'html',
        noCheerio: true,

        process: ({ $ }) => {
          expect($).toBeUndefined()
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => done())
        .start()
    })

    it('process methods can return a promise', done => {
      let callCount = 0
      crawler.addApp({
        process: ({ queueUrls }) => {
          ++callCount
          if (callCount === 1) {
            return new Promise(function (resolve) {
              setTimeout(() => {
                queueUrls('http://go.here')
                resolve()
              })
            }, 10)
          }
        }
      })
      crawler.seed(TEST_URL)
        .on('finish', () => {
          expect(callCount).toEqual(2)
          done()
        })
        .start()
    })

    describe('#addApp', () => {
      it('can be also a function that receives additional config parameters', done => {
        crawler = new Crawler({
          userAgent: 'Somebot',
          foo: 'bar'
        })
        let callCount = 0
        const spy = jest.fn(() => ({
          process: () => { ++callCount }
        }))
        crawler.addApp(spy)

        expect(spy).toHaveBeenCalledWith({ foo: 'bar' })
        crawler.seed(TEST_URL)
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .start()
      })
    })

    describe('before the request', () => {
      it('the preRequest becomes additional url data', done => {
        let receivedUrl
        crawler.addApp({
          preRequest: (url) => {
            receivedUrl = url
          },

          process: () => {}
        })
        const urlData = { href: TEST_URL, foo: 'bar' }
        crawler.seed(urlData)
          .on('finish', () => {
            expect(receivedUrl).toEqual(expect.objectContaining(urlData))
            done()
          })
          .start()
      })

      it('we can add a preRequest callback to change request options', done => {
        let callCount = 0
        crawler.addApp({
          preRequest: (url) => {
            ++callCount
            url.update(url + `?foo`)
          },

          process: ({ url }) => {
            expect(url.toString()).toEqual(TEST_URL + '/?bar&foo')
          }
        })
        crawler.addApp({
          preRequest: (url) => {
            callCount += 10
            url.update(url + `&bar`)
          },

          process: ({ url }) => {
            expect(url.toString()).toEqual(TEST_URL + '/?bar&foo')
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(callCount).toEqual(11)
            expect(reporter.toJson()[TEST_URL + '/?bar&foo']).toEqual({})
            done()
          })
          .start()
      })

      it('an error within a preRequest is noted and prohibits request to be done', done => {
        let callCount = 0
        crawler.addApp({
          preRequest: () => {
            throw new Error('Thrown up')
          },

          process: () => {
            ++callCount
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(callCount).toEqual(0)
            expect(reporter.toJson()[TEST_URL]).toEqual({
              error: expect.objectContaining({
                type: 'AppError',
                message: `preRequest method failed because of Error: Thrown up`
              })
            })
            done()
          })
          .start()
      })

      it('can be used to make a preflight request (so it can return a promise)', done => {
        let callCount = 0
        crawler.addApp({
          preRequest: (url) => {
            expect(url.href).toEqual(TEST_URL)
            url.update(`${url.href}?foo`)
            ++callCount
            return Promise.resolve()
          },

          process: ({ url }) => {
            expect(url.toString()).toEqual(TEST_URL + '/?foo?bar')
          }
        })
        crawler.addApp({
          preRequest: (url) => {
            expect(url.href).toEqual(TEST_URL + '?foo')
            url.update(`${url.href}?bar`)
            callCount += 10
            return Promise.resolve()
          },

          process: ({ url }) => {
            expect(url.toString()).toEqual(TEST_URL + '/?foo?bar')
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(callCount).toEqual(11)
            expect(reporter.toJson()[TEST_URL]).toBeUndefined()
            expect(reporter.toJson()[TEST_URL + '/?foo?bar']).toEqual({})
            done()
          })
          .start()
      })

      it('a rejected promise within preRequest is noted and prohibits request to be done', done => {
        let callCount = 0
        crawler.addApp({
          preRequest: () => {
            return Promise.reject(new Error('DONT'))
          },

          process: () => {
            ++callCount
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(callCount).toEqual(0)
            expect(reporter.toJson()[TEST_URL]).toEqual({
              error: expect.objectContaining({
                type: 'AppError',
                message: `preRequest method failed because of Error: DONT`
              })
            })
            done()
          })
          .start()
      })
    })

    describe('processCatch', () => {
      it('is called if an error happens when process throws one', done => {
        let callCount = 0
        crawler.logger = { error: jest.fn() } // surpress error logging
        crawler.addApp({
          process: () => {
            throw new Error('BUMM')
          },

          processCatch: (err) => {
            ++callCount
            expect(err).toEqual(new Error('BUMM'))
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', () => {
            expect(callCount).toEqual(1)
            // it is still logged though
            expect(crawler.logger.error).toHaveBeenCalledTimes(1)
            done()
          })
          .start()
      })

      it('if no processCatch is defined, and a error is thrown it is just logged', done => {
        crawler.logger = { error: jest.fn() } // surpress error logging
        crawler.addApp({
          process: () => {
            throw new Error('BUMM')
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', () => {
            // it is still logged though
            expect(crawler.logger.error).toHaveBeenCalledTimes(1)
            done()
          })
          .start()
      })

      it('if no processCatch is defined, the error is reported with one line of stackTrace', () => {
        crawler.logger = { error: jest.fn() } // surpress error logging
        crawler.addApp({
          process: () => {
            throw new Error('BUMM')
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(reporter.toJson()).toEqual({
              [TEST_URL]: {
                'error': {
                  type: 'AppError',
                  message: 'process method failed because of Error: BUMM',
                  stackTrace: expect.stringMatching('at /Users/calamari/work/websearch/test/Crawler.spec.js:')
                }
              }
            })
          })
          .start()
      })
    })

    describe('having multiple apps', () => {
      it('only provide jQuery interface to apps who wants it', () => {
        exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
        crawler.addApp({
          contentType: 'html',
          noCheerio: true,

          process: ({ $ }) => {
            expect($).toBeUndefined()
          }
        })
        crawler.addApp({
          process: ({ $ }) => {
            expect($('h1').text()).toEqual('Hello World!')
          },

          processCatch: (err) => {
            expect(err).toBeUndefined()
          }
        })
        crawler.seed(TEST_URL).start()
      })
    })

    describe('reporting', () => {
      it('just include the processed urls if no special reports are added', done => {
        crawler.addApp({
          process: () => {}
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(reporter.toJson()).toEqual({
              [TEST_URL]: {}
            })
            done()
          })
          .start()
      })

      it('every app can include its information to be added to report', done => {
        crawler.addApp({
          process: ({ report }) => {
            report('test', 'FOO')
          }
        })
        crawler.addApp({
          process: ({ report }) => {
            report('infos', { 'great': 'stuff' })
          }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(reporter.toJson()).toEqual({
              [TEST_URL]: {
                'test': 'FOO',
                'infos': { 'great': 'stuff' }
              }
            })
            done()
          })
          .start()
      })

      it('does not call the same url with empty data when already appearing in report', done => {
        const stubReporter = { report: jest.fn() }
        crawler = new Crawler({
          reporter: stubReporter
        })
        crawler.addApp({
          process: ({ report }) => { report('foo', 'bar') }
        })
        crawler.seed(TEST_URL)
          .on('finish', reporter => {
            expect(stubReporter.report).toHaveBeenCalledTimes(1)
            done()
          })
          .start()
      })
    })

    describe('specifying a contentType', () => {
      it('is never called if the contentType mitmatches a given string', done => {
        let callCount = 0

        crawler.addApp({
          contentType: 'text/plain',

          process: ({ queueUrls }) => {
            expect('called').toEqual('be never called')
          }
        })
        crawler.addApp({
          contentType: 'text/html',

          process: ({ queueUrls }) => {
            ++callCount
          }
        })

        crawler.seed(TEST_URL)
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .start()
      })

      it('is never called if the contentType does not match one of multiple strings', done => {
        let callCount = 0

        crawler.addApp({
          contentType: ['text/plain', 'text/something'],

          process: ({ queueUrls }) => {
            expect('called').toEqual('be never called')
          }
        })
        crawler.addApp({
          contentType: ['text/plain', 'text/html'],

          process: ({ queueUrls }) => {
            ++callCount
          }
        })

        crawler.seed(TEST_URL)
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .start()
      })

      it('is never called if the contentType does not match a regex', done => {
        let callCount = 0

        crawler.addApp({
          contentType: /^html$/,

          process: ({ queueUrls }) => {
            expect('called').toEqual('be never called')
          }
        })
        crawler.addApp({
          contentType: /.*html.*/,

          process: ({ queueUrls }) => {
            ++callCount
          }
        })

        crawler.seed(TEST_URL)
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .start()
      })
    })
  })

  describe('testing methods using snapshots', () => {
    const TEST_HTML = `<html>
      <body>
        <p>lorem ipsum</p>
      </body>
    </html>`
    const TEST_URL = 'http://localhost/item_1'
    const SNAPSHOT_FILENAME = 'http---localhost-item_1'

    beforeEach(() => {
      getMockResponse = (options) => ({
        request: {
          href: options.uri
        },
        body: TEST_HTML,
        headers: {},
        statusCode: 202
      })

      crawler = new Crawler({
        snapshotDir: path.join(__dirname, 'snapshots/')
      })
      crawler.addApp({
        process: ({ body, $, report }) => {
          expect(body).toEqual(TEST_HTML)
          report('text', $('p').text())
        }
      })
    })

    afterEach(() => {
      // That specific snapshots
      return new Promise((resolve, reject) => {
        fs.unlink(path.join(__dirname, 'snapshots/'), () => {
          resolve()
        })
      })
    })

    describe('if there is no snapshot yet', () => {
      it('uses test method to make snapshots', done => {
        expect.assertions(3)
        crawler
          .on('finish', report => {
            expect(report.toJson()).toEqual({
              [TEST_URL]: {
                text: 'lorem ipsum'
              }
            })
            fs.readFile(path.join(__dirname, 'snapshots', SNAPSHOT_FILENAME), (_err, body) => {
              expect(JSON.parse(body).body).toEqual(TEST_HTML)
              done()
            })
          // TODO: check body with snapshot body
          })
          .test(TEST_URL)
      })
    })

    describe('if there is a snapshot already', () => {
      beforeEach(done => {
        const preCrawler = new Crawler({
          snapshotDir: path.join(__dirname, 'snapshots/')
        })
        preCrawler.on('finish', () => done())
          .test(TEST_URL)
      })

      it('uses the snapshop rather then doing a request', (done) => {
        expect.assertions(3)
        crawler
          .on('finish', report => {
            expect(report.toJson()).toEqual({
              [TEST_URL]: {
                text: 'lorem ipsum'
              }
            })
            fs.readFile(path.join(__dirname, 'snapshots', SNAPSHOT_FILENAME), (_err, body) => {
              expect(JSON.parse(body).body).toEqual(TEST_HTML)
              done()
            })
          // TODO: check body with snapshot body
          })
          .test(TEST_URL)
      })
    })
  })

  describe('benchmarking', () => {
    let clock
    beforeEach(() => {
      clock = sinon.useFakeTimers()
    })
    afterEach(() => {
      clock.restore()
    })

    it('if no benchmarking is wanted, benchmarkReport is null', () => {
      crawler = new Crawler()
      expect(crawler.benchmarkReport()).toEqual(null)
    })

    it('if benchmarking is requested, but we have done anything yet', () => {
      crawler = new Crawler({ benchmark: true })
      crawler.addApp({
        name: 'First App',
        process: () => {}
      })
      crawler.addApp({
        process: () => {}
      })
      expect(crawler.benchmarkReport()).toEqual([
        {
          name: 'First App',
          preRequest: { runs: 0, totalTime: 0, average: 0, times: [] },
          process: { runs: 0, totalTime: 0, average: 0, times: [] },
          totalTime: 0
        }, {
          name: 'App#2',
          preRequest: { runs: 0, totalTime: 0, average: 0, times: [] },
          process: { runs: 0, totalTime: 0, average: 0, times: [] },
          totalTime: 0
        }
      ])
    })

    it('if benchmarking is requested, and we have collected data of one run, it reports the seconds (and milliseconds resolution)', done => {
      crawler = new Crawler({ benchmark: true })
      crawler.addApp({
        name: 'First App',
        noCheerio: true,
        process: () => {
          return new Promise(resolve => {
            clock.tick(42)
            resolve()
          })
        }
      })
      crawler.addApp({
        noCheerio: true,
        preRequest: () => {
          return new Promise(resolve => {
            clock.tick(100.123456)
            resolve()
          })
        },
        process: () => {
          return new Promise(resolve => {
            clock.tick(1)
            resolve()
          })
        }
      })
      crawler
        .seed(['http://test.de'])
        .on('finish', () => {
          expect(crawler.benchmarkReport()).toEqual([
            {
              name: 'First App',
              preRequest: { runs: 0, totalTime: 0, average: 0, times: [] },
              process: { runs: 1, totalTime: 42, average: 42, times: [42] },
              totalTime: 42
            }, {
              name: 'App#2',
              preRequest: { runs: 1, totalTime: 100.123, average: 100.123, times: [100.123] },
              process: { runs: 1, totalTime: 1, average: 1, times: [1] },
              totalTime: 101.123
            }
          ])
          done()
        })
        .start()
    })

    it('adds times to benchmark although there is a promise rejected in preRequest', done => {
      crawler = new Crawler({ benchmark: true })
      crawler.addApp({
        name: 'First App',
        noCheerio: true,
        process: () => {
          return new Promise(resolve => {
            clock.tick(42)
            resolve(new Error('BAM'))
          })
        }
      })
      crawler.addApp({
        noCheerio: true,
        preRequest: () => {
          return new Promise((resolve, reject) => {
            clock.tick(100.123456)
            reject(new Error('BAM'))
          })
        },
        process: () => {
          return new Promise(resolve => {
            clock.tick(1)
            resolve()
          })
        }
      })
      crawler
        .seed(['http://test.de'])
        .on('finish', () => {
          expect(crawler.benchmarkReport()).toEqual([
            {
              name: 'First App',
              preRequest: { runs: 0, totalTime: 0, average: 0, times: [] },
              process: { runs: 0, totalTime: 0, average: 0, times: [] },
              totalTime: 0
            }, {
              name: 'App#2',
              preRequest: { runs: 1, totalTime: 100.123, average: 100.123, times: [100.123] },
              process: { runs: 0, totalTime: 0, average: 0, times: [] },
              totalTime: 100.123
            }
          ])
          done()
        })
        .start()
    })
  })
})
