const dataExtractor = require('../utils/dataExtractor')

module.exports = class MetaDataExtractor {
  name = 'MetaDataExtractor'
  noCheerio = true

  process ({ body, report }) {
    return dataExtractor(body)
      .then(meta => {
        report('meta', meta)
      })
  }
}
