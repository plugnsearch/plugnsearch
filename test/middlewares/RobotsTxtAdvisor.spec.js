/* eslint-env jest */
import Crawler from '../../src/Crawler'
import URL from '../../src/URL'
import RobotsTxtAdvisor from '../../src/middlewares/RobotsTxtAdvisor'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

const exampleTxt = `
User-agent: googlebot
Disallow:

User-agent: *
Disallow: /not-here/
`

describe('apps/RobotsTxtAdvisor', () => {
  let app
  let requestUrl
  let requestOptions
  let appInterface
  let calledOptions
  let requestError
  let getMockResponse
  let body

  beforeEach(() => {
    requestError = null
    body = exampleTxt
    getMockResponse = () => ({
      headers: {
        'content-type': 'plain/text'
      },
      body
    })
    calledOptions = []
    mockRequest.mockImplementation((options, cb) => {
      calledOptions.push(options)
      cb(requestError, getMockResponse(options))
    })
    requestUrl = new URL('http://localhost:8080/some/link')
    requestOptions = {
      headers: {
        'User-Agent': 'foobot'
      }
    }
    appInterface = { report: jest.fn() }
    app = new RobotsTxtAdvisor()
  })

  afterEach(() => {
    mockRequest.mockClear()
  })

  it('does nothing if uri is broken', () => {
    return expect(app.preRequest(new URL('something invalid'), {}, appInterface))
      .rejects.toEqual({})
  })

  it('requests the right robots.txt', () => {
    return expect(app.preRequest(requestUrl, requestOptions, appInterface)
      .then(() => calledOptions[0]))
      .resolves
      .toEqual(expect.objectContaining({
        uri: 'http://localhost:8080/robots.txt'
      }))
  })

  it('rejects request if bot is disallowed', () => {
    return expect(app.preRequest(
      new URL('http://localhost:8080/not-here/somewhere'),
      requestOptions,
      appInterface)
    ).rejects.toBeTruthy()
  })

  it('resolves if bot is allowed', () => {
    return expect(app.preRequest(
      new URL('http://localhost:8080/not-here/somewhere'),
      {
        headers: {
          'User-Agent': 'googlebot'
        }
      }, appInterface)
    ).resolves.toBeUndefined()
  })

  describe('if configured to log', () => {
    beforeEach(() => {
      app = new RobotsTxtAdvisor({ robotsTxtLogging: true })
    })

    it('rejects and logs the skip reason', () => {
      return expect(app.preRequest(
        new URL('http://localhost:8080/not-here/somewhere'),
        requestOptions,
        appInterface
      ).catch(() => appInterface.report)).resolves.toHaveBeenCalledWith(
        'skipped',
        `Bot foobot is disallowed from http://localhost:8080/not-here/somewhere`
      )
    })
  })

  describe('if there is no robots txt', () => {
    beforeEach(() => {
      requestError = 'NOT FOUND'
    })

    it('simply resolves', () => {
      return expect(app.preRequest(
        new URL('http://localhost:8080/not-here/somewhere'),
        requestOptions,
        appInterface)
      ).resolves.toBeUndefined()
    })
  })

  it('only does one request and remembers the robots txt for same domain', () => {
    return expect(app.preRequest(new URL('http://localhost:8080/not-hesre/somewhere'), requestOptions, appInterface)
    .then(app.preRequest(new URL('http://localhost:8080/somewhere'), requestOptions, appInterface))
    .then(app.preRequest(new URL('http://localhost:8079/somewhere-else'), requestOptions, appInterface))
    .then(app.preRequest(new URL('http://localhost:8079/somewhere-else'), requestOptions, appInterface))
    .then(() => calledOptions.length))
    .resolves.toEqual(2)
  })

  describe('integration test', () => {
    let crawler

    it('does not crawl pages the bot is forbidden to crawl by robots.txt', done => {
      crawler = new Crawler({ userAgent: 'foobot' })
      crawler.addApp(config => new RobotsTxtAdvisor(config))
      crawler
        .on('finish', () => {
          expect(calledOptions.length).toEqual(3)
          expect(calledOptions.map(x => x.uri)).not.toContain('http://localhost/not-here/something')
          done()
        })
        .seed(['http://localhost/item1', 'http://localhost/not-here/something', 'http://localhost/item3'])
        .then(() => crawler.start())
    })
  })
})
