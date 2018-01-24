/* eslint-env jest */
import Crawler from '../../src/Crawler'
import OnlyDownloadSpecificTypes, { UninterestingError } from '../../src/middlewares/OnlyDownloadSpecificTypes'

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('apps/OnlyDownloadSpecificTypes', () => {
  let app
  let requestOptions
  let appInterface
  let requestError
  let getMockResponse
  let calledOptions
  let resultContentType

  beforeEach(() => {
    requestError = null
    resultContentType = 'text/html'
    getMockResponse = () => ({
      headers: {
        'content-type': resultContentType
      }
    })
    calledOptions = []
    mockRequest.mockImplementation((options, cb) => {
      calledOptions.push(options)
      cb(requestError, getMockResponse(options))
    })

    requestOptions = {
      uri: 'http://localhost/maybe-video'
    }
    appInterface = {
      report: jest.fn()
    }
  })

  afterEach(() => {
    mockRequest.mockClear()
  })

  it('sends out a HEAD request to given url', () => {
    app = new OnlyDownloadSpecificTypes({})
    expect.assertions(3)
    return app.preRequest(requestOptions, appInterface)
      .then(() => {
        expect(calledOptions.length).toEqual(1)
        expect(calledOptions[0].uri).toEqual(requestOptions.uri)
        expect(calledOptions[0].method).toEqual('HEAD')
      })
  })

  describe('options `onlySpecificContentTypes`', () => {
    describe('defined as string', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: 'text/html'
        })
      })

      it('sends out a HEAD request to given url and resolves if matches', () => {
        return expect(app.preRequest(requestOptions, appInterface))
          .resolves.toEqual()
      })

      it('sends out a HEAD request to given url and rejects if it does not match', () => {
        resultContentType = 'text/xhtml'

        expect.assertions(1)
        return app.preRequest(requestOptions, appInterface)
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "text/xhtml" does not match allowed content-type. Resource will be skipped.'
            )
          })
      })
    })

    describe('defined as RegExp', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: /html/
        })
      })

      it('sends out a HEAD request to given url and resolves if matches', () => {
        resultContentType = 'text/xhtml'

        return expect(app.preRequest(requestOptions, appInterface))
          .resolves.toEqual()
      })

      it('sends out a HEAD request to given url and rejects if it does not match', () => {
        resultContentType = 'audio/mp3'

        expect.assertions(1)
        return app.preRequest(requestOptions, appInterface)
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            )
          })
      })
    })

    describe('defined as Array', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: ['text/html', 'text/plain']
        })
      })

      it('sends out a HEAD request to given url and resolves if matches', () => {
        resultContentType = 'text/plain'

        return expect(app.preRequest(requestOptions, appInterface))
          .resolves.toEqual()
      })

      it('sends out a HEAD request to given url and rejects if it does not match', () => {
        resultContentType = 'audio/mp3'

        expect.assertions(1)
        return app.preRequest(requestOptions, appInterface)
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            )
          })
      })
    })
  })

  describe('on an errornous request', () => {
    beforeEach(() => {
      getMockResponse = () => ({
        statusCode: 404,
        statusMessage: 'Not Found',
        headers: {
          'content-type': 'plain/text'
        }
      })
    })

    it('logs a PageLoadError', () => {
      expect.assertions(1)
      return app.preRequest(requestOptions, appInterface)
        .catch(() => {
          expect(appInterface.report).toHaveBeenCalledWith(
            'PageLoadError',
            'Not Found (404)'
          )
        })
    })

    it('tells the app to not log anything more', () => {
      return expect(app.preRequest(requestOptions, appInterface))
        .rejects.toEqual(new UninterestingError())
    })
  })

  describe('integration test', () => {
    let crawler

    it('works with Crawler', done => {
      getMockResponse = ({ uri }) => ({
        request: {
          href: uri
        },
        headers: {
          'content-type': uri.split('?')[1]
        }
      })
      crawler = new Crawler({
        onlySpecificContentTypes: ['text/html', 'text/plain']
      })
      crawler.addApp(config => new OnlyDownloadSpecificTypes(config))
      crawler.seed(['http://localhost/?text/html', 'http://localhost/?audio/mp3'])
        .on('finish', (reporter) => {
          expect(reporter.toJson()).toEqual({
            'http://localhost/?text/html': {},
            'http://localhost/?audio/mp3': {
              'skipped': 'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            }
          })
          done()
        })
        .start()
    })
  })
})
