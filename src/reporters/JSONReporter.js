import isArray from 'lodash/isArray'

export default class Reporter {
  constructor () {
    this.data = {}
  }

  report (url, type, content) {
    if (!this.data[url]) {
      this.data[url] = {}
    }

    if (type) {
      let value
      switch (typeof content) {
        case 'string':
          // fall through
        case 'number':
          value = content
          break
        default:
          value = isArray(content) ? [
            ...(this.data[url][type] || []),
            ...content
          ] : {
            ...(this.data[url][type] || {}),
            ...content
          }
      }
      this.data[url][type] = value
    }
  }

  toJson () {
    return this.data
  }
}
