/* eslint-env jest */
import Crawler from '../../src/Crawler'
import HttpLinkExpander from '../../src/middlewares/HttpLinkExpander'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('middlewares/HttpLinkExpander integration test', () => {
  let crawler
  let requestError
  let getMockResponse
  let calledOptions

  beforeEach(() => {
    getMockResponse = ({ uri }) => (
      uri === 'http://localhost/item1'
        ? { body: `<html><a href="http://localhost/item42">link1</a><a href="http://localhost/item23">link2</a><a href="mailto:me@here.io">email me</a></html>`, request: { href: uri } }
        : { body: '<html></html>', request: { href: uri } }
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

  it('follows all the http links on a page', done => {
    expect.assertions(1)
    crawler = new Crawler({})
    crawler.addApp(config => new HttpLinkExpander(config))
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

  describe('when having maxDepth defined', () => {
    beforeEach(() => {
      getMockResponse = ({ uri }) => ({
        body: `<html><a href="${uri}1">new link</a></html>`,
        request: { href: uri }
      })
    })

    it('follows links up until certain depth', done => {
      expect.assertions(2)
      crawler = new Crawler({ maxDepth: 2, maxDepthLogging: true })
      crawler.addApp(config => new HttpLinkExpander(config))
      crawler.seed('http://localhost/item1')
        .on('finish', reporter => {
          expect(calledOptions.map(opt => opt.uri)).toEqual([
            'http://localhost/item1',
            'http://localhost/item11',
            'http://localhost/item111'
          ])

          expect(reporter.toJson()).toEqual(expect.objectContaining({
            'http://localhost/item111': {
              skippedLinks: [ 'http://localhost/item1111' ]
            }
          }))

          done()
        })
        .start()
    })
  })
})
