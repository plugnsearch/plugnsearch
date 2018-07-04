/* eslint-env jest */
const redis = require('redis')
const {
  URL,
  RedisURLQueue
} = require('../../')

let mockSet = {}
let mockQueue = []
let mockErrors = {}
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    rpush: jest.fn((key, args, cb = () => {}) => {
      if (key === 'urlQueue') {
        mockQueue = [...mockQueue, ...args]
      }
      return cb(mockErrors.rpush)
    }),
    lpop: jest.fn((key, cb) => {
      return cb(mockErrors.lpop, mockQueue.shift())
    }),
    // set: jest.fn((key, val, cb) => {
    //   mockSet[key] = val
    //   cb && cb()
    // }),
    hmset: jest.fn((key, args, cb) => {
      mockSet = {
        ...mockSet,
        ...args
      }
      cb && cb(mockErrors.hmset)
    }),
    hmget: jest.fn((key, keys, cb) => {
      cb(mockErrors.hmget, keys.map(key => mockSet[key]))
    }),
    del: jest.fn((keys, cb) => {
      if (keys.indexOf('urlQueue') !== -1) {
        mockSet = {}
      }
      if (keys.indexOf('urlQueue.Done') !== -1) {
        mockQueue = []
      }
      cb()
    })
  }))
}))

describe('RedisURLQueue', () => {
  const redisOptions = { host: 'localhorst' }
  let queue

  beforeEach(() => {
    mockSet = {}
    mockQueue = []
    mockErrors = {}
  })

  describe('skippingDuplicates', () => {
    beforeEach(() => {
      queue = new RedisURLQueue({ redisOptions })
    })

    it('sends the options to redis', () => {
      expect(redis.createClient).toHaveBeenCalledWith(redisOptions)
    })

    it('can queue one item at a time and returns them FIFO', async () => {
      await queue.queue('http://item1.com')
      await queue.queue('http://item2.com')
      await queue.queue('http://item3.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item2.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item3.com')

      // Nothing in it anymore
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('can queue multiple items at once', async () => {
      await queue.queue(['http://item1.com', 'http://item2.com', 'http://item3.com'])

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item2.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item3.com')

      // Nothing in it anymore
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('queueing nothing does not do anything', async () => {
      await queue.queue()
      await queue.queue([])
      // And no error was thrown

      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('removes duplicates from todo item', async () => {
      await queue.queue(['http://item1.com', 'http://item1.com'])
      await queue.queue('http://item1.com')
      await queue.queue('http://item1.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('removes duplicates from items already seen', async () => {
      await queue.queue('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')

      await queue.queue('http://item1.com')
      await queue.queue('http://item1.com')

      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('normalizes urls', async () => {
      await queue.queue('http://item1.com')
      await queue.queue('http://item1.com/')
      await queue.queue('http://ITEM1.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('can have additional data added to the object', async () => {
      await queue.queue({ href: 'http://item1.com', foo: 'bar' })
      await queue.queue({ href: 'http://item1.com/', moo: 'too' })
      await queue.queue('http://ITEM1.com')

      const matchingUrl = await queue.getNextUrl()
      expect(matchingUrl).toEqual(expect.objectContaining({ href: 'http://item1.com', foo: 'bar' }))
      expect(matchingUrl.moo).toBeUndefined()
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('also works with URL objects', async () => {
      await queue.queue(new URL('http://item1.com'))
      await queue.queue(new URL('http://item1.com/'))
      await queue.queue(new URL('http://ITEM1.com'))

      expect(await queue.getNextUrl()).toEqual(expect.objectContaining({ href: 'http://item1.com' }))
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('ignores invalid urls, but returns an error with them', async () => {
      const { invalidUrls } = await queue.queue('http:// not an url')
      expect(invalidUrls.map(u => u.href)).toContain('http:// not an url')
    })
  })

  describe('without skipping duplicates', () => {
    beforeEach(() => {
      queue = new RedisURLQueue({ redisOptions, skipDuplicates: false })
    })

    it('does not remove duplicates from items already seen', async () => {
      await queue.queue('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')

      await queue.queue('http://item1.com')
      await queue.queue('http://item1.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      queue = new RedisURLQueue({ redisOptions })
    })

    it('rejects #queue if redis error happens in pushing to queue', async () => {
      mockErrors.rpush = 'ERROR'
      expect(queue.queue(new URL('http://item1.com'))).rejects.toEqual('ERROR')
    })

    it('rejects #queue if redis error happens in pushing to done set', async () => {
      mockErrors.hmget = 'ERROR'
      expect(queue.queue(new URL('http://item1.com'))).rejects.toEqual('ERROR')
    })

    it('rejects #queue if redis error happens in pushing to done set', async () => {
      mockErrors.hmset = 'ERROR'
      expect(queue.queue(new URL('http://item1.com'))).rejects.toEqual('ERROR')
    })

    it('rejects #getNextUrl if redis error happens', async () => {
      await queue.queue(new URL('http://item1.com'))

      mockErrors.lpop = 'ERROR'
      expect(queue.getNextUrl()).rejects.toEqual('ERROR')
    })
  })

  describe('#clear', () => {
    beforeEach(async () => {
      queue = new RedisURLQueue({ redisOptions })
      await queue.queue('http://item1.com')
      await queue.queue('http://item2.com')
      await queue.queue('http://item3.com')
      await queue.getNextUrl()
      await queue.clear()
    })

    it('removes all from current queue', () => {
      expect(mockQueue).toEqual([])
    })

    it('removes all from alreadyDone', () => {
      expect(mockSet).toEqual({})
    })
  })
})
