/* eslint-env jest */
const {
  Crawler,
  URL,
  OnlyDownloadSpecificTypes,
  UninterestingError
} = require('../../')

let mockRequest = jest.fn()
jest.mock('request', () => (...args) => mockRequest.apply(null, args))

describe('apps/OnlyDownloadSpecificTypes', () => {
  let app
  let requestOptions
  let requestUrl
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

    requestUrl = new URL('http://localhost/maybe-video')
    requestOptions = {}
    appInterface = {
      report: jest.fn()
    }
    app = new OnlyDownloadSpecificTypes({
      onlySpecificContentTypes: 'text/html'
    })
  })

  afterEach(() => {
    mockRequest.mockClear()
  })

  it('sends out a HEAD request to given url', () => {
    expect.assertions(3)
    return app.preRequest(requestUrl, requestOptions, appInterface)
      .then(() => {
        expect(calledOptions.length).toEqual(1)
        expect(calledOptions[0].uri).toEqual(requestUrl.href)
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
        return expect(app.preRequest(requestUrl, requestOptions, appInterface))
          .resolves.toEqual()
      })

      it('sends out a HEAD request to given url and rejects if it does not match', () => {
        resultContentType = 'text/xhtml'

        expect.assertions(1)
        return app.preRequest(requestUrl, requestOptions, appInterface)
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

        return expect(app.preRequest(requestUrl, requestOptions, appInterface))
          .resolves.toEqual()
      })

      it('sends out a HEAD request to given url and rejects if it does not match', () => {
        resultContentType = 'audio/mp3'

        expect.assertions(1)
        return app.preRequest(requestUrl, requestOptions, appInterface)
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

        return expect(app.preRequest(requestUrl, requestOptions, appInterface))
          .resolves.toEqual()
      })

      it('sends out a HEAD request to given url and rejects if it does not match', () => {
        resultContentType = 'audio/mp3'

        expect.assertions(1)
        return app.preRequest(requestUrl, requestOptions, appInterface)
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            )
          })
      })
    })

    describe('defined as null', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: null
        })
      })

      it('does not send out an additional HEAD request', () => {
        expect.assertions(1)
        return app.preRequest(requestUrl, requestOptions, appInterface)
          .then(() => {
            expect(mockRequest).not.toHaveBeenCalled()
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
      return app.preRequest(requestUrl, requestOptions, appInterface)
        .catch(() => {
          expect(appInterface.report).toHaveBeenCalledWith(
            'PageLoadError',
            'Not Found (404)'
          )
        })
    })

    it('tells the app to not log anything more', () => {
      return expect(app.preRequest(requestUrl, requestOptions, appInterface))
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
      crawler
        .on('finish', (reporter) => {
          expect(reporter.toJson()).toEqual({
            'http://localhost/?text/html': {},
            'http://localhost/?audio/mp3': {
              'skipped': 'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            }
          })
          done()
        })
        .seed(['http://localhost/?text/html', 'http://localhost/?audio/mp3'])
        .then(() => crawler.start())
    })

    it('when error happens', done => {
      requestError = new Error('ESOCKETTIMEDOUT')
      crawler = new Crawler({
        onlySpecificContentTypes: ['text/html', 'text/plain']
      })
      crawler.addApp(config => new OnlyDownloadSpecificTypes(config))
      crawler
        .on('finish', (reporter) => {
          expect(reporter.toJson()).toEqual({
            'http://localhost/?text/html': {
              error: expect.objectContaining({ 'message': 'preRequest method failed because of Error: ESOCKETTIMEDOUT' })
            },
            'http://localhost/?audio/mp3': {
              error: expect.objectContaining({ 'message': 'preRequest method failed because of Error: ESOCKETTIMEDOUT' })
            }
          })
          done()
        })
        .seed(['http://localhost/?text/html', 'http://localhost/?audio/mp3'])
        .then(() => crawler.start())
    })
  })
})
