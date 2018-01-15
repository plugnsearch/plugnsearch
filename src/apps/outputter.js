import SpiderApp from '../SpiderApp'

export default class App extends SpiderApp {
  parseDocument ({ body, $, headers, url }) {
    console.log('URL', url)
    console.log('BODY', body)
    console.log('HEADERS', headers)
  }

  expandLinks () {
    return []
  }
}
