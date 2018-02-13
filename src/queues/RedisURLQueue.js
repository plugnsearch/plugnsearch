import { promisify } from 'util'
import redis from 'redis'
import isArray from 'lodash/isArray'
import partition from 'lodash/partition'
import uniqBy from 'lodash/uniqBy'

import URL from '../URL'
import SimpleURLQueue from './SimpleURLQueue'

export default class RedisURLQueue extends SimpleURLQueue {
  urlsDone = []
  urlsTodo = []

  constructor ({ redisKey = 'urlQueue', redisOptions = {}, ...options } = {}) {
    super(options)
    this.client = redis.createClient(redisOptions)
    this.redisKey = redisKey
    this.redisRPush = promisify(this.client.rpush).bind(this.client)
    this.redisLPop = promisify(this.client.lpop).bind(this.client)
    this.redisHMGet = promisify(this.client.hmget).bind(this.client)
    this.redisHMSet = promisify(this.client.hmset).bind(this.client)
  }

  async queue (href) {
    let urls = isArray(href) ? href : [href]
    urls = urls.map(u => new URL(u))
    if (this.skipDuplicates) {
      urls = uniqBy(urls, u => u.normalizedHref)
      const values = await this.redisHMGet(`${this.redisKey}.Done`, urls.map(u => u.normalizedHref))
      const dedupedUrls = urls.filter((u, i) => !values[u.normalizedHref])
      const setUrls = dedupedUrls.reduce((memo, url) => ({ ...memo, [url.normalizedHref]: Date.now() }), {})
      await this.redisHMSet(`${this.redisKey}.Done`, setUrls)
      urls = dedupedUrls
    }

    const [validUrls, invalidUrls] = partition(urls, u => u.isValid)
    await this.redisRPush(this.redisKey, validUrls)
    if (invalidUrls.length) {
      return { invalidUrls }
    }
    return null
  }

  async getNextUrl () {
    const result = await this.redisLPop(this.redisKey)
    return result || null
  }
}
