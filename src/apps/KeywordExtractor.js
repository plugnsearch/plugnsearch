import Occurences from 'occurences'

export default class KeywordExtractor {
  name = 'KeywordExtractor'
  noCheerio = true

  constructor ({ keywords }) {
    this.keywords = keywords
  }

  process ({ body, url, queueUrls, report }) {
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
