import Crawler from './Crawler'
import fs from 'fs'
import path from 'path'
import winston from 'winston'

// import App from './apps/linkDataExtractor'
import ThrottleRequests from './middlewares/ThrottleRequests'
import OnlyDownloadSpecificTypes from './middlewares/OnlyDownloadSpecificTypes'
import DomainBlacklist from './middlewares/DomainBlacklist'
import ExpandOnlyHttpLinks from './middlewares/ExpandOnlyHttpLinks'
import MetaDataExtractor from './apps/MetaDataExtractor'
import App from './apps/KeywordExtractor'

import StreamReporter from './reporters/JSONStreamReporter'

let EXIT_REASON = null

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

const SEED_URLS = [
  // 'http://johanneszeiske.de'
  // 'http://gelbeseiten.de'
  // `http://johanneszeiske.de/Aktuelles;focus=CMTOI_de_dtag_hosting_hpcreator_widget_Video_17928316$3atheDownloader_122624&path=download_129647.action&frame=CMTOI_de_dtag_hosting_hpcreator_widget_Video_17928316$3atheDownloader_122624?range=true`
  'https://www.heutetanzen.de'
  // 'http://localhost:8000/recursive_testpage2.html'
  // 'http://www.tanzschule-stender.de',
  // 'https://www.tanzschule-gutmann.de/'
]

const filename = `${Date.now()}_result.json`

const crawler = new Crawler({
  logger,
  reporter: new StreamReporter({ filename: path.join(__dirname, '../results', filename) }),
  name: 'plugnsearch/1.0',
  requestOptions: {
    rejectUnauthorized: false
  },
  // blacklistedDomains: `youtube.com amazon. dancesocially.com heutetanzen.de vimeo immobilien.hamburg.de immowelt.de facebook.com linkedin.com xing.com`.split(' '),
  blacklistedDomains: [],
  keywords: `
    dance dancing
    tanz tanzen tanzveranstaltung veranstaltung veranstaltungen
    tanzparties party tanzparty
    event events
    termine kalendar calendar
  `.split(' ')
})
crawler
  // .addApp(config => new DomainBlacklist(config))
  .addApp({ preRequest: (requestOptions) => { console.log(requestOptions.uri) } })
  .addApp(new OnlyDownloadSpecificTypes({ onlySpecificContentTypes: /html/ }))
  .addApp(new ThrottleRequests({ throttle: 1200 }))
  .addApp(new MetaDataExtractor())
  .addApp(new ExpandOnlyHttpLinks())
  .addApp(config => new App(config))
  .seed(SEED_URLS)
  .on('finish', reporter => {
    reporter.closeStream()
    logger.info('Nothing left todo. Goodbye!')
    process.exit(0)
  })
  .start()

process.on('exit', (...args) => {
  logger.info(`about to leave… saving data to 'results/${filename}'`)
  fs.writeFileSync(path.join(__dirname, '../results', filename.replace('_result', '_meta')), JSON.stringify({
    exitReason: EXIT_REASON || 'finished',
    linksOpen: crawler.queue.urlsTodo
  }, null, 2))
  process.exit(0)
})

// Catch CTRL+C
process.on('SIGINT', () => {
  EXIT_REASON = 'User interrupt'
  process.exit(0)
})
