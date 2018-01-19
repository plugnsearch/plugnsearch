/* eslint-env jest */
import Crawler from '../src/Crawler'
import Reporter from '../src/Reporter'

let mockRequest = jest.fn()
// jest.mock('request-promise-native', () => mockRequest)
// jest.mock('request', () => (options) => Promise.resolve(mockRequest(options)))
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('Crawler', () => {
  let crawler
  let requestError
  let getMockResponse
  let calledOptions

  beforeEach(() => {
    getMockResponse = () => ({})
    mockRequest.mockImplementation((options, cb) => {
      calledOptions = options
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

    it('emits finish directly if called with empty seed', () => {
      const spy = jest.fn()
      crawler.seed([])
        .on('finish', spy)
        .start()

      expect(spy).toHaveBeenCalledWith(expect.any(Reporter))
    })

    it('puts in the right default userAgent', () => {
      crawler.seed('http://localhost/item1')
        .start()

      expect(calledOptions).toEqual(expect.objectContaining({
        headers: {
          'User-Agent': 'AwesomeSearchBot'
        }
      }))
    })
  })

  it('we can set a userAgent', () => {
    crawler = new Crawler({ userAgent: 'Botty' })
    crawler.seed('http://localhost/item1')
      .start()

    expect(calledOptions).toEqual(expect.objectContaining({
      headers: {
        'User-Agent': 'Botty'
      }
    }))
  })

  it('we can set multiple userAgents it uses and cycles through', () => {
    crawler = new Crawler({ userAgent: ['Botty', 'GreatBot', 'VeryNiceBotIndeed'] })
    crawler.seed('http://localhost/item1').start()

    expect(calledOptions).toEqual(expect.objectContaining({
      headers: {
        'User-Agent': 'Botty'
      }
    }))

    crawler.seed('http://localhost/item2').start()

    expect(calledOptions).toEqual(expect.objectContaining({
      headers: {
        'User-Agent': 'GreatBot'
      }
    }))

    crawler.seed('http://localhost/item3').start()

    expect(calledOptions).toEqual(expect.objectContaining({
      headers: {
        'User-Agent': 'VeryNiceBotIndeed'
      }
    }))
  })

  describe('app processing', () => {
    const TEST_URL = 'http://somewhere.com'
    let exampleHTML
    let headers

    beforeEach(() => {
      exampleHTML = '<html></html>'
      headers = { 'Content-Type': 'text/html' }
      getMockResponse = (options) => ({
        href: options.uri,
        body: exampleHTML,
        headers: headers,
        statusCode: 202
      })
      crawler = new Crawler()
    })

    it('sends page body, response headers and url to process method of given app', () => {
      crawler.addApp({
        process: ({ url, body, headers }) => {
          expect(url).toEqual(TEST_URL)
          expect(body).toEqual(exampleHTML)
          expect(headers).toEqual(headers)
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('passes contentType and statusCode to apps process as well', () => {
      crawler.addApp({
        process: ({ contentType, statusCode }) => {
          expect(contentType).toEqual('text/html')
          expect(statusCode).toEqual(202)
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('passes the reporter to the process method', () => {
      crawler.addApp({
        process: ({ report }) => {
          expect(typeof report).toEqual('function')
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('passes a queueUrls method that can be used to path further links', done => {
      let callCount = 0
      crawler.addApp({
        process: ({ url, queueUrls }) => {
          if (callCount === 0) {
            expect(url).toEqual(TEST_URL)
          } else {
            expect(url).toEqual('http://moretotest.com')
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

    it('also passes jQuery like interface (using cheerio) to process method', () => {
      exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
      crawler.addApp({
        process: ({ $ }) => {
          expect($('h1').html()).toEqual('Hello World!')
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('does not provide jQuery interface when no app is asking for it', () => {
      exampleHTML = '<html><body><h1>Hello World!</h1></body></html>'
      crawler.addApp({
        contentType: 'html',
        noCheerio: true,

        process: ({ $ }) => {
          expect($).toBeUndefined()
        }
      })
      crawler.seed(TEST_URL).start()
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
    })

    describe('specifying a contentType', () => {
      it('is never called if the contentType mitmatches a given string', () => {
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

        crawler.seed(TEST_URL).start()
        expect(callCount).toEqual(1)
      })

      it('is never called if the contentType does not match one of multiple strings', () => {
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

        crawler.seed(TEST_URL).start()
        expect(callCount).toEqual(1)
      })

      it('is never called if the contentType does not match a regex', () => {
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

        crawler.seed(TEST_URL).start()
        expect(callCount).toEqual(1)
      })
    })
  })
})
