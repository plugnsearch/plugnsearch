/* eslint-env jest */
import Crawler from '../../src/Crawler'
import URL from '../../src/URL'
import Blacklist from '../../src/middlewares/Blacklist'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('middlewares/Blacklist', () => {
  let app

  describe('resolves with any domain if blacklist is empty', () => {
    beforeEach(() => {
      app = new Blacklist({})
    })

    it('resolves with any domain', () => {
      return expect(app.preRequest(new URL('http://something-great.com')))
        .resolves.toEqual()
    })
  })

  describe('having something in the blacklist', () => {
    beforeEach(() => {
      app = new Blacklist({
        blacklist: [
          'heutetanzen.de',
          'amaz.n.com',
          /bob/
        ]
      })
    })

    it('resolves with another domain', () => {
      return expect(app.preRequest(new URL('http://something-great.com/is-awesome')))
        .resolves.toEqual()
    })

    it('rejects if a string matches', () => {
      return expect(app.preRequest(new URL('http://www.heutetanzen.de')))
        .rejects.toEqual({})
    })

    it('is not ambigious', () => {
      return expect(app.preRequest(new URL('http://amazon.com/is-awesome')))
        .resolves.toEqual()
    })

    it('rejects if a string matches', () => {
      return expect(app.preRequest(new URL('http://www.amaz.n.com')))
        .rejects.toEqual({})
    })

    it('rejects if a regex matches', () => {
      return expect(app.preRequest(new URL('http://somewhere.it/is/called-bobby')))
        .rejects.toEqual({})
    })
  })

  xdescribe('integration test', () => {
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
      crawler = new Crawler({ blacklist: ['localhost'] })
      crawler.addApp(config => new Blacklist(config))
      crawler.seed(['http://localhost/item1', 'http://localhorst/item2', 'http://localhost/item3'])
        .on('finish', () => {
          expect(calledOptions.length).toEqual(1)
          expect(calledOptions.map(x => x.uri)).not.toContain('http://localhorst/item2')
          done()
        })
        .start()
    })
  })
})
