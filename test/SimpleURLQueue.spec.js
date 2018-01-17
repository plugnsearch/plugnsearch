/* eslint-env jest */
import SimpleURLQueue from '../src/SimpleURLQueue'

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

      expect(queue.getNextUrl()).toEqual('http://item1.com')
      expect(queue.getNextUrl()).toEqual('http://item2.com')
      expect(queue.getNextUrl()).toEqual('http://item3.com')

      // Nothing in it anymore
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('can queue multiple items at once', () => {
      queue.queue(['http://item1.com', 'http://item2.com', 'http://item3.com'])

      expect(queue.getNextUrl()).toEqual('http://item1.com')
      expect(queue.getNextUrl()).toEqual('http://item2.com')
      expect(queue.getNextUrl()).toEqual('http://item3.com')

      // Nothing in it anymore
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('removes duplicates from todo item', () => {
      queue.queue('http://item1.com')
      queue.queue('http://item1.com')
      queue.queue('http://item1.com')

      expect(queue.getNextUrl()).toEqual('http://item1.com')
      expect(queue.getNextUrl()).toEqual(null)
    })

    it('removes duplicates from items already seen', () => {
      queue.queue('http://item1.com')
      expect(queue.getNextUrl()).toEqual('http://item1.com')

      queue.queue('http://item1.com')
      queue.queue('http://item1.com')

      expect(queue.getNextUrl()).toEqual(null)
    })

    it('normalizes urls', () => {
      queue.queue('http://item1.com')
      queue.queue('http://item1.com/')
      queue.queue('http://ITEM1.com')

      expect(queue.getNextUrl()).toEqual('http://item1.com')
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
