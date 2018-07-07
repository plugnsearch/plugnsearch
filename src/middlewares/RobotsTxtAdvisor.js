const URL = require('url').URL
const request = require('request')
const robotsParser = require('robots-parser')

const UninterestingError = require('../UninterestingError')

/**
 * Reads the robots.txt file from a domain and heeds the crawling restrictions from
 * that file.
 */
module.exports = class RobotsTxtAdvisor {
  constructor ({ robotsTxtLogging } = {}) {
    this.name = 'RobotsTxtAdvisor'

    this.logging = robotsTxtLogging
    this.memory = {}
  }

  preRequest (url, { headers }, { report }) {
    try {
      const { origin } = new URL(url.href)
      const txtUri = `${origin}/robots.txt`
      return this.fetchRobotsTxt(txtUri)
        .then(body => {
          const robots = robotsParser(txtUri, body)
          if (!robots.isAllowed(url.href, headers['User-Agent'])) {
            if (this.logging) {
              report(
                'skipped',
                `Bot ${headers['User-Agent']} is disallowed from ${url.href}`
              )
            }
            throw new UninterestingError(`Bot ${headers['User-Agent']} is disallowed from ${url.href}`)
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

module.exports.UninterestingError = UninterestingError
