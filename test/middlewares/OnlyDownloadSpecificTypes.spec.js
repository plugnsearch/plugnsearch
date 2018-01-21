/* eslint-env jest */
import Crawler from '../../src/Crawler'
import OnlyDownloadSpecificTypes from '../../src/middlewares/OnlyDownloadSpecificTypes'

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
    resultContentType = 'text/html'
    getMockResponse = () => ({
      headers: {
        'Content-Type': resultContentType
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

  it('sends out a HEAD request to given url', done => {
    app = new OnlyDownloadSpecificTypes({})
    app.preRequest(requestOptions, appInterface)
      .then(() => {
        expect(calledOptions.length).toEqual(1)
        expect(calledOptions[0].uri).toEqual(requestOptions.uri)
        expect(calledOptions[0].method).toEqual('HEAD')
        done()
      })
  })

  describe('options `onlySpecificContentTypes`', () => {
    describe('defined as string', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: 'text/html'
        })
      })

      it('sends out a HEAD request to given url and resolves if matches', done => {
        app.preRequest(requestOptions, appInterface)
          .then(() => {
            done()
          })
          .catch(() => {
            expect('this').toEqual('not have been called')
            done()
          })
      })

      it('sends out a HEAD request to given url and rejects if it does not match', done => {
        resultContentType = 'text/xhtml'

        app.preRequest(requestOptions, appInterface)
          .then(() => {
            expect('this').toEqual('not have been called')
            done()
          })
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "text/xhtml" does not match allowed content-type. Resource will be skipped.'
            )
            done()
          })
      })
    })

    describe('defined as RegExp', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: /html/
        })
      })

      it('sends out a HEAD request to given url and resolves if matches', done => {
        resultContentType = 'text/xhtml'

        app.preRequest(requestOptions, appInterface)
          .then(() => {
            done()
          })
          .catch(() => {
            expect('this').toEqual('not have been called')
            done()
          })
      })

      it('sends out a HEAD request to given url and rejects if it does not match', done => {
        resultContentType = 'audio/mp3'

        app.preRequest(requestOptions, appInterface)
          .then(() => {
            expect('this').toEqual('not have been called')
            done()
          })
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            )
            done()
          })
      })
    })

    describe('defined as Array', () => {
      beforeEach(() => {
        app = new OnlyDownloadSpecificTypes({
          onlySpecificContentTypes: ['text/html', 'text/plain']
        })
      })

      it('sends out a HEAD request to given url and resolves if matches', done => {
        resultContentType = 'text/plain'

        app.preRequest(requestOptions, appInterface)
          .then(() => {
            done()
          })
          .catch(() => {
            expect('this').toEqual('not have been called')
            done()
          })
      })

      it('sends out a HEAD request to given url and rejects if it does not match', done => {
        resultContentType = 'audio/mp3'

        app.preRequest(requestOptions, appInterface)
          .then(() => {
            expect('this').toEqual('not have been called')
            done()
          })
          .catch(() => {
            expect(appInterface.report).toHaveBeenCalledWith(
              'skipped',
              'The Content-Type "audio/mp3" does not match allowed content-type. Resource will be skipped.'
            )
            done()
          })
      })
    })
  })

  describe('integration test', () => {
    let crawler

    it('we can set multiple userAgents the crawler  cycles through', done => {
      getMockResponse = ({ uri }) => ({
        headers: {
          'Content-Type': uri.split('?')[1]
        }
      })
      crawler = new Crawler({
        onlySpecificContentTypes: ['text/html', 'text/plain']
      })
      crawler.addApp(config => new OnlyDownloadSpecificTypes(config))
      crawler.seed(['http://localhost/?text/html', 'http://localhost/?audio/mp3'])
        .on('finish', (reporter) => {
          const report = reporter.toJson()
          expect(report).toEqual({
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
