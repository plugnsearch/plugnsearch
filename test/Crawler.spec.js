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
      crawler = new Crawler({
        logger: {
          log: console.log,
          error: (err) => { throw err }
        }
      })
    })

    it('sends page body, response headers and url to process method of given app', done => {
      crawler.addApp({
        contentType: 'html',

        process: ({ url, body, headers }) => {
          expect(url).toEqual(TEST_URL)
          expect(body).toEqual(exampleHTML)
          expect(headers).toEqual(headers)
          done()
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('passes contentType and statusCode to apps process as well', done => {
      crawler.addApp({
        contentType: 'html',

        process: ({ contentType, statusCode }) => {
          expect(contentType).toEqual('text/html')
          expect(statusCode).toEqual(202)
          done()
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('passes the reporter to the process method', () => {
      crawler.addApp({
        contentType: 'html',

        process: ({ reporter }) => {
          expect(reporter).toBeInstanceOf(Reporter)
        }
      })
      crawler.seed(TEST_URL).start()
    })

    it('passes a queueUrls method that can be used to path further links', done => {
      let callCount = 0
      crawler.addApp({
        contentType: 'html',

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
        contentType: 'html',

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
          contentType: 'html',

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

    describe('specifying a contentType', () => {

    })
  })
})
