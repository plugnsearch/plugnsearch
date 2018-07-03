import zeromq from 'zeromq'

const DEFAULT_URL = process.env.ZMQ_PUB_ADDRESS || 'tcp://127.0.0.1:3000'
const DEFAULT_CHANNEL = 'plugnsearch-zero'

export default class ZeroMqReporter {
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
