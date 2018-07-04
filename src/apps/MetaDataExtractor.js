const dataExtractor = require('../utils/dataExtractor')

module.exports = class MetaDataExtractor {
  constructor () {
    this.name = 'MetaDataExtractor'
    this.noCheerio = true
  }

  process ({ body, report }) {
    return dataExtractor(body)
      .then(meta => {
        report('meta', meta)
      })
  }
}
