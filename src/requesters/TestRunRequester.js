const fs = require('fs')
const path = require('path')
const request = require('request')

module.exports = class TestRunRequester {
  constructor ({ snapshotDir }) {
    this.snapshotDir = snapshotDir
  }

  request (requestOptions) {
    const snapshotFile = path.join(this.snapshotDir, requestOptions.uri.replace(/[^a-zA-Z0-9_]/g, '-'))
    return new Promise((resolve, reject) => {
      fs.readFile(snapshotFile, (err, snapResponse) => {
        if (err) {
          request(requestOptions, (err, response) => {
            if (err) {
              reject(err)
            } else {
              fs.writeFile(snapshotFile, JSON.stringify({
                body: response.body,
                headers: response.headers,
                statusCode: response.statusCode,
                contentType: (response.headers || {})['content-type']
              }), (err) => {
                if (err) {
                  this.logError(err)
                }
                resolve(response)
              })
            }
          })
        } else {
          const response = JSON.parse(snapResponse)
          resolve({
            body: response.body,
            headers: response.headers,
            statusCode: response.statusCode,
            contentType: response.contentType
          })
        }
      })
    })
  }
}
