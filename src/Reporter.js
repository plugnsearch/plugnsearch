
export default class Reporter {
  constructor () {
    this.data = {}
  }

  report (url, type, content) {
    if (!this.data[url]) {
      this.data[url] = {}
    }

    this.data[url][type] = typeof content === 'string' ? content : {
      ...(this.data[url][type] || {}),
      ...content
    }
  }

  toJson () {
    return this.data
  }
}
