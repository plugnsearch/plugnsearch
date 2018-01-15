import examplePage from '../../examples/tanzschule-stender-de.html.js'
import dataExtractor from '../../src/utils/dataExtractor'

describe('utils/dataExtractor', () => {
  let subject
  beforeEach(() => {
    return dataExtractor(examplePage, 'http://www.tanzschule-stender.de').then(x => subject = x)
  })

  it('extracts basic infos', () => {
    expect(subject.title).toEqual('Tanzschule Heiko Stender - Wir bieten Ihnen in unserer Tanzschule in Hamburg Kurse ab 3 Jahren, Jugendkurse, Tanzkurse für Erwachsene, Paare und Singles, Spezialkurse wie Discofox, Hochzeitskurse, Privatstunden, Privatkurse, Hip-Hop und Kurse für Senioren, wöchentliche Tanzparties und festliche Bälle.')
    expect(subject.description).toEqual('Wir bieten Ihnen in unserer Tanzschule in Hamburg Kurse ab 3 Jahren, Jugendkurse, Tanzkurse für Erwachsene, Paare und Singles, Spezialkurse wie Discofox, Hochzeitskurse, Privatstunden, Privatkurse, Hip-Hop und Kurse für Senioren, wöchentliche Tanzparties und festliche Bälle.')
    expect(subject.robots).toEqual('noodp')
  })

  it('extracts canonical url', () => {
    expect(subject.canonical).toEqual('https://www.tanzschule-stender.de')
  })

  it('extracts all the json-ld stuff there is', () => {
    expect(subject.jsonLd.length).toEqual(2)
  })
})
