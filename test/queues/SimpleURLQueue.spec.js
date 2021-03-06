/* eslint-env jest */
const {
  URL,
  SimpleURLQueue
} = require('../../')

describe('SimpleURLQueue', () => {
  let queue
  describe('skippingDuplicates', () => {
    beforeEach(() => {
      queue = new SimpleURLQueue()
    })

    it('can queue one item at a time and returns them FIFO', async () => {
      queue.queue('http://item1.com')
      queue.queue('http://item2.com')
      queue.queue('http://item3.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item2.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item3.com')

      // Nothing in it anymore
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('can queue multiple items at once', async () => {
      queue.queue(['http://item1.com', 'http://item2.com', 'http://item3.com'])

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item2.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item3.com')

      // Nothing in it anymore
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('removes duplicates from todo item', async () => {
      queue.queue('http://item1.com')
      queue.queue('http://item1.com')
      queue.queue('http://item1.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('removes duplicates from items already seen', async () => {
      queue.queue('http://item1.com')
      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')

      queue.queue('http://item1.com')
      queue.queue('http://item1.com')

      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('normalizes urls', async () => {
      queue.queue('http://item1.com')
      queue.queue('http://item1.com/')
      queue.queue('http://ITEM1.com')

      expect((await queue.getNextUrl()).href).toEqual('http://item1.com')
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('can have additional data added to the object', async () => {
      queue.queue({ href: 'http://item1.com', foo: 'bar' })
      queue.queue({ href: 'http://item1.com/', moo: 'too' })
      queue.queue('http://ITEM1.com')

      const matchingUrl = await queue.getNextUrl()
      expect(matchingUrl).toEqual(expect.objectContaining({ href: 'http://item1.com', foo: 'bar' }))
      expect(matchingUrl.moo).toBeUndefined()
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('also works with URL objects', async () => {
      queue.queue(new URL('http://item1.com'))
      queue.queue(new URL('http://item1.com/'))
      queue.queue(new URL('http://ITEM1.com'))

      expect(await queue.getNextUrl()).toEqual(expect.objectContaining({ href: 'http://item1.com' }))
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('throws up if you present something that is not an url', () => {
      expect(() => {
        queue.queue('http:// not an url')
      }).toThrow(`Queued parameter 'http:// not an url' is not a valid URL.`)
    })
  })

  describe('without skipping duplicates', () => {
    beforeEach(() => {
      queue = new SimpleURLQueue({ skipDuplicates: false })
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

  describe('#clear', () => {
    beforeEach(async () => {
      queue = new SimpleURLQueue()
      await queue.queue('http://item1.com')
      await queue.queue('http://item2.com')
      await queue.queue('http://item3.com')
      await queue.getNextUrl()
      await queue.clear()
    })

    it('removes all from current queue', () => {
      return expect(queue.getNextUrl()).resolves.toEqual(null)
    })

    it('removes all from alreadyDone', () => {
      expect(queue.urlsDone).toEqual([])
    })
  })
})
