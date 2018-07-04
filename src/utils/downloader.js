const request = require('request')

module.exports = function downloader (url) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'heutetanzen/1.0'
    }
    request({
      url,
      headers
    }, (err, resp, body) => {
      if (err) {
        reject(err)
      } else {
        resolve(body)
      }
    })
  })
}
