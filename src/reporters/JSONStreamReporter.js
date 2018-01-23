import fs from 'fs'

export default class JSONStreamReporter {
  constructor ({ filename }) {
    this.filename = filename
    this.stream = fs.createWriteStream(filename)
    this.stream.write('[')
    this.alreadyWritten = false
  }

  report (url, type, content) {
    if (this.alreadyWritten) {
      // make it valid json
      this.stream.write(', ')
    }
    this.stream.write(JSON.stringify({
      url,
      [type]: content
    }, null, 2))
    this.alreadyWritten = true
  }

  closeStream () {
    return new Promise(resolve => {
      this.stream.on('finish', resolve)
      this.stream.end(']')
    })
  }
}
