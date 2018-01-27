/* eslint-env jest */
import Crawler from '../../src/Crawler'
import HttpLinkExpander from '../../src/middlewares/HttpLinkExpander'
import linkExtractor from '../../src/utils/linkExtractor'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))
jest.mock('../../src/utils/linkExtractor', () => jest.fn(() => Promise.resolve([
  { url: 'http://test.domain.one' },
  { url: 'https://secure.domain.two' },
  { url: 'mailto:someone@domain.three' },
  { url: 'tel:+11123456789' }
])))

describe('middlewares/HttpLinkExpander', () => {
  let app

  beforeEach(() => {
    app = new HttpLinkExpander()
  })

  it('gives the body to linkExtractor for getting the links', done => {
    expect.assertions(1)
    app.process({
      body: 'BODY',
      url: { href: 'URL' },
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
      url: { href: 'URL' },
      queueUrls: (urls) => {
        expect(urls).toEqual(['http://test.domain.one', 'https://secure.domain.two'])
        done()
      }
    })
  })

  describe('when adding maxDepth parameter', () => {
    beforeEach(() => {
      app = new HttpLinkExpander({ maxDepth: 3 })
    })

    it('adds a depth field to added urls', done => {
      expect.assertions(3)
      app.process({
        body: 'BODY',
        url: { href: 'URL' },
        queueUrls: urls => {
          expect(urls.length).toEqual(2)
          expect(urls[0]).toEqual(expect.objectContaining({
            href: 'http://test.domain.one',
            depth: 1
          }))
          expect(urls[1]).toEqual(expect.objectContaining({
            href: 'https://secure.domain.two',
            depth: 1
          }))
          done()
        }
      })
    })

    it('adds plus one to last depth to added urls', done => {
      expect.assertions(3)
      app.process({
        body: 'BODY',
        url: { href: 'URL', depth: 2 },
        queueUrls: urls => {
          expect(urls.length).toEqual(2)
          expect(urls[0]).toEqual(expect.objectContaining({
            href: 'http://test.domain.one',
            depth: 3
          }))
          expect(urls[1]).toEqual(expect.objectContaining({
            href: 'https://secure.domain.two',
            depth: 3
          }))
          done()
        }
      })
    })

    it('does not add urls if depth is exceeded', async done => {
      let queueCalled = false
      expect.assertions(1)
      await app.process({
        body: 'BODY',
        url: { href: 'URL', depth: 3 },
        queueUrls: urls => {
          queueCalled = true
        }
      })
      expect(queueCalled).toEqual(false)
      done()
    })

    describe('without logging activated', () => {
      it('those links will not appear somewhere', async done => {
        let report = jest.fn()
        expect.assertions(1)
        await app.process({
          body: 'BODY',
          url: { href: 'URL', depth: 3 },
          queueUrls: () => {}
        })
        expect(report).not.toHaveBeenCalled()
        done()
      })
    })

    describe('with logging activated', () => {
      beforeEach(() => {
        app = new HttpLinkExpander({ maxDepth: 1, maxDepthLogging: true })
      })
      it('those links will not appear somewhere', async done => {
        let report = jest.fn()
        expect.assertions(1)
        await app.process({
          body: 'BODY',
          url: { href: 'URL', depth: 2 },
          queueUrls: () => {},
          report
        })
        expect(report).toHaveBeenCalledWith('skippedLinks', ['http://test.domain.one', 'https://secure.domain.two'])
        done()
      })
    })
  })
})
