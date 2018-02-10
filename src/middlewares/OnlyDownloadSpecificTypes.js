import request from 'request'

import checkContentType from '../utils/checkContentType'

export class UninterestingError {}

/**
 * This app sends out head requests before real requests are going out and checks if
 * the resource matches a specific contentType. If not, the resouce will be dropped
 * with a note
 * It needs the `onlySpecificContentTypes` config in app to be set
 */
export default class OnlyDownloadSpecificTypes {
  name = 'OnlyDownloadSpecificTypes'
  noCheerio = true

  constructor ({ onlySpecificContentTypes = null } = {}) {
    this.onlySpecificContentTypes = onlySpecificContentTypes
  }

  preRequest (url, requestOptions, { report }) {
    if (this.onlySpecificContentTypes === null) return Promise.resolve()
    return new Promise((resolve, reject) => {
      request({
        uri: url.normalizedHref,
        ...requestOptions,
        method: 'HEAD',
        timeout: 20000
      }, (err, response) => {
        if (err) {
          reject(err)
        } else {
          const contentType = response.headers['content-type']
          if (response.statusCode >= 400) {
            report(
              'PageLoadError',
              `${response.statusMessage} (${response.statusCode})`
            )
            reject(new UninterestingError())
          } else if (!checkContentType(this.onlySpecificContentTypes, contentType)) {
            report(
              'skipped',
              `The Content-Type "${contentType}" does not match allowed content-type. Resource will be skipped.`
            )
            reject(new UninterestingError())
          } else {
            resolve()
          }
        }
      })
    })
  }
}
