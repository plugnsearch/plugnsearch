const zeromq = require('zeromq')

const DEFAULT_URL = 'tcp://127.0.0.1:3000'
const DEFAULT_CHANNEL = 'plugnsearch-zero'

module.exports = class ZeroMqReporter {
  constructor ({ url, channel }) {
    this.channel = channel || DEFAULT_CHANNEL
    this.socket = zeromq.socket('pub')
    this.socket.bindSync(url || DEFAULT_URL)
  }

  report (url, type, data) {
    this.socket.send([this.channel, JSON.stringify({
      url,
      type,
      data
    })])
  }
}
