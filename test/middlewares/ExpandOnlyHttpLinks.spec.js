/* eslint-env jest */
import Crawler from '../../src/Crawler'
import ExpandOnlyHttpLinks from '../../src/middlewares/ExpandOnlyHttpLinks'
import linkExtractor from '../../src/utils/linkExtractor'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))
jest.mock('../../src/utils/linkExtractor', () => jest.fn(() => Promise.resolve([
  { url: 'http://test.domain.one' },
  { url: 'https://secure.domain.two' },
  { url: 'mailto:someone@domain.three' },
  { url: 'tel:+11123456789' }
])))

describe('middlewares/ExpandOnlyHttpLinks', () => {
  let app

  beforeEach(() => {
    app = new ExpandOnlyHttpLinks()
  })

  it('gives the body to linkExtractor for getting the links', done => {
    expect.assertions(1)
    app.process({
      body: 'BODY',
      url: 'URL',
      queueUrls: () => {
        expect(linkExtractor).toHaveBeenCalledWith('BODY', 'URL')
        done()
      }
    })
  })

  it('only queues http & https urls', done => {
    expect.assertions(1)
    app.process({
      body: 'BODY',
      url: 'URL',
      queueUrls: (urls) => {
        expect(urls).toEqual(['http://test.domain.one', 'https://secure.domain.two'])
        done()
      }
    })
  })

  xdescribe('integration test', () => {
    let crawler
    let requestError
    let getMockResponse
    let calledOptions

    beforeEach(() => {
      jest.unmock('../../src/utils/linkExtractor')
      getMockResponse = ({ uri }) => (
        uri === 'http://localhost/item1'
          ? { body: `<html><a href="http://localhost/item42">link1</a><a href="http://localhost/item23">link2</a><a href="mailto:me@here.io">email me</a></html>` }
          : { body: '<html></html>' }
      )
      calledOptions = []
      mockRequest.mockImplementation((options, cb) => {
        calledOptions.push(options)
        cb(requestError, getMockResponse(options))
      })
    })

    afterEach(() => {
      mockRequest.mockClear()
    })

    // no clue how to test that properly
    it('follows all the http links on a page', done => {
      expect.assertions(1)
      crawler = new Crawler({})
      crawler.addApp(config => new ExpandOnlyHttpLinks(config))
      crawler.seed('http://localhost/item1')
        .on('finish', () => {
          expect(calledOptions.map(opt => opt.uri)).toEqual([
            'http://localhost/item1',
            'http://localhost/item42',
            'http://localhost/item23'
          ])

          done()
        })
        .start()
    })
  })
})
