/* eslint-env jest */
import Crawler from '../../src/Crawler'
import URL from '../../src/URL'
import RotateUserAgent from '../../src/middlewares/RotateUserAgent'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('apps/RotateUserAgent', () => {
  let app
  let requestUrl
  let requestOptions

  beforeEach(() => {
    requestUrl = new URL('http://localhost')
    requestOptions = {
      headers: {
        'User-Agent': 'foobot'
      }
    }
  })

  it('uses always the same userAgent if userAgents is not defined', () => {
    app = new RotateUserAgent({})
    app.preRequest(requestUrl, requestOptions)

    expect(requestOptions.headers['User-Agent']).toEqual('foobot')
  })

  it('uses always the same userAgent if userAgents is just empty', () => {
    app = new RotateUserAgent({ userAgents: [] })
    app.preRequest(requestUrl, requestOptions)

    expect(requestOptions.headers['User-Agent']).toEqual('foobot')
  })

  it('cycles through userAgent if userAgents are defined', () => {
    app = new RotateUserAgent({ userAgents: ['A', 'AwesomeSearchBot', 'Botty'] })

    app.preRequest(requestUrl, requestOptions)
    expect(requestOptions.headers['User-Agent']).toEqual('A')

    app.preRequest(requestUrl, requestOptions)
    expect(requestOptions.headers['User-Agent']).toEqual('AwesomeSearchBot')

    app.preRequest(requestUrl, requestOptions)
    expect(requestOptions.headers['User-Agent']).toEqual('Botty')

    app.preRequest(requestUrl, requestOptions)
    expect(requestOptions.headers['User-Agent']).toEqual('A')
  })

  describe('integration test', () => {
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

    it('we can set multiple userAgents the crawler  cycles through', done => {
      crawler = new Crawler({ userAgents: ['Botty', 'GreatBot', 'VeryNiceBotIndeed'] })
      crawler.addApp(config => new RotateUserAgent(config))
      crawler.seed(['http://localhost/item1', 'http://localhost/item2', 'http://localhost/item3'])
        .on('finish', () => {
          expect(calledOptions[0]).toEqual(expect.objectContaining({
            headers: {
              'User-Agent': 'Botty'
            }
          }))

          expect(calledOptions[1]).toEqual(expect.objectContaining({
            headers: {
              'User-Agent': 'GreatBot'
            }
          }))

          expect(calledOptions[2]).toEqual(expect.objectContaining({
            headers: {
              'User-Agent': 'VeryNiceBotIndeed'
            }
          }))
          done()
        })
        .start()
    })
  })
})
