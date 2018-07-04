/* eslint-env jest */
const redis = require('redis')
const {
  Crawler,
  RedisURLQueue
} = require('../../')

describe('RedisURLQueue integration spec', () => {
  const redisKey = 'test.redis'
  const redisKeyDone = `${redisKey}.Done`
  const redisOptions = { host: 'localhost' }
  let queue
  let redisCli

  beforeEach(() => {
    redisCli = redis.createClient(redisOptions)
  })

  afterEach((done) => {
    redisCli.del([redisKey, redisKeyDone], done)
  })

  describe('with skippingDuplicates activated', () => {
    beforeEach(() => {
      queue = new RedisURLQueue({ redisKey, redisOptions })
    })

    describe('having queued some urls', () => {
      beforeEach(async () => {
        await queue.queue('https://item1.com/Search/A-Z/Hamburg')
        await queue.queue('https://item2.com/expose/12345')
        await queue.queue('http://item3.com')
      })

      it('they are in the database and still todo', (done) => {
        expect.assertions(1)
        redisCli.lrange(redisKey, 0, 100, (err, result) => {
          expect(result.length).toEqual(3)
          done(err)
        })
      })

      it('will also be added to the Done list', (done) => {
        expect.assertions(1)
        redisCli.hkeys(redisKeyDone, (err, result) => {
          expect(Object.keys(result).length).toEqual(3)
          done(err)
        })
      })

      it('will return them FIFO', async () => {
        expect((await queue.getNextUrl()).href).toEqual('https://item1.com/Search/A-Z/Hamburg')
        expect((await queue.getNextUrl()).href).toEqual('https://item2.com/expose/12345')
        expect((await queue.getNextUrl()).href).toEqual('http://item3.com')

        // Nothing in it anymore
        return expect(queue.getNextUrl()).resolves.toEqual(null)
      })

      describe('#clear', () => {
        beforeEach(async () => {
          await queue.clear()
        })

        it('clears out the todo list', (done) => {
          expect.assertions(1)
          redisCli.lrange(redisKey, 0, 100, (err, result) => {
            expect(result.length).toEqual(0)
            done(err)
          })
        })

        it('clears out the Done list', (done) => {
          expect.assertions(1)
          redisCli.hkeys(redisKeyDone, (err, result) => {
            expect(Object.keys(result).length).toEqual(0)
            done(err)
          })
        })
      })

      describe('adding another new one', () => {
        beforeEach(async () => {
          await queue.queue('http://item3.com/foo')
        })

        it('will add it to the todo list', (done) => {
          expect.assertions(1)
          redisCli.lrange(redisKey, 0, 100, (err, result) => {
            expect(result.length).toEqual(4)
            done(err)
          })
        })

        it('of course add it to the Done list as well', (done) => {
          expect.assertions(1)
          redisCli.hkeys(redisKeyDone, (err, result) => {
            expect(Object.keys(result).length).toEqual(4)
            done(err)
          })
        })
      })

      describe('trying to add a known URL', () => {
        beforeEach(async () => {
          await queue.queue('https://item2.com/expose/12345')
        })

        it('wont add it to the todo list', (done) => {
          expect.assertions(1)
          redisCli.lrange(redisKey, 0, 100, (err, result) => {
            expect(result.length).toEqual(3)
            done(err)
          })
        })

        it('will not add another entry to Done list', (done) => {
          expect.assertions(1)
          redisCli.hkeys(redisKeyDone, (err, result) => {
            expect(Object.keys(result).length).toEqual(3)
            done(err)
          })
        })
      })

      describe('after having all pulled out again', () => {
        beforeEach(async () => {
          await queue.getNextUrl()
          await queue.getNextUrl()
          await queue.getNextUrl()
        })

        it('nothing is in the todo list anymore', (done) => {
          expect.assertions(1)
          redisCli.lrange(redisKey, 0, 100, (err, result) => {
            expect(result.length).toEqual(0)
            done(err)
          })
        })

        it('the are still all in the Done list', (done) => {
          expect.assertions(1)
          redisCli.hkeys(redisKeyDone, (err, result) => {
            expect(Object.keys(result).length).toEqual(3)
            done(err)
          })
        })
      })
    })
  })

  describe('used in a Crawler', () => {
    let crawler
    class StubApp {
      process ({ queueUrls }) {
        queueUrls('http://item2.com')
        queueUrls('http://item3.com')
      }
    }

    it('works as expected', done => {
      expect.assertions(1)
      crawler = new Crawler({
        queue: new RedisURLQueue({ redisKey, redisOptions })
      })
      crawler.addApp(() => new StubApp())
      crawler
        .seed('http://localhost/item1')
        .then(() => {
          crawler
            .on('finish', reporter => {
              expect(Object.keys(reporter.toJson())).toEqual([
                'http://localhost/item1',
                'http://item2.com',
                'http://item3.com'
              ])

              done()
            })
            .start()
        })
    })
  })
})
