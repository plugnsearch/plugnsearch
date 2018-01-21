import dataExtractor from '../utils/dataExtractor'

export default class MetaDataExtractor {
  name = 'MetaDataExtractor'
  noCheerio = true

  process ({ body, report }) {
    return dataExtractor(body)
      .then(meta => {
        report('meta', meta)
      })
  }
}
