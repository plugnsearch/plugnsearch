/* eslint-env jest */
import ZeroMqReporter from '../../src/reporters/ZeroMqReporter'

let mockSock = {
  bindSync: jest.fn(),
  send: jest.fn()
}

jest.mock('zeromq', () => ({
  socket: (type) => type === 'pub' ? mockSock : null
}))

describe('ZeroMqReporter', () => {
  let reporter

  describe('using default url and channel', () => {
    const URL = 'tcp://127.0.0.1:3000'
    const CHANNEL = 'plugnsearch-zero'

    beforeEach(() => {
      reporter = new ZeroMqReporter({})
    })

    it('binds socket to given url', () => {
      expect(mockSock.bindSync).toHaveBeenCalledWith(URL)
    })

    it('sends the reports out directly', () => {
      reporter.report('http://something.com', 'rejection', 'unsupported protocol')

      expect(mockSock.send).toHaveBeenCalledWith([CHANNEL, JSON.stringify({
        url: 'http://something.com',
        type: 'rejection',
        data: 'unsupported protocol'
      })])
    })

    it('can also report numbers', () => {
      reporter.report('http://something.com', 'foo', 50)
      reporter.report('http://something.com', 'bar', 23)

      expect(mockSock.send).toHaveBeenCalledWith([CHANNEL, JSON.stringify({
        url: 'http://something.com',
        type: 'foo',
        data: 50
      })])
      expect(mockSock.send).toHaveBeenCalledWith([CHANNEL, JSON.stringify({
        url: 'http://something.com',
        type: 'bar',
        data: 23
      })])
    })

    it('can also report arrays', () => {
      reporter.report('http://something.com', 'foo', [50, '70'])

      expect(mockSock.send).toHaveBeenCalledWith([CHANNEL, JSON.stringify({
        url: 'http://something.com',
        type: 'foo',
        data: [50, '70']
      })])
    })

    it('can also report complex objects', () => {
      const data = {
        title: 'It is awesome',
        keywords: ['awesome', 'page']
      }
      reporter.report('http://something.com', 'meta', data)

      expect(mockSock.send).toHaveBeenCalledWith([CHANNEL, JSON.stringify({
        url: 'http://something.com',
        type: 'meta',
        data
      })])
    })
  })

  describe('using a different url', () => {
    const URL = 'tcp://127.0.0.1:3456'
    beforeEach(() => {
      reporter = new ZeroMqReporter({
        url: URL
      })
    })

    it('binds socket to given url', () => {
      expect(mockSock.bindSync).toHaveBeenCalledWith(URL)
    })
  })

  describe('using a different channel', () => {
    const url = 'tcp://127.0.0.1:3456'
    const channel = 'gohere'

    beforeEach(() => {
      reporter = new ZeroMqReporter({
        url,
        channel
      })
    })

    it('binds socket to given url', () => {
      expect(mockSock.bindSync).toHaveBeenCalledWith(url)
    })

    it('sends the reports to that channel', () => {
      reporter.report('http://something.com', 'foo', 'bar')

      expect(mockSock.send).toHaveBeenCalledWith([channel, JSON.stringify({
        url: 'http://something.com',
        type: 'foo',
        data: 'bar'
      })])
    })
  })
})
