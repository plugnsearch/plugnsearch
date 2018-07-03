/* eslint-env jest */
import fs from 'fs'
import path from 'path'
import request from 'request'
import TestRunRequester from '../../src/requesters/TestRunRequester'

const SNAPSHOT_DIR = path.join(__dirname, '../snapshots/')
let mockResponse
jest.mock('request', () => jest.fn((...args) => mockResponse(...args)))

const TEST_HTML = `<html>
  <body>
    <p>lorem ipsum</p>
  </body>
</html>`
const TEST_URL = 'http://localhost/item_1'
const SNAPSHOT_FILENAME = 'http---localhost-item_1'

describe('TestRunRequester', () => {
  let requester
  let requestOptions
  const resultingSnapshotFilename = path.join(SNAPSHOT_DIR, SNAPSHOT_FILENAME)

  beforeEach(() => {
    mockResponse = () => 'test'
    requestOptions = {
      uri: TEST_URL,
      headers: { foo: 'bar' }
    }
    requester = new TestRunRequester({
      snapshotDir: SNAPSHOT_DIR
    })
  })

  afterEach((done) => {
    request.mockClear()

    fs.unlink(resultingSnapshotFilename, () => done())
  })

  describe('with a successful response', () => {
    beforeEach(() => {
      mockResponse = (options, cb) => cb(null, {
        request: {
          href: options.uri
        },
        body: TEST_HTML,
        headers: {},
        statusCode: 202
      })
    })

    describe('when there is no snapshot yet', () => {
      it('does a request via request lib', async () => {
        await requester.request(requestOptions)
        expect(request).toHaveBeenCalledWith(requestOptions, expect.any(Function))
      })

      it('saves a snapshot to given snapshot dir', (done) => {
        requester.request(requestOptions).then(() => {
          fs.readFile(resultingSnapshotFilename, (err, content) => {
            expect(err).toEqual(null)
            const snap = JSON.parse(content)
            expect(snap.body).toEqual(TEST_HTML)
            expect(snap.statusCode).toEqual(202)
            done()
          })
        })
      })

      it('resolves the returned promise on successful request', () => {
        expect.assertions(1)
        return expect(
          requester.request(requestOptions)
        ).resolves.toEqual(expect.objectContaining({
          request: {
            href: TEST_URL
          },
          body: TEST_HTML,
          statusCode: 202
        }))
      })

      describe('on errornous request', () => {
        const error = new Error('BAM')
        beforeEach(() => {
          mockResponse = (options, cb) => cb(error, {
            request: {
              href: options.uri
            },
            body: '500',
            headers: {},
            statusCode: 500
          })
        })

        it('rejects the returned promise on errornous request', () => {
          expect.assertions(1)
          return expect(
            requester.request(requestOptions)
          ).rejects.toEqual(error)
        })
      })
    })

    describe('when there is already a snapshot for that url', () => {
      const exampleContent = {
        headers: 'headers',
        contentType: 'contentType',
        body: '404',
        statusCode: 404
      }

      beforeEach((done) => {
        request.mockClear()

        fs.writeFile(resultingSnapshotFilename, JSON.stringify(exampleContent), () => done())
      })

      it('does not do any HTTP request', async () => {
        await requester.request(requestOptions)
        expect(request).not.toHaveBeenCalled()
      })

      it('uses loaded snapshot to resolves the returned promise', () => {
        expect.assertions(1)
        return expect(
          requester.request(requestOptions)
        ).resolves.toEqual(exampleContent)
      })
    })
  })
})
