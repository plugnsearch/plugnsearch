/* eslint-env jest */
import URL from '../../src/URL'
import SimpleURLQueue from '../../src/queues/SimpleURLQueue'

describe('SimpleURLQueue', () => {
  let queue
  describe('skippingDuplicates', () => {
    beforeEach(() => {
      queue = new SimpleURLQueue()
    })

    it('can queue one item at a time and returns them FIFO', () => {
      queue.queue('http://item1.com')
      queue.queue('http://item2.com')
      queue.queue('http://item3.com')

      expect(queue.getNextUrl().href).toEqual('http://item1.com')
      expect(queue.getNextUrl().href).toEqual('http://item2.com')
      expect(queue.getNextUrl().href).toEqual('http://item3.com')

      // Nothing in it anymore
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('can queue multiple items at once', () => {
      queue.queue(['http://item1.com', 'http://item2.com', 'http://item3.com'])

      expect(queue.getNextUrl().href).toEqual('http://item1.com')
      expect(queue.getNextUrl().href).toEqual('http://item2.com')
      expect(queue.getNextUrl().href).toEqual('http://item3.com')

      // Nothing in it anymore
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('removes duplicates from todo item', () => {
      queue.queue('http://item1.com')
      queue.queue('http://item1.com')
      queue.queue('http://item1.com')

      expect(queue.getNextUrl().href).toEqual('http://item1.com')
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('removes duplicates from items already seen', () => {
      queue.queue('http://item1.com')
      expect(queue.getNextUrl().href).toEqual('http://item1.com')

      queue.queue('http://item1.com')
      queue.queue('http://item1.com')

      expect(queue.getNextUrl()).toEqual(null)
    })

    it('normalizes urls', () => {
      queue.queue('http://item1.com')
      queue.queue('http://item1.com/')
      queue.queue('http://ITEM1.com')

      expect(queue.getNextUrl().href).toEqual('http://item1.com')
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('can have additional data added to the object', () => {
      queue.queue({ href: 'http://item1.com', foo: 'bar' })
      queue.queue({ href: 'http://item1.com/', moo: 'too' })
      queue.queue('http://ITEM1.com')

      const matchingUrl = queue.getNextUrl()
      expect(matchingUrl).toEqual(expect.objectContaining({ href: 'http://item1.com', foo: 'bar' }))
      expect(matchingUrl.moo).toBeUndefined()
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('also works with URL objects', () => {
      queue.queue(new URL('http://item1.com'))
      queue.queue(new URL('http://item1.com/'))
      queue.queue(new URL('http://ITEM1.com'))

      expect(queue.getNextUrl()).toEqual(expect.objectContaining({ href: 'http://item1.com' }))
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('sends out a empty event if the last item gets removed', () => {
      const spy = jest.fn()
      queue.on('empty', spy)
      queue.queue('http://item1.com')
      queue.queue('http://item2.com')

      queue.getNextUrl()
      expect(spy).not.toHaveBeenCalled()

      queue.getNextUrl()
      expect(spy).toHaveBeenCalled()

      queue.getNextUrl()
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('throws up if you present something that is not an url', () => {
      expect(() => {
        queue.queue('http:// not an url')
      }).toThrow(`Queued parameter 'http:// not an url' is not a valid URL.`)
    })
  })
})
