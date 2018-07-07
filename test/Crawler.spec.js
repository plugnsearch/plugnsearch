/* eslint-env jest */
const sinon = require('sinon')
const {
  CheerioLoader,
  Crawler,
  JSONReporter
} = require('../')

describe('Crawler', () => {
  let crawler
  let requestError
  let getMockResponse
  let mockRequester

  beforeEach(() => {
    getMockResponse = ({ uri }) => ({
      request: {
        href: uri
      }
    })
    mockRequester = {
      request: jest.fn(
        options => requestError ? Promise.reject(requestError) : Promise.resolve(getMockResponse(options))
      )
    }
  })

  describe('with default params', () => {
    beforeEach(() => {
      crawler = new Crawler({
        requester: mockRequester
      })
    })

    it('emits finish directly if called with empty seed', done => {
      crawler
        .on('finish', reporter => {
          expect(reporter).toEqual(expect.any(JSONReporter))
          done()
        })
        .seed([])
        .then(() => crawler.start())
    })

    it('crawler start returns a promise that reolves when finish is called', async () => {
      const reporter = await crawler.seed([]).then(() => crawler.start())
      expect(reporter).toEqual(expect.any(JSONReporter))
    })

    it('puts in the right default userAgent', done => {
      crawler
        .on('finish', () => {
          expect(mockRequester.request).toHaveBeenCalledWith(expect.objectContaining({
            headers: {
              'User-Agent': 'AwesomeSearchBot'
            }
          }))
          done()
        })
        .seed('http://localhost/item1')
        .then(() => crawler.start())
    })
  })

  describe('#seed', () => {
    beforeEach(() => {
      crawler = new Crawler({
        requester: mockRequester
      })
    })

    it('passes the crawler itself as param', done => {
      crawler
        .on('finish', reporter => {
          expect(reporter).toEqual(expect.any(JSONReporter))
          done()
        })
        .seed([])
        .then(c => c.start())
    })
  })

  it('we can set a userAgent', done => {
    crawler = new Crawler({ requester: mockRequester, userAgent: 'Botty' })
    crawler
      .on('finish', () => {
        expect(mockRequester.request).toHaveBeenCalledWith(expect.objectContaining({
          headers: {
            'User-Agent': 'Botty'
          }
        }))
        done()
      })
      .seed('http://localhost/item1')
      .then(() => crawler.start())
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
      crawler = new Crawler({
        requester: mockRequester
      })
    })

    it('sends page body, response headers and url to process method of given app', done => {
      crawler.addApp({
        process: ({ url, body, headers }) => {
          expect(url.href).toEqual(TEST_URL)
          expect(body).toEqual(exampleHTML)
          expect(headers).toEqual(headers)
        }
      })
      crawler
        .on('finish', () => done())
        .seed(TEST_URL)
        .then(() => crawler.start())
    })

    it('app without process method does not hurt', done => {
      crawler.addApp({
      })
      crawler
        .on('finish', reporter => {
          expect(reporter.toJson()[TEST_URL]).toEqual({})
          done()
        })
        .seed(TEST_URL)
        .then(() => crawler.start())
    })

    it('passes contentType and statusCode to apps process as well', done => {
      crawler.addApp({
        process: ({ contentType, statusCode }) => {
          expect(contentType).toEqual('text/html')
          expect(statusCode).toEqual(202)
        }
      })
      crawler
        .on('finish', () => done())
        .seed(TEST_URL)
        .then(() => crawler.start())
    })

    it('passes the reporter to the process method', done => {
      crawler.addApp({
        process: ({ report }) => {
          expect(typeof report).toEqual('function')
        }
      })
      crawler
        .on('finish', () => done())
        .seed(TEST_URL)
        .then(() => crawler.start())
    })

    it('loads app dependencies before the real app which can change the context', async () => {
      let callCount = 0
      const preApp = {
        process: ({ updateContext }) => {
          updateContext({ foo: 'bar' })
        }
      }

      crawler.addApp({
        dependencies: [preApp],
        process: ({ foo }) => {
          expect(foo).toEqual('bar')
          ++callCount
        }
      })

      await crawler
        .seed(TEST_URL)
        .then(() => crawler.start())
      expect(callCount).toEqual(1)
    })

    it('passes a queueUrls method that can be used to path further links', async () => {
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
      await crawler
        .seed(TEST_URL)
        .then(() => crawler.start())
      expect(callCount).toEqual(2)
    })

    it('also passes jQuery like interface (using cheerio) to process method', done => {
      exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
      crawler.addApp({
        dependencies: [CheerioLoader],
        process: ({ $ }) => {
          expect($('h1').html()).toEqual('Hello World!')
        }
      })
      crawler
        .on('finish', () => done())
        .seed(TEST_URL)
        .then(() => crawler.start())
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
      crawler
        .on('finish', () => done())
        .seed(TEST_URL)
        .then(() => crawler.start())
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
      crawler
        .on('finish', () => {
          expect(callCount).toEqual(2)
          done()
        })
        .seed(TEST_URL)
        .then(() => crawler.start())
    })

    describe('#addApp', () => {
      it('can be also a function that receives additional config parameters', done => {
        crawler = new Crawler({
          requester: mockRequester,
          userAgent: 'Somebot',
          foo: 'bar'
        })
        let callCount = 0
        const spy = jest.fn(() => ({
          process: () => { ++callCount }
        }))
        crawler.addApp(spy)

        expect(spy).toHaveBeenCalledWith({ foo: 'bar' })
        crawler
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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
        crawler
          .on('finish', () => {
            expect(receivedUrl).toEqual(expect.objectContaining(urlData))
            done()
          })
          .seed(urlData)
          .then(() => crawler.start())
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
        crawler
          .on('finish', reporter => {
            expect(callCount).toEqual(11)
            expect(reporter.toJson()[TEST_URL + '/?bar&foo']).toEqual({})
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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
        crawler
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
          .seed(TEST_URL)
          .then(() => crawler.start())
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
        crawler
          .on('finish', reporter => {
            expect(callCount).toEqual(11)
            expect(reporter.toJson()[TEST_URL]).toBeUndefined()
            expect(reporter.toJson()[TEST_URL + '/?foo?bar']).toEqual({})
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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
        crawler
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
          .seed(TEST_URL)
          .then(() => crawler.start())
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
        crawler
          .on('finish', () => {
            expect(callCount).toEqual(1)
            // it is still logged though
            expect(crawler.logger.error).toHaveBeenCalledTimes(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
      })

      it('if no processCatch is defined, and a error is thrown it is just logged', done => {
        crawler.logger = { error: jest.fn() } // surpress error logging
        crawler.addApp({
          process: () => {
            throw new Error('BUMM')
          }
        })
        crawler
          .on('finish', () => {
            // it is still logged though
            expect(crawler.logger.error).toHaveBeenCalledTimes(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
      })

      it('if no processCatch is defined, the error is reported with one line of stackTrace', () => {
        crawler.logger = { error: jest.fn() } // surpress error logging
        crawler.addApp({
          process: () => {
            throw new Error('BUMM')
          }
        })
        crawler
          .on('finish', reporter => {
            expect(reporter.toJson()).toEqual({
              [TEST_URL]: {
                'error': {
                  type: 'AppError',
                  message: 'process method failed because of Error: BUMM',
                  stackTrace: expect.stringMatching('test/Crawler.spec.js:')
                }
              }
            })
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
      })
    })

    describe('having multiple apps', () => {
      it('dependencies are loaded directly of apps defining them', () => {
        exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
        crawler.addApp({
          contentType: 'html',
          noCheerio: true,

          process: ({ $ }) => {
            expect($).toBeUndefined()
          }
        })
        crawler.addApp({
          dependencies: [CheerioLoader],
          process: ({ $ }) => {
            expect($('h1').text()).toEqual('Hello World!')
          },

          processCatch: (err) => {
            expect(err).toBeUndefined()
          }
        })
        crawler
          .seed(TEST_URL)
          .then(() => crawler.start())
      })
    })

    describe('reporting', () => {
      it('just include the processed urls if no special reports are added', done => {
        crawler.addApp({
          process: () => {}
        })
        crawler
          .on('finish', reporter => {
            expect(reporter.toJson()).toEqual({
              [TEST_URL]: {}
            })
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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
        crawler
          .on('finish', reporter => {
            expect(reporter.toJson()).toEqual({
              [TEST_URL]: {
                'test': 'FOO',
                'infos': { 'great': 'stuff' }
              }
            })
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
      })

      it('does not call the same url with empty data when already appearing in report', done => {
        const stubReporter = { report: jest.fn() }
        crawler = new Crawler({
          requester: mockRequester,
          reporter: stubReporter
        })
        crawler.addApp({
          process: ({ report }) => { report('foo', 'bar') }
        })
        crawler
          .on('finish', reporter => {
            expect(stubReporter.report).toHaveBeenCalledTimes(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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

        crawler
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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

        crawler
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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

        crawler
          .on('finish', () => {
            expect(callCount).toEqual(1)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
      })
    })

    describe('queueing URLS', () => {
      let urlQueue
      let urlQueueDone
      let itemsDone

      beforeEach(() => {
        urlQueue = []
        urlQueueDone = []
        itemsDone = 0
        crawler = new Crawler({
          requester: mockRequester,
          // a very simple but async queue implementation
          queue: {
            queue: (url) => {
              return new Promise(resolve => {
                setTimeout(() => {
                  if (urlQueueDone.indexOf(url.toString()) === -1) {
                    urlQueue.push(url.toString())
                    urlQueueDone.push(url.toString())
                  }
                  resolve()
                }, 10)
              })
            },
            normalizeUrl: x => x,
            getNextUrl: () => {
              const url = urlQueue.shift()
              if (url) ++itemsDone
              return Promise.resolve(url)
            }
          }
        })
      })

      it('we can call queue URLs multiple times and it will wait for all queues to be done', done => {
        expect.assertions(1)

        crawler.addApp({
          process: ({ url, queueUrls }) => {
            queueUrls('http://one.com')
            queueUrls('http://two.com')
            queueUrls('http://three.com')
          }
        })

        crawler
          .on('finish', () => {
            expect(itemsDone).toEqual(4)
            done()
          })
          .seed(TEST_URL)
          .then(() => crawler.start())
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
      crawler = new Crawler({
        requester: mockRequester
      })
      expect(crawler.benchmarkReport()).toEqual(null)
    })

    it('if benchmarking is requested, but we have done anything yet', () => {
      crawler = new Crawler({
        requester: mockRequester,
        benchmark: true
      })
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
      crawler = new Crawler({
        requester: mockRequester,
        benchmark: true
      })
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
        .seed(['http://test.de'])
        .then(() => crawler.start())
    })

    it('adds times to benchmark although there is a promise rejected in preRequest', done => {
      crawler = new Crawler({
        requester: mockRequester,
        benchmark: true
      })
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
        .seed(['http://test.de'])
        .then(() => crawler.start())
    })
  })
})
