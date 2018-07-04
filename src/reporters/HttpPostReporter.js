const request = require('request')

module.exports = class HttpPostReporter {
  constructor ({ url }) {
    this.postUrl = url
  }

  report (url, type, data) {
    request.post(this.postUrl, {
      url,
      type,
      data
    })
  }
}
