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

  describe('when having set a fileSizeLimit', () => {
    beforeEach(() => {
      filename = path.join(tmpPath, 'limited-stream-report.json')
      reporter = new Reporter({
        filename,
        fileLimitSize: 200 // bytes
      })

      reporter.report(new URL('http://something.com'), 'one', 'foo bar baz')
      reporter.report(new URL('http://something.com'), 'two', 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quae dolores distinctio luftballon.')
      reporter.report(new URL('http://something.com'), 'three', 'Just something more')
    })
    afterEach(() => {
      try {
        fs.unlinkSync(path.join(tmpPath, 'limited-stream-report.json'))
        fs.unlinkSync(path.join(tmpPath, 'limited-stream-report-2.json'))
      } catch (e) {}
    })

    it('splits to valid JSON files after reaching the limit', done => {
      expect.assertions(5)
      reporter.closeStream()
        .then(() => {
          const writtenData1 = fs.readFileSync(filename, 'UTF-8')
          const writtenData2 = fs.readFileSync(filename.replace('.json', '-2.json'), 'UTF-8')
          const jsonData1 = JSON.parse(writtenData1)
          const jsonData2 = JSON.parse(writtenData2)

          expect(writtenData1.length).toEqual(204)
          expect(writtenData2.length).toEqual(71)

          expect(jsonData1[0]).toEqual({
            url: 'http://something.com',
            one: 'foo bar baz'
          })
          expect(jsonData1[1]).toEqual({
            url: 'http://something.com',
            two: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quae dolores distinctio luftballon.'
          })
          expect(jsonData2[0]).toEqual({
            url: 'http://something.com',
            three: 'Just something more'
          })
          done()
        })
    })

    it('returns all the filenames it writes', (done) => {
      expect.assertions(1)
      reporter.closeStream()
        .then(() => {
          expect(reporter.files).toEqual([
            path.join(tmpPath, 'limited-stream-report.json'),
            path.join(tmpPath, 'limited-stream-report-2.json')
          ])
          done()
        })
    })
  })

  describe('when the given filename does not end on .json', () => {
    beforeEach(() => {
      filename = path.join(tmpPath, 'test-stream-report')
      reporter = new Reporter({
        filename,
        fileLimitSize: 200 // bytes
      })
    })
    afterEach(() => {
      try {
        fs.unlinkSync(filename + '.json')
      } catch (e) {}
    })

    it('still creates a file with json ending', (done) => {
      expect.assertions(1)
      reporter.closeStream()
        .then(() => {
          const writtenData = JSON.parse(fs.readFileSync(filename + '.json', 'UTF-8'))
          expect(writtenData.length).toEqual(0)
          done()
        })
    })
  })
})
