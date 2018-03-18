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
    this.redisDel = promisify(this.client.del).bind(this.client)
  }

  async queue (href) {
    if (!href) { return null }
    let urls = isArray(href) ? href : [href]
    urls = urls.map(u => new URL(u))

    if (this.skipDuplicates) {
      urls = uniqBy(urls, u => u.normalizedHref)
      if (urls.length) {
        const values = await this.redisHMGet(`${this.redisKey}.Done`, urls.map(u => u.normalizedHref))
        const dedupedUrls = urls.filter((u, i) => !values[i])
        if (dedupedUrls.length > 0) {
          const setUrls = dedupedUrls.reduce((memo, url) => ({ ...memo, [url.normalizedHref]: Date.now() }), {})
          await this.redisHMSet(`${this.redisKey}.Done`, setUrls)
        }
        urls = dedupedUrls
      }
    }

    const [validUrls, invalidUrls] = partition(urls, u => u.isValid)
    // That .href is needed because of redis making a toString otherwise. We need a string there
    if (validUrls.length > 0) {
      await this.redisRPush(this.redisKey, validUrls.map(u => JSON.stringify(u)))
    }
    if (invalidUrls.length > 0) {
      return { invalidUrls }
    }
    return null
  }

  async getNextUrl () {
    const result = await this.redisLPop(this.redisKey)
    return result ? new URL(JSON.parse(result)) : null
  }

  async clear () {
    await this.redisDel([this.redisKey, `${this.redisKey}.Done`])
  }
}
