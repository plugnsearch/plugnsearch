import SpiderApp from '../SpiderApp'
import dataExtractor from '../utils/dataExtractor'
import linkExtractor from '../utils/linkExtractor'

const after = (result) => {
  if (result && result.constructor === Promise) {
    return result
  } else {
    return new Promise(function (resolve) {
      resolve(result)
    })
  }
}

export default class App extends SpiderApp {
  parseDocument ({ body, $, headers, url }) {
    return dataExtractor(body).then(meta => {
      return { meta }
    })
  }

  expandLinks ({ body, $, headers, url }) {
    return linkExtractor(body, url)
      .then(links => links.map(l => l.url))
  }
}
