const Occurences = require('occurences')

module.exports = class KeywordExtractor {
  constructor ({ keywords }) {
    this.name = 'KeywordExtractor'
    this.noCheerio = true

    this.keywords = keywords
  }

  process ({ body, report }) {
    const occurrences = new Occurences(body)
    let keywordCount = 0
    const matchingKeywords = []

    this.keywords.forEach(keyword => {
      if (occurrences.stats[keyword]) {
        ++keywordCount
        matchingKeywords.push(keyword)
      }
    })
    report('keywordCount', { count: keywordCount })
    report('keywords', matchingKeywords)
  }
}
