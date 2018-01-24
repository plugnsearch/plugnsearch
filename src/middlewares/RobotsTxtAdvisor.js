import { URL } from 'url'
import request from 'request'
import robotsParser from 'robots-parser'

class UninterestingError {}

/**
 * Reads the robots.txt file from a domain and heeds the crawling restrictions from
 * that file.
 */
export default class RobotsTxtAdvisor {
  name = 'RobotsTxtAdvisor'
  noCheerio = true

  constructor ({ robotsTxtLogging } = {}) {
    this.logging = robotsTxtLogging
    this.memory = {}
  }

  preRequest ({ uri, headers }, { report }) {
    try {
      const { origin } = new URL(uri)
      const txtUri = `${origin}/robots.txt`
      return this.fetchRobotsTxt(txtUri)
        .then(body => {
          const robots = robotsParser(txtUri, body)
          if (!robots.isAllowed(uri, headers['User-Agent'])) {
            if (this.logging) {
              report(
                'skipped',
                `Bot ${headers['User-Agent']} is disallowed from ${uri}`
              )
            }
            throw new UninterestingError(`Bot ${headers['User-Agent']} is disallowed from ${uri}`)
          }
        })
    } catch (e) {
      return Promise.reject(new UninterestingError('URI is wrong'))
    }
  }

  fetchRobotsTxt (uri) {
    if (this.memory[uri] || this.memory[uri] === '') return Promise.resolve(this.memory[uri])
    return new Promise((resolve, reject) => {
      request({
        uri
      }, (err, response) => {
        if (err) {
          this.memory[uri] = ''
          resolve('')
        } else {
          this.memory[uri] = response.body
          resolve(response.body)
        }
      })
    })
  }
}
