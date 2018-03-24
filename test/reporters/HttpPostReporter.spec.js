/* eslint-env jest */
import HttpPostReporter from '../../src/reporters/HttpPostReporter'
import request from 'request'

jest.mock('request', () => ({
  post: jest.fn((options, data, cb) => {
    cb && cb(null, { statusCode: 200 }, '')
  })
}))

describe('HttpPostReporter', () => {
  const POST_URL = 'http://somewhere.com/here'
  let reporter

  beforeEach(() => {
    reporter = new HttpPostReporter({
      url: POST_URL
    })
  })

  it('sends the reports out directly', () => {
    reporter.report('http://something.com', 'rejection', 'unsupported protocol')

    expect(request.post).toHaveBeenCalledWith(POST_URL, {
      url: 'http://something.com',
      type: 'rejection',
      data: 'unsupported protocol'
    })
  })

  it('can also report numbers', () => {
    reporter.report('http://something.com', 'foo', 50)
    reporter.report('http://something.com', 'bar', 23)

    expect(request.post).toHaveBeenCalledWith(POST_URL, {
      url: 'http://something.com',
      type: 'foo',
      data: 50
    })
    expect(request.post).toHaveBeenCalledWith(POST_URL, {
      url: 'http://something.com',
      type: 'bar',
      data: 23
    })
  })

  it('can also report arrays', () => {
    reporter.report('http://something.com', 'foo', [50, '70'])

    expect(request.post).toHaveBeenCalledWith(POST_URL, {
      url: 'http://something.com',
      type: 'foo',
      data: [50, '70']
    })
  })

  it('can also report complex objects', () => {
    const data = {
      title: 'It is awesome',
      keywords: ['awesome', 'page']
    }
    reporter.report('http://something.com', 'meta', data)

    expect(request.post).toHaveBeenCalledWith(POST_URL, {
      url: 'http://something.com',
      type: 'meta',
      data
    })
  })
})
