import Crawler from './Crawler'
import fs from 'fs'
import path from 'path'
import winston from 'winston'

import App from './apps/linkDataExtractor'

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
  'http://localhost:8000/recursive_testpage2.html'
  // 'http://www.tanzschule-stender.de',
  // 'https://www.tanzschule-gutmann.de/'
]

const crawler = new Crawler({
  logger,
  name: 'websearch/1.0',
  connectionsPerDomain: 1,
  throttlePerDomain: 1000 // ms
})
crawler
  .crawl(SEED_URLS, new App())
  .then(result => {
    logger.info('Nothing left todo. Goodbye!')
    process.exit(0)
  })

process.on('exit', () => {
  const filename = `${Date.now()}.json`
  logger.info(`about to leave… saving data to 'results/${filename}'`)
  fs.writeFileSync(path.join(__dirname, '../results', filename), JSON.stringify({
    reason: EXIT_REASON || 'finished',
    ...crawler.report()
  }, null, 2))
  process.exit(0)
})

// Catch CTRL+C
process.on('SIGINT', () => {
  EXIT_REASON = 'User interrupt'
  process.exit(0)
})
