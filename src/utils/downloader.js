import request from 'request'

export default (url) => (
  new Promise((resolve, reject) => {
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
)
