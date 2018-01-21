import request from 'request'

import checkContentType from '../utils/checkContentType'

class UninterestingError {}

/**
 * This app sends out head requests before real requests are going out and checks if
 * the resource matches a specific contentType. If not, the resouce will be dropped
 * with a note
 * It needs the `onlySpecificContentTypes` config in app to be set
 */
export default class RotateUserAgent {
  constructor (options) {
    this.appOptions = options
  }

  preRequest (requestOptions, { report }) {
    return new Promise((resolve, reject) => {
      request({
        ...requestOptions,
        method: 'HEAD'
      }, (err, response) => {
        if (err) {
          reject(err)
        } else {
          const contentType = response.headers['Content-Type']
          if (checkContentType(this.appOptions.onlySpecificContentTypes, contentType)) {
            resolve()
          } else {
            report(
              'skipped',
              `The Content-Type "${contentType}" does not match allowed content-type. Resource will be skipped.`
            )
            reject(new UninterestingError())
          }
        }
      })
    })
  }
}
