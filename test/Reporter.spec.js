/* eslint-env jest */
import Reporter from '../src/Reporter'

describe('Reporter', () => {
  let reporter

  beforeEach(() => {
    reporter = new Reporter()
  })

  it('can report different items, merges them and return them as JSON', () => {
    const stubMeta = { foo: 'bar' }
    const stubMeta2 = { foo: 'fighters', cool: 'stuff' }
    reporter.report('http://something.com', 'rejection', 'unsupported protocol')
    reporter.report('http://somethingelse.com', 'meta', stubMeta)
    reporter.report('http://somethingelse.com', 'meta', stubMeta2)
    reporter.report('http://something.com', 'blubb', 'bla')
    reporter.report('http://something.com', 'blubb', 'blubb')

    expect(reporter.toJson()).toEqual({
      'http://something.com': {
        rejection: 'unsupported protocol',
        blubb: 'blubb'
      },
      'http://somethingelse.com': {
        meta: {
          ...stubMeta,
          ...stubMeta2
        }
      }
    })
  })
})
