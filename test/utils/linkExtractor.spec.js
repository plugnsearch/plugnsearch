/* eslint-env jest */
const examplePage = require('../../examples/tanzschule-stender-de.html.js')
const {
  linkExtractor
} = require('../../')

describe('utils/linkExtractor', () => {
  let subject
  beforeEach(() => {
    return linkExtractor(examplePage, 'http://www.tanzschule-stender.de').then(x => { subject = x })
  })

  it('extracts links with data additional data', () => {
    expect(subject[0]).toHaveProperty('url')
    expect(subject[0]).toHaveProperty('text')
    expect(subject[0]).toHaveProperty('type')
    expect(subject[0]).toHaveProperty('count')
  })

  it('does not find inner page links (#gohere)', () => {
    const urls = subject.map(i => i.url)
    expect(urls.find(url => url.indexOf('#content') !== -1)).toBeFalsy()
  })

  it('finds relative urls as well', () => {
    const urls = subject.map(i => i.url)
    expect(urls.find(url => url.indexOf('http://www.tanzschule-stender.de/willkommen/') !== -1)).toBeTruthy()
  })

  it('reduces duplicates to a number', () => {
    const multipleOccuringUrl = 'https://www.tanzschule-stender.de/events/event/tanzparty/'
    const urls = subject.map(i => i.url)
    expect(urls.filter(url => url === multipleOccuringUrl).length).toEqual(1)
    expect(subject.find(i => i.url === multipleOccuringUrl).count).toEqual(4)
  })
})
