/* eslint-env jest */
import path from 'path'
import fs from 'fs'
import Reporter from '../../src/reporters/JSONStreamReporter'
import URL from '../../src/URL'

const tmpPath = path.join(__dirname, '../tmp')

describe('Reporter', () => {
  let reporter
  let filename

  beforeAll(() => {
    try {
      fs.mkdirSync(tmpPath)
    } catch (e) {}
  })
  beforeEach(() => {
    filename = path.join(tmpPath, 'test-stream-report.json')
    reporter = new Reporter({
      filename
    })
  })
  afterEach(() => {
    try {
      fs.unlinkSync(filename)
    } catch (e) {}
  })

  it('writes valid JSON although empty', done => {
    expect.assertions(1)
    reporter.closeStream()
      .then(() => {
        const writtenData = JSON.parse(fs.readFileSync(filename, 'UTF-8'))
        expect(writtenData.length).toEqual(0)
        done()
      })
  })

  it('writes reported stuff directly into file as valid JSON', done => {
    const stubMeta = { foo: 'bar' }
    const stubMeta2 = { foo: 'fighters', cool: 'stuff' }
    reporter.report('http://something.com', 'rejection', 'unsupported protocol')
    reporter.report('http://somethingelse.com', 'meta', stubMeta)
    reporter.report('http://somethingelse.com', 'meta', stubMeta2)
    reporter.report('http://something.com', 'blubb', 'bla')
    reporter.report('http://something.com', 'blubb', 'blubb')

    expect.assertions(3)
    reporter.closeStream()
      .then(() => {
        const writtenData = JSON.parse(fs.readFileSync(filename, 'UTF-8'))
        expect(writtenData.length).toEqual(5)
        expect(writtenData[0]).toEqual(expect.objectContaining({
          url: 'http://something.com',
          rejection: 'unsupported protocol'
        }))

        expect(writtenData[2]).toEqual(expect.objectContaining({
          url: 'http://somethingelse.com',
          meta: stubMeta2
        }))
        done()
      })

    // expect(reporter.toJson()).toEqual({
    //   'http://something.com': {
    //     rejection: 'unsupported protocol',
    //     blubb: 'blubb'
    //   },
    //   'http://somethingelse.com': {
    //     meta: {
    //       ...stubMeta,
    //       ...stubMeta2
    //     }
    //   }
    // })
  })

  it('can handle URL objects', done => {
    reporter.report(new URL('http://something.com'), 'rejection', 'unsupported protocol')
    expect.assertions(1)
    reporter.closeStream()
      .then(() => {
        const writtenData = JSON.parse(fs.readFileSync(filename, 'UTF-8'))
        expect(writtenData[0]).toEqual(expect.objectContaining({
          url: 'http://something.com',
          rejection: 'unsupported protocol'
        }))
        done()
      })
  })
})
